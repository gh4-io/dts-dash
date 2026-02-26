/**
 * Allocation Engine — Demand Contracts + Lines
 *
 * Pure compute functions for demand contracts with allocation lines.
 * Contracts represent customer obligations; lines define scheduled coverage.
 * Zero DB dependencies.
 *
 * Two modes:
 * - MINIMUM_FLOOR: effective = max(normalMH, allocatedMH)
 * - ADDITIVE: effective = normalMH + allocatedMH
 */

import type {
  DemandContract,
  DemandAllocationLine,
  MatchedAllocation,
  AllocationMode,
  ContractPeriodType,
  ProjectionStatus,
  DailyDemandV2,
  CapacityShift,
} from "@/types";

// ─── Projection / Sanity Check ──────────────────────────────────────────────

/**
 * Compute projected MH for a contract based on its lines and period type.
 * Returns null if contract has no contracted_mh (sanity check not configured).
 *
 * Scaling: counts day occurrences per week per line, sums to weekly_projected,
 * then scales to the contract's period_type.
 */
export function computeContractProjection(
  contract: Pick<DemandContract, "contractedMh" | "periodType" | "effectiveFrom" | "effectiveTo">,
  lines: Pick<DemandAllocationLine, "dayOfWeek" | "allocatedMh">[],
): number | null {
  if (contract.contractedMh === null || contract.contractedMh === undefined) return null;
  if (!contract.periodType) return null;

  // Each line contributes: allocatedMh × occurrences_per_week
  // dayOfWeek = null → 7 occ/week; specific day → 1 occ/week
  let weeklyProjected = 0;
  for (const line of lines) {
    const occPerWeek = line.dayOfWeek === null ? 7 : 1;
    weeklyProjected += line.allocatedMh * occPerWeek;
  }

  // Scale to period
  switch (contract.periodType) {
    case "WEEKLY":
      return Math.round(weeklyProjected * 100) / 100;
    case "MONTHLY":
      return Math.round(weeklyProjected * 4.348 * 100) / 100;
    case "ANNUAL":
      return Math.round(weeklyProjected * 52.143 * 100) / 100;
    case "TOTAL": {
      if (!contract.effectiveTo) {
        // No end date → use 52-week lookahead
        return Math.round(weeklyProjected * 52 * 100) / 100;
      }
      const from = new Date(contract.effectiveFrom + "T00:00:00Z");
      const to = new Date(contract.effectiveTo + "T00:00:00Z");
      const diffMs = to.getTime() - from.getTime();
      const diffWeeks = Math.max(diffMs / (7 * 24 * 60 * 60 * 1000), 0);
      return Math.round(weeklyProjected * diffWeeks * 100) / 100;
    }
    case "PER_EVENT":
      return null; // Per-event contracts can't be projected without event count
    default:
      return null;
  }
}

/**
 * Compare projected MH against contracted MH to get status.
 * - SHORTFALL: projected < contracted
 * - EXCESS: projected > contracted × 1.20 (>20% over)
 * - OK: within range
 */
