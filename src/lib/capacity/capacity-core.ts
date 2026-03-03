/**
 * Capacity Core Compute Engine (v0.3.0)
 *
 * Pure computation functions for capacity math — zero DB dependencies.
 * All functions take data as arguments and return computed results.
 *
 * Key algorithms:
 * 1. Headcount resolution: weekday > base > 0 (most specific wins)
 * 2. Productive hours: paidHours × paidToAvailable × availableToProductive × nightFactor
 * 3. Utilization: demandMH / productiveMH (null when productiveMH = 0)
 */

import type {
  CapacityShift,
  CapacityAssumptions,
  HeadcountPlan,
  HeadcountException,
  ShiftCapacityV2,
  DailyCapacityV2,
  DailyDemandV2,
  DailyUtilizationV2,
  ShiftUtilizationV2,
  CapacitySummary,
} from "@/types";

// ─── Headcount Resolution ──────────────────────────────────────────────────

/**
 * Resolve effective headcount for a given date and shift.
 *
 * Resolution order:
 * 1. Filter plans by shiftId and effective date range
 * 2. Among matching plans, prefer dayOfWeek-specific over dayOfWeek=null
 * 3. Among ties, latest effectiveFrom wins
 * 4. Sum exception deltas for that date+shift
 * 5. Floor result at 0
 */
export function resolveHeadcount(
  date: string,
  shiftId: number,
  plans: HeadcountPlan[],
  exceptions: HeadcountException[],
): { headcount: number; hasExceptions: boolean } {
  const dayOfWeek = new Date(date + "T12:00:00Z").getUTCDay(); // 0=Sun..6=Sat

  // Filter plans applicable to this shift and date range
  const applicable = plans.filter((p) => {
    if (p.shiftId !== shiftId) return false;
    if (p.effectiveFrom > date) return false;
    if (p.effectiveTo && p.effectiveTo < date) return false;
    return true;
  });

  // Separate into dayOfWeek-specific and generic plans
  const dowSpecific = applicable.filter((p) => p.dayOfWeek === dayOfWeek);
  const generic = applicable.filter((p) => p.dayOfWeek === null);

  // Pick the best plan: dayOfWeek-specific preferred, then latest effectiveFrom
  const candidates = dowSpecific.length > 0 ? dowSpecific : generic;
  candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  const basePlan = candidates[0];
  const baseHeadcount = basePlan ? basePlan.headcount : 0;

  // Sum exception deltas for this date+shift
  const deltas = exceptions.filter((e) => e.shiftId === shiftId && e.exceptionDate === date);
  const totalDelta = deltas.reduce((sum, e) => sum + e.headcountDelta, 0);
  const hasExceptions = deltas.length > 0;

  return {
    headcount: Math.max(0, baseHeadcount + totalDelta),
    hasExceptions,
  };
}

// ─── Productive Hours ──────────────────────────────────────────────────────

/**
 * Compute productive MH per person for a given shift and assumptions.
 *
 * Formula: paidHours × paidToAvailable × (availableToProductive × nightFactor)
 *
 * Night factor adjusts productive efficiency only — it multiplies with
 * availableToProductive, not with the entire chain.
 */
export function computeProductiveHoursPerPerson(
  shift: CapacityShift,
  assumptions: CapacityAssumptions,
): number {
  const isNight = shift.code === "NIGHT";
  const nightFactor = isNight ? assumptions.nightProductivityFactor : 1.0;

  return shift.paidHours * assumptions.availableToProductive * nightFactor;
}

// ─── Daily Capacity ────────────────────────────────────────────────────────

/**
 * Compute capacity for a range of dates with per-shift breakdown.
 * Returns DailyCapacityV2[] — one entry per date.
 */
/**
 * Determine if a shift is non-operating on a given date.
 * Used for schedule-aware validation — non-operating shifts should not
 * generate "below minimum" warnings.
 *
 * - Staffing mode: checks nonOperatingShifts map (rotation-derived)
 * - Headcount/none mode: headcount === 0 → effectively non-operating
 */
export function isShiftNonOperatingOnDate(
  date: string,
  shiftCode: string,
  resolvedHeadcount: number,
  nonOperatingShifts?: Map<string, Set<string>>,
): boolean {
  if (nonOperatingShifts && nonOperatingShifts.size > 0) {
    return nonOperatingShifts.get(date)?.has(shiftCode) ?? false;
  }
  return resolvedHeadcount === 0;
}

