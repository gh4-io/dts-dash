/**
 * Allocation Engine (P2-6)
 *
 * Pure compute functions for demand allocations — contractual minimum hours
 * per customer that adjust demand calculations. Zero DB dependencies.
 *
 * Two modes:
 * - MINIMUM_FLOOR: effective = max(normalMH, allocatedMH)
 * - ADDITIVE: effective = normalMH + allocatedMH
 */

import type {
  DemandAllocation,
  AllocationMode,
  DailyDemandV2,
  ShiftDemandV2,
  CapacityShift,
} from "@/types";

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Find allocations that apply to a specific date/shift/customer combination.
 *
 * Filters by: isActive, effectiveFrom <= date, effectiveTo null or >= date,
 * dayOfWeek match (null = all), shiftId match (null = all shifts, else lookup
 * via shift code).
 */
export function findMatchingAllocations(
  date: string,
  shiftCode: string,
  customerId: number,
  allocations: DemandAllocation[],
  shifts: CapacityShift[],
): DemandAllocation[] {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const shiftObj = shifts.find((s) => s.code === shiftCode);

  return allocations.filter((a) => {
    if (!a.isActive) return false;
    if (a.customerId !== customerId) return false;
    if (a.effectiveFrom > date) return false;
    if (a.effectiveTo !== null && a.effectiveTo < date) return false;
    if (a.dayOfWeek !== null && a.dayOfWeek !== dow) return false;
    if (a.shiftId !== null) {
      if (!shiftObj || a.shiftId !== shiftObj.id) return false;
    }
    return true;
  });
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
  matchingAllocations: DemandAllocation[],
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
 * Apply allocations to computed demand data. Returns a new array (immutable).
 *
 * For each (date, shift):
 * - Gather per-customer normalMH from wpContributions
 * - For each customer with active allocations: compute adjusted MH, accumulate delta
 * - Key: customer with allocation but no WPs still creates demand from the allocation
 * - Sets allocatedDemandMH on shifts, totalAllocatedDemandMH on days
 *
 * @param customerMap Map from customerId to customerName (for bridging)
 */
export function applyAllocations(
  demand: DailyDemandV2[],
  allocations: DemandAllocation[],
  shifts: CapacityShift[],
  customerMap: Map<number, string>,
): DailyDemandV2[] {
  if (allocations.length === 0) return demand;

  // Build reverse map: customerName -> customerId
  const nameToId = new Map<string, number>();
  for (const [id, name] of customerMap) {
    nameToId.set(name, id);
  }

  // Get all unique customer IDs from allocations
  const allocCustomerIds = new Set(allocations.map((a) => a.customerId));

  // Build a set of all dates in demand
  const demandDates = new Set(demand.map((d) => d.date));

  // Also identify dates that allocations could apply to but demand has no entry for
  // (customer with allocation but no WPs — we need to create demand entries)
  const allDates = new Set(demandDates);

  // Clone demand into a map for easy mutation
  const demandMap = new Map<string, DailyDemandV2>();
  for (const d of demand) {
    demandMap.set(d.date, deepCloneDay(d));
  }

  // Process each date in demand
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

    // Process each shift
    const activeShifts = shifts.filter((s) => s.isActive);
    for (const shift of activeShifts) {
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

      // Check each allocation customer
      for (const custId of allocCustomerIds) {
        const custName = customerMap.get(custId);
        if (!custName) continue;

        const matching = findMatchingAllocations(date, shift.code, custId, allocations, shifts);
        if (matching.length === 0) continue;

        const normalMH = customerMH.get(custName) ?? 0;
        const effectiveMH = computeAllocatedMH(normalMH, matching);
        const delta = effectiveMH - normalMH;

        if (delta > 0) {
          shiftDelta += delta;
          // Update byCustomer at the day level
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

  // Return sorted by date
  return Array.from(demandMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate allocation data before create/update.
 */
export function validateAllocation(data: Partial<DemandAllocation>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.customerId && data.customerId !== 0) {
    errors.push("customerId is required");
  }

  if (data.dayOfWeek !== null && data.dayOfWeek !== undefined) {
    if (!Number.isInteger(data.dayOfWeek) || data.dayOfWeek < 0 || data.dayOfWeek > 6) {
      errors.push("dayOfWeek must be 0-6 (Sun-Sat) or null");
    }
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

  if (data.allocatedMh === undefined || data.allocatedMh === null) {
    errors.push("allocatedMh is required");
  } else if (typeof data.allocatedMh !== "number" || data.allocatedMh <= 0) {
    errors.push("allocatedMh must be a positive number");
  }

  const validModes: AllocationMode[] = ["ADDITIVE", "MINIMUM_FLOOR"];
  if (!data.mode) {
    errors.push("mode is required");
  } else if (!validModes.includes(data.mode as AllocationMode)) {
    errors.push("mode must be ADDITIVE or MINIMUM_FLOOR");
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