export function getProjectionStatus(
  projected: number | null,
  contracted: number | null,
): ProjectionStatus | null {
  if (projected === null || contracted === null) return null;
  if (contracted <= 0) return null;

  if (projected < contracted) return "SHORTFALL";
  if (projected > contracted * 1.2) return "EXCESS";
  return "OK";
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Find matching allocation lines from active contracts for a specific
 * date/shift/customer combination.
 *
 * For each contract: check active, date overlap, customer match.
 * For each matching contract: find lines where shift_id and day_of_week match.
 * Returns flat array of MatchedAllocation (mode from contract, MH from line).
 */
export function findMatchingAllocations(
  date: string,
  shiftCode: string,
  customerId: number,
  contracts: DemandContract[],
  shifts: CapacityShift[],
): MatchedAllocation[] {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const shiftObj = shifts.find((s) => s.code === shiftCode);
  const results: MatchedAllocation[] = [];

  for (const c of contracts) {
    if (!c.isActive) continue;
    if (c.customerId !== customerId) continue;
    if (c.effectiveFrom > date) continue;
    if (c.effectiveTo !== null && c.effectiveTo < date) continue;

    // PER_EVENT with no lines: use contractedMh directly as per-event MH
    if (c.periodType === "PER_EVENT" && c.lines.length === 0 && c.contractedMh !== null) {
      results.push({ mode: c.mode, allocatedMh: c.contractedMh });
      continue;
    }

    // Contract matches — now find matching lines
    for (const line of c.lines) {
      if (line.dayOfWeek !== null && line.dayOfWeek !== dow) continue;
      if (line.shiftId !== null) {
        if (!shiftObj || line.shiftId !== shiftObj.id) continue;
      }
      results.push({ mode: c.mode, allocatedMh: line.allocatedMh });
    }
  }

  return results;
}

// ─── Compute ──────────────────────────────────────────────────────────────────

/**
 * Compute effective allocated MH given normal (WP-based) MH and matching allocations.
 *
 * - ADDITIVE allocations are summed and added to normalMH.
 * - MINIMUM_FLOOR allocations take the max floor value.
 * - Final result: max(normalMH + sumAdditive, maxFloor)
 */
export function computeAllocatedMH(
  normalMH: number,
  matchingAllocations: MatchedAllocation[],
): number {
  if (matchingAllocations.length === 0) return normalMH;

  let sumAdditive = 0;
  let maxFloor = 0;

  for (const a of matchingAllocations) {
    if (a.mode === "ADDITIVE") {
      sumAdditive += a.allocatedMh;
    } else if (a.mode === "MINIMUM_FLOOR") {
      maxFloor = Math.max(maxFloor, a.allocatedMh);
    }
  }

  const adjusted = normalMH + sumAdditive;
  return Math.max(adjusted, maxFloor);
}

// ─── Apply to Demand ──────────────────────────────────────────────────────────

/**
 * Apply contracts to computed demand data. Returns a new array (immutable).
 *
 * For each (date, shift):
 * - Gather per-customer normalMH from wpContributions
 * - For each customer with active contracts: compute adjusted MH, accumulate delta
 * - Key: customer with contract but no WPs still creates demand from the allocation
 * - Sets allocatedDemandMH on shifts, totalAllocatedDemandMH on days
 */
export function applyAllocations(
  demand: DailyDemandV2[],
  contracts: DemandContract[],
  shifts: CapacityShift[],
  customerMap: Map<number, string>,
): DailyDemandV2[] {
  if (contracts.length === 0) return demand;

  // Build reverse map: customerName -> customerId
  const nameToId = new Map<string, number>();
  for (const [id, name] of customerMap) {
    nameToId.set(name, id);
  }

  // Get all unique customer IDs from contracts
  const contractCustomerIds = new Set(contracts.map((c) => c.customerId));

  // Build a set of all dates in demand
  const demandDates = new Set(demand.map((d) => d.date));
  const allDates = new Set(demandDates);

  // Clone demand into a map for easy mutation
  const demandMap = new Map<string, DailyDemandV2>();
  for (const d of demand) {
    demandMap.set(d.date, deepCloneDay(d));
  }

  // Process each date
  for (const date of allDates) {
    let day = demandMap.get(date);
    if (!day) {
      day = {
        date,
        totalDemandMH: 0,
        aircraftCount: 0,
        byCustomer: {},
        byShift: [],
      };
      demandMap.set(date, day);
    }

    const jsDay = new Date(date + "T12:00:00Z").getUTCDay();
    const isoDow = jsDay === 0 ? 7 : jsDay; // ISO: 1=Mon..7=Sun

    const activeShifts = shifts.filter((s) => s.isActive);
    for (const shift of activeShifts) {
      // Skip shifts that don't operate on this day of week
      if (shift.operatingDays && !shift.operatingDays.includes(isoDow)) continue;
      let shiftDemand = day.byShift.find((s) => s.shiftCode === shift.code);
      if (!shiftDemand) {
        shiftDemand = {
          shiftCode: shift.code,
          demandMH: 0,
          wpContributions: [],
        };
        day.byShift.push(shiftDemand);
      }

      // Compute per-customer normalMH from wpContributions
      const customerMH = new Map<string, number>();
      for (const wp of shiftDemand.wpContributions) {
        customerMH.set(wp.customer, (customerMH.get(wp.customer) ?? 0) + wp.allocatedMH);
      }

      let shiftDelta = 0;

      for (const custId of contractCustomerIds) {
        const custName = customerMap.get(custId);
        if (!custName) continue;

        const matching = findMatchingAllocations(date, shift.code, custId, contracts, shifts);
        if (matching.length === 0) continue;

        const normalMH = customerMH.get(custName) ?? 0;
        const effectiveMH = computeAllocatedMH(normalMH, matching);
        const delta = effectiveMH - normalMH;

        if (delta > 0) {
          shiftDelta += delta;
          day.byCustomer[custName] = (day.byCustomer[custName] ?? 0) + delta;
        }
      }

      if (shiftDelta > 0) {
        shiftDemand.allocatedDemandMH = shiftDemand.demandMH + shiftDelta;
        shiftDemand.demandMH += shiftDelta;
      }
    }

    // Recalculate day totals
    let totalDemand = 0;
    let totalAllocated = 0;
    let hasAllocated = false;
    for (const s of day.byShift) {
      totalDemand += s.demandMH;
      if (s.allocatedDemandMH !== undefined) {
        totalAllocated += s.allocatedDemandMH;
        hasAllocated = true;
      }
    }
    day.totalDemandMH = totalDemand;
    if (hasAllocated) {
      day.totalAllocatedDemandMH = totalAllocated;
    }
  }

  return Array.from(demandMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_MODES: AllocationMode[] = ["ADDITIVE", "MINIMUM_FLOOR"];
const VALID_PERIOD_TYPES: ContractPeriodType[] = [
  "WEEKLY",
  "MONTHLY",
  "ANNUAL",
  "TOTAL",
  "PER_EVENT",
];

/**
 * Validate contract data before create/update.
 */
export function validateContract(data: {
  customerId?: number;
  name?: string;
  mode?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  contractedMh?: number | null;
  periodType?: string | null;
  lines?: { allocatedMh?: number; dayOfWeek?: number | null }[];
}): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.customerId && data.customerId !== 0) {
    errors.push("customerId is required");
  }

  if (!data.name || data.name.trim().length === 0) {
    errors.push("name is required");
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!data.effectiveFrom) {
    errors.push("effectiveFrom is required");
  } else if (!dateRegex.test(data.effectiveFrom)) {
    errors.push("effectiveFrom must be YYYY-MM-DD format");
  }

  if (data.effectiveTo !== null && data.effectiveTo !== undefined) {
    if (!dateRegex.test(data.effectiveTo)) {
      errors.push("effectiveTo must be YYYY-MM-DD format");
    } else if (data.effectiveFrom && data.effectiveTo < data.effectiveFrom) {
      errors.push("effectiveTo must be >= effectiveFrom");
    }
  }

  if (!data.mode) {
    errors.push("mode is required");
  } else if (!VALID_MODES.includes(data.mode as AllocationMode)) {
    errors.push("mode must be ADDITIVE or MINIMUM_FLOOR");
  }

  // contractedMh and periodType: both set or both null
  const hasMh = data.contractedMh !== null && data.contractedMh !== undefined;
  const hasPeriod =
    data.periodType !== null && data.periodType !== undefined && data.periodType !== "";
  if (hasMh && !hasPeriod) {
    errors.push("periodType is required when contractedMh is set");
  }
  if (!hasMh && hasPeriod) {
    errors.push("contractedMh is required when periodType is set");
  }
  if (hasMh && typeof data.contractedMh === "number" && data.contractedMh <= 0) {
    errors.push("contractedMh must be a positive number");
  }
  if (hasPeriod && !VALID_PERIOD_TYPES.includes(data.periodType as ContractPeriodType)) {
    errors.push("periodType must be WEEKLY, MONTHLY, ANNUAL, TOTAL, or PER_EVENT");
  }

  // Validate lines
  if (data.lines) {
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      if (line.allocatedMh === undefined || line.allocatedMh === null || line.allocatedMh <= 0) {
        errors.push(`lines[${i}].allocatedMh must be a positive number`);
      }
      if (line.dayOfWeek !== null && line.dayOfWeek !== undefined) {
        if (!Number.isInteger(line.dayOfWeek) || line.dayOfWeek < 0 || line.dayOfWeek > 6) {
          errors.push(`lines[${i}].dayOfWeek must be 0-6 (Sun-Sat) or null`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepCloneDay(day: DailyDemandV2): DailyDemandV2 {
  return {
    date: day.date,
    totalDemandMH: day.totalDemandMH,
    totalAllocatedDemandMH: day.totalAllocatedDemandMH,
    aircraftCount: day.aircraftCount,
    byCustomer: { ...day.byCustomer },
    byShift: day.byShift.map((s) => ({
      shiftCode: s.shiftCode,
      demandMH: s.demandMH,
      allocatedDemandMH: s.allocatedDemandMH,
      wpContributions: [...s.wpContributions],
    })),
  };
}
