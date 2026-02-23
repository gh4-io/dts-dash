/**
 * Demand Engine (v0.3.0)
 *
 * Demand aggregation with configurable weighted spread across ground time shifts.
 *
 * CRITICAL BEHAVIORAL CHANGE from old system:
 * Old engine DUPLICATES full effectiveMH to every on-ground date.
 * New engine DISTRIBUTES total MH across ground-time shift slots.
 * A 3-day WP with 3 MH now shows 1 MH/slot (total 3 MH) not 3 MH/day (total 9 MH).
 * This is correct for workforce planning.
 *
 * Demand Curve:
 * - EVEN: distributes MH equally across all on-ground shift slots
 * - WEIGHTED: arrival/departure shifts get boosted allocation, remainder spread evenly
 *
 * Pure functions — zero DB dependencies.
 */

import type { CapacityShift, CapacityAssumptions, DailyDemandV2, ShiftDemandV2 } from "@/types";
import { getLocalHour, getLocalDateStr } from "./tz-helpers";

// ─── Types ─────────────────────────────────────────────────────────────────

/** Work package data needed for demand computation */
export interface DemandWorkPackage {
  id: number;
  aircraftReg: string;
  customer: string;
  arrival: string; // ISO datetime
  departure: string; // ISO datetime
  effectiveMH: number;
  mhSource: string; // "override" | "wp" | "default"
}

// ─── Shift Resolution ──────────────────────────────────────────────────────

/**
 * Map an hour (0-23) to a shift.
 * Handles overnight shifts (e.g., Night 23-07).
 * Returns the shift or null if no shift covers that hour.
 */
export function resolveShiftForHour(hour: number, shifts: CapacityShift[]): CapacityShift | null {
  for (const shift of shifts) {
    if (shift.startHour < shift.endHour) {
      // Normal shift: e.g., Day 07-15
      if (hour >= shift.startHour && hour < shift.endHour) return shift;
    } else {
      // Overnight shift: e.g., Night 23-07
      if (hour >= shift.startHour || hour < shift.endHour) return shift;
    }
  }
  return null;
}

// ─── Ground Slot Enumeration ───────────────────────────────────────────────

/**
 * Enumerate all (date, shift) slots an aircraft occupies during ground time.
 *
 * Shift start/end hours are interpreted in the configured timezone (from shifts).
 * Each shift that overlaps with the aircraft's ground time gets a slot.
 *
 * @param timezone - IANA timezone for shift hour interpretation (default: "UTC")
 */