export function computeDailyCapacityV2(
  dates: string[],
  shifts: CapacityShift[],
  plans: HeadcountPlan[],
  exceptions: HeadcountException[],
  assumptions: CapacityAssumptions,
): DailyCapacityV2[] {
  const activeShifts = shifts.filter((s) => s.isActive);

  return dates.map((date) => {
    const byShift: ShiftCapacityV2[] = activeShifts.map((shift) => {
      const { headcount, hasExceptions } = resolveHeadcount(date, shift.id, plans, exceptions);
      const effectiveHeadcount = headcount * assumptions.paidToAvailable;

      const productiveMHPerPerson = computeProductiveHoursPerPerson(shift, assumptions);
      const paidMH = effectiveHeadcount * shift.paidHours;
      const availableMH = paidMH;
      const productiveMH = effectiveHeadcount * productiveMHPerPerson;

      const isNonOp = headcount === 0;

      return {
        shiftCode: shift.code,
        shiftName: shift.name,
        rosterHeadcount: headcount,
        effectiveHeadcount,
        paidHoursPerPerson: shift.paidHours,
        paidMH,
        availableMH,
        productiveMH,
        hasExceptions,
        belowMinHeadcount: !isNonOp && headcount < shift.minHeadcount,
        isNonOperating: isNonOp,
      };
    });

    const totalProductiveMH = byShift.reduce((sum, s) => sum + s.productiveMH, 0);
    const totalPaidMH = byShift.reduce((sum, s) => sum + s.paidMH, 0);
    const hasExceptions = byShift.some((s) => s.hasExceptions);

    return {
      date,
      totalProductiveMH,
      totalPaidMH,
      byShift,
      hasExceptions,
    };
  });
}

/**
 * Compute capacity from the rotation-based staffing matrix.
 * Uses per-date headcount and effectivePaidHours from the staffing engine
 * instead of static headcount plans.
 */
export function computeDailyCapacityFromStaffing(
  dates: string[],
  shifts: CapacityShift[],
  staffingMap: Map<string, Map<string, { headcount: number; effectivePaidHours: number }>>,
  assumptions: CapacityAssumptions,
  nonOperatingShifts?: Map<string, Set<string>>,
): DailyCapacityV2[] {
  const activeShifts = shifts.filter((s) => s.isActive);

  return dates.map((date) => {
    const dayStaffing = staffingMap.get(date);

    const byShift: ShiftCapacityV2[] = activeShifts.map((shift) => {
      const staffing = dayStaffing?.get(shift.code);
      const headcount = staffing?.headcount ?? 0;
      const paidHoursPerPerson = staffing?.effectivePaidHours ?? shift.paidHours;
      const effectiveHeadcount = headcount * assumptions.paidToAvailable;

      const isNight = shift.code === "NIGHT";
      const nightFactor = isNight ? assumptions.nightProductivityFactor : 1.0;
      const productiveMHPerPerson =
        paidHoursPerPerson * assumptions.availableToProductive * nightFactor;

      const paidMH = effectiveHeadcount * paidHoursPerPerson;
      const availableMH = paidMH;
      const productiveMH = effectiveHeadcount * productiveMHPerPerson;

      const isNonOp = isShiftNonOperatingOnDate(date, shift.code, headcount, nonOperatingShifts);

      return {
        shiftCode: shift.code,
        shiftName: shift.name,
        rosterHeadcount: headcount,
        effectiveHeadcount,
        paidHoursPerPerson,
        paidMH,
        availableMH,
        productiveMH,
        hasExceptions: false,
        belowMinHeadcount: !isNonOp && headcount < shift.minHeadcount,
        isNonOperating: isNonOp,
      };
    });

    const totalProductiveMH = byShift.reduce((sum, s) => sum + s.productiveMH, 0);
    const totalPaidMH = byShift.reduce((sum, s) => sum + s.paidMH, 0);

    return {
      date,
      totalProductiveMH,
      totalPaidMH,
      byShift,
      hasExceptions: false,
    };
  });
}

// ─── Utilization ───────────────────────────────────────────────────────────

/**
 * Compute utilization by joining demand and capacity data.
 * Handles edge case: productiveMH = 0 → utilization: null, gapMH: -demandMH.
 */
export function computeUtilizationV2(
  demand: DailyDemandV2[],
  capacity: DailyCapacityV2[],
): DailyUtilizationV2[] {
  const capacityMap = new Map(capacity.map((c) => [c.date, c]));
  const demandMap = new Map(demand.map((d) => [d.date, d]));

  // Use union of all dates from both demand and capacity
  const allDates = new Set([...capacityMap.keys(), ...demandMap.keys()]);
  const sortedDates = Array.from(allDates).sort();

  return sortedDates.map((date) => {
    const cap = capacityMap.get(date);
    const dem = demandMap.get(date);

    const totalDemandMH = dem?.totalDemandMH ?? 0;
    const totalProductiveMH = cap?.totalProductiveMH ?? 0;

    // Per-shift utilization
    const byShift: ShiftUtilizationV2[] = (cap?.byShift ?? []).map((shiftCap) => {
      const shiftDem = dem?.byShift.find((s) => s.shiftCode === shiftCap.shiftCode);
      const shiftDemandMH = shiftDem?.demandMH ?? 0;

      if (shiftCap.productiveMH === 0) {
        return {
          shiftCode: shiftCap.shiftCode,
          utilization: null,
          gapMH: -shiftDemandMH,
          demandMH: shiftDemandMH,
          productiveMH: 0,
          noCoverage: true,
        };
      }

      const utilization = (shiftDemandMH / shiftCap.productiveMH) * 100;
      return {
        shiftCode: shiftCap.shiftCode,
        utilization,
        gapMH: shiftCap.productiveMH - shiftDemandMH,
        demandMH: shiftDemandMH,
        productiveMH: shiftCap.productiveMH,
        noCoverage: false,
      };
    });

    const noCoverageDays = byShift.filter((s) => s.noCoverage).length;

    // Overall utilization
    let utilizationPercent: number | null;
    if (totalProductiveMH === 0) {
      utilizationPercent = null;
    } else {
      utilizationPercent = (totalDemandMH / totalProductiveMH) * 100;
    }

    const gapMH = totalProductiveMH - totalDemandMH;
    const overtimeFlag = utilizationPercent !== null && utilizationPercent > 100;
    const criticalFlag = utilizationPercent !== null && utilizationPercent > 120;

    return {
      date,
      utilizationPercent,
      totalDemandMH,
      totalProductiveMH,
      gapMH,
      overtimeFlag,
      criticalFlag,
      noCoverageDays,
      byShift,
    };
  });
}