export function enumerateGroundSlots(
  arrivalISO: string,
  departureISO: string,
  shifts: CapacityShift[],
): Array<{ date: string; shift: CapacityShift; isArrival: boolean; isDeparture: boolean }> {
  const activeShifts = shifts.filter((s) => s.isActive);
  if (activeShifts.length === 0) return [];

  const arrival = new Date(arrivalISO);
  const departure = new Date(departureISO);

  if (departure <= arrival) return [];

  const slots: Array<{
    date: string;
    shift: CapacityShift;
    isArrival: boolean;
    isDeparture: boolean;
  }> = [];

  // Read timezone from shift data — engines never accept tz as a parameter (D-049)
  const timezone = shifts[0]?.timezone ?? "UTC";

  // Walk hour-by-hour through the ground time in UTC,
  // converting each UTC hour to the shift timezone for matching.
  // This avoids complex inverse timezone conversions.
  const seenKeys = new Set<string>();
  const arrivalLocalDate = getLocalDateStr(arrival, timezone);
  const departureLocalDate = getLocalDateStr(departure, timezone);
  const arrivalLocalHour = getLocalHour(arrival, timezone);
  const departureLocalHour = getLocalHour(departure, timezone);

  const current = new Date(arrival);
  current.setUTCMinutes(0, 0, 0); // snap to hour boundary

  while (current < departure) {
    const localHour = getLocalHour(current, timezone);
    const localDate = getLocalDateStr(current, timezone);
    const shift = resolveShiftForHour(localHour, activeShifts);

    if (shift) {
      const key = `${localDate}:${shift.code}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        const isArrival = localDate === arrivalLocalDate && isHourInShift(arrivalLocalHour, shift);
        const isDeparture =
          localDate === departureLocalDate && isHourInShift(departureLocalHour, shift);

        slots.push({ date: localDate, shift, isArrival, isDeparture });
      }
    }

    current.setUTCHours(current.getUTCHours() + 1);
  }

  return slots;
}

/** Check if an hour falls within a shift's range */
function isHourInShift(hour: number, shift: CapacityShift): boolean {
  if (shift.startHour < shift.endHour) {
    return hour >= shift.startHour && hour < shift.endHour;
  } else {
    return hour >= shift.startHour || hour < shift.endHour;
  }
}

// ─── Demand Curve Application ──────────────────────────────────────────────

/**
 * Distribute totalMH across slots using the configured demand curve.
 *
 * EVEN mode: totalMH / numSlots for each slot.
 * WEIGHTED mode:
 *   baseMH = (1 - arrivalWeight - departureWeight) × totalMH / numSlots
 *   arrivalSlotMH = baseMH + (arrivalWeight × totalMH)
 *   departureSlotMH = baseMH + (departureWeight × totalMH)
 *   middleSlotMH = baseMH
 *
 * Conservation law: sum(allSlotMH) == totalMH (within floating point).
 *
 * Single-slot case: both arrival and departure weights apply to the same slot.
 */
export function applyDemandCurve(
  totalMH: number,
  slots: Array<{ isArrival: boolean; isDeparture: boolean }>,
  assumptions: CapacityAssumptions,
): number[] {
  const numSlots = slots.length;
  if (numSlots === 0) return [];

  if (assumptions.demandCurve === "EVEN" || numSlots === 1) {
    // For single slot, all MH goes to it regardless of curve
    if (numSlots === 1) return [totalMH];
    return slots.map(() => totalMH / numSlots);
  }

  // WEIGHTED mode
  const arrW = assumptions.arrivalWeight;
  const depW = assumptions.departureWeight;

  // Each slot gets a base portion of the "remainder" MH
  const remainderFraction = 1 - arrW - depW;
  const baseMH = (remainderFraction * totalMH) / numSlots;

  return slots.map((slot) => {
    let mh = baseMH;
    if (slot.isArrival) mh += arrW * totalMH;
    if (slot.isDeparture) mh += depW * totalMH;
    return mh;
  });
}

/**
 * Validate demand curve weights.
 * Returns error message if invalid, null if valid.
 */
export function validateDemandCurveWeights(
  arrivalWeight: number,
  departureWeight: number,
): string | null {
  if (arrivalWeight < 0 || departureWeight < 0) {
    return "Demand curve weights must be non-negative";
  }
  if (arrivalWeight + departureWeight > 1.0) {
    return `Demand curve weights sum to ${(arrivalWeight + departureWeight).toFixed(2)}, must be <= 1.0`;
  }
  return null;
}

// ─── Daily Demand Aggregation ──────────────────────────────────────────────

/**
 * Compute daily demand V2 from work packages with distribution across shifts.
 *
 * For each WP:
 * 1. Enumerate ground-time shift slots
 * 2. Apply demand curve to distribute MH across slots
 * 3. Aggregate by (date, shift) with WP attribution for drilldown
 *
 * Returns DailyDemandV2[] sorted by date.
 */
export function computeDailyDemandV2(
  workPackages: DemandWorkPackage[],
  shifts: CapacityShift[],
  assumptions: CapacityAssumptions,
): DailyDemandV2[] {
  if (workPackages.length === 0) return [];

  // Aggregation map: date -> shift -> { demandMH, wpContributions, aircraftSet }
  const aggMap = new Map<
    string,
    Map<
      string,
      {
        demandMH: number;
        wpContributions: Array<{
          wpId: number;
          aircraftReg: string;
          customer: string;
          allocatedMH: number;
          mhSource: string;
        }>;
        aircraftSet: Set<string>;
        customerMH: Map<string, number>;
      }
    >
  >();

  const ensureSlot = (date: string, shiftCode: string) => {
    if (!aggMap.has(date)) {
      aggMap.set(date, new Map());
    }
    const dateMap = aggMap.get(date)!;
    if (!dateMap.has(shiftCode)) {
      dateMap.set(shiftCode, {
        demandMH: 0,
        wpContributions: [],
        aircraftSet: new Set(),
        customerMH: new Map(),
      });
    }
    return dateMap.get(shiftCode)!;
  };

  for (const wp of workPackages) {
    const groundSlots = enumerateGroundSlots(wp.arrival, wp.departure, shifts);
    if (groundSlots.length === 0) continue;

    const allocatedMHs = applyDemandCurve(
      wp.effectiveMH,
      groundSlots.map((s) => ({ isArrival: s.isArrival, isDeparture: s.isDeparture })),
      assumptions,
    );

    for (let i = 0; i < groundSlots.length; i++) {
      const slot = groundSlots[i];
      const allocatedMH = allocatedMHs[i];

      const bucket = ensureSlot(slot.date, slot.shift.code);
      bucket.demandMH += allocatedMH;
      bucket.aircraftSet.add(wp.aircraftReg);
      bucket.wpContributions.push({
        wpId: wp.id,
        aircraftReg: wp.aircraftReg,
        customer: wp.customer,
        allocatedMH,
        mhSource: wp.mhSource,
      });

      const custMH = bucket.customerMH.get(wp.customer) ?? 0;
      bucket.customerMH.set(wp.customer, custMH + allocatedMH);
    }
  }

  // Convert to DailyDemandV2[]
  const result: DailyDemandV2[] = [];

  for (const [date, shiftMap] of aggMap) {
    const byShift: ShiftDemandV2[] = [];
    let totalDemandMH = 0;
    const allAircraft = new Set<string>();
    const totalByCustomer = new Map<string, number>();

    for (const [shiftCode, data] of shiftMap) {
      byShift.push({
        shiftCode,
        demandMH: data.demandMH,
        wpContributions: data.wpContributions,
      });
      totalDemandMH += data.demandMH;
      for (const reg of data.aircraftSet) allAircraft.add(reg);
      for (const [cust, mh] of data.customerMH) {
        totalByCustomer.set(cust, (totalByCustomer.get(cust) ?? 0) + mh);
      }
    }

    result.push({
      date,
      totalDemandMH,
      aircraftCount: allAircraft.size,
      byCustomer: Object.fromEntries(totalByCustomer),
      byShift,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