// ─── Headcount Warnings ────────────────────────────────────────────────────

/**
 * Validate headcount coverage against minimum staffing requirements.
 * Returns warning strings for any shift+date where effective < min_headcount.
 */
export function validateHeadcountCoverage(
  capacity: DailyCapacityV2[],
  shifts: CapacityShift[],
): string[] {
  const warnings: string[] = [];
  const shiftMap = new Map(shifts.map((s) => [s.code, s]));

  for (const day of capacity) {
    for (const shiftCap of day.byShift) {
      const shift = shiftMap.get(shiftCap.shiftCode);
      if (shift && shiftCap.belowMinHeadcount && !shiftCap.isNonOperating) {
        warnings.push(
          `${day.date} ${shiftCap.shiftName}: roster headcount ${shiftCap.rosterHeadcount} below minimum ${shift.minHeadcount}`,
        );
      }
    }
  }

  return warnings;
}

// ─── Summary Statistics ────────────────────────────────────────────────────

/**
 * Compute summary statistics from utilization data.
 */
export function computeCapacitySummary(utilization: DailyUtilizationV2[]): CapacitySummary {
  if (utilization.length === 0) {
    return {
      avgUtilization: null,
      peakUtilization: null,
      totalDemandMH: 0,
      totalCapacityMH: 0,
      criticalDays: 0,
      overtimeDays: 0,
      worstDeficit: null,
      noCoverageDays: 0,
    };
  }

  const validUtils = utilization
    .map((u) => u.utilizationPercent)
    .filter((u): u is number => u !== null);

  const avgUtilization =
    validUtils.length > 0 ? validUtils.reduce((sum, u) => sum + u, 0) / validUtils.length : null;

  const peakUtilization = validUtils.length > 0 ? Math.max(...validUtils) : null;

  const totalDemandMH = utilization.reduce((sum, u) => sum + u.totalDemandMH, 0);
  const totalCapacityMH = utilization.reduce((sum, u) => sum + u.totalProductiveMH, 0);
  const criticalDays = utilization.filter((u) => u.criticalFlag).length;
  const overtimeDays = utilization.filter((u) => u.overtimeFlag).length;
  const noCoverageDays = utilization.reduce((sum, u) => sum + u.noCoverageDays, 0);

  // Find worst per-shift deficit
  let worstDeficit: { date: string; shift: string; gapMH: number } | null = null;
  for (const day of utilization) {
    for (const shift of day.byShift) {
      if (worstDeficit === null || shift.gapMH < worstDeficit.gapMH) {
        worstDeficit = { date: day.date, shift: shift.shiftCode, gapMH: shift.gapMH };
      }
    }
  }

  return {
    avgUtilization,
    peakUtilization,
    totalDemandMH,
    totalCapacityMH,
    criticalDays,
    overtimeDays,
    worstDeficit,
    noCoverageDays,
  };
}

/**
 * Derive which shifts are non-operating per date from the staffing aggregation map.
 * A shift is non-operating on a date if it has NO entry in the staffing map
 * (meaning the rotation schedule assigns zero people to that shift category).
 *
 * ONLY valid in staffing mode — headcount mode has no schedule authority.
 * Returns empty map when called with undefined/null staffingMap.
 */
export function deriveNonOperatingFromStaffing(
  staffingMap:
    | Map<string, Map<string, { headcount: number; effectivePaidHours: number }>>
    | undefined,
  allShiftCodes: string[],
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  if (!staffingMap) return result;

  for (const [date, shiftMap] of staffingMap) {
    const nonOp = new Set<string>();
    for (const code of allShiftCodes) {
      if (!shiftMap.has(code)) {
        nonOp.add(code);
      }
    }
    // Only add if at least one shift operates (prevent degenerate all-excluded case)
    if (nonOp.size > 0 && nonOp.size < allShiftCodes.length) {
      result.set(date, nonOp);
    }
  }
  return result;
}
