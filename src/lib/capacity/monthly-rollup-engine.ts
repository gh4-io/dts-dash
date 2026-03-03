/**
 * Monthly Roll-Up Engine (G-09)
 *
 * Pure computation functions for aggregating daily capacity data
 * into calendar-month buckets. Produces totals for demand, capacity,
 * utilization, gap, and lens overlays per month.
 *
 * Zero DB dependencies — all data passed as arguments.
 */

import type {
  DailyCapacityV2,
  DailyDemandV2,
  DailyUtilizationV2,
  MonthlyRollupBucket,
  MonthlyRollupResult,
  MonthlyShiftBucket,
} from "@/types";

// ─── Private Helpers ──────────────────────────────────────────────────────

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Round to 1 decimal place */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Extract "YYYY-MM" from a date string */
function toMonthKey(date: string): string {
  return date.slice(0, 7);
}

/** Format "YYYY-MM" → "Feb 2026" */
function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  return `${MONTH_SHORT[monthIdx]} ${yearStr}`;
}

/** Sum a numeric value from an optional field, tracking whether any non-undefined value was seen */
function accumulateOptional(current: number | null, value: number | undefined): number | null {
  if (value === undefined || value === null) return current;
  return (current ?? 0) + value;
}

// ─── Shift Accumulator ───────────────────────────────────────────────────

interface ShiftAccumulator {
  totalDemandMH: number;
  totalCapacityMH: number;
  totalGapMH: number;
  totalAllocatedMH: number | null;
  totalForecastedMH: number | null;
  totalWorkedMH: number | null;
  totalBilledMH: number | null;
  byCustomer: Record<string, number>;
}

function emptyShiftAccumulator(): ShiftAccumulator {
  return {
    totalDemandMH: 0,
    totalCapacityMH: 0,
    totalGapMH: 0,
    totalAllocatedMH: null,
    totalForecastedMH: null,
    totalWorkedMH: null,
    totalBilledMH: null,
    byCustomer: {},
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Aggregates daily demand, capacity, and utilization arrays into
 * calendar-month buckets with totals and per-shift breakdowns.
 */
export function aggregateMonthlyRollup(
  demand: DailyDemandV2[],
  capacity: DailyCapacityV2[],
  utilization: DailyUtilizationV2[],
): MonthlyRollupResult {
  if (demand.length === 0) {
    return { buckets: [], totalMonths: 0, dateRange: { start: "", end: "" } };
  }

  // Index capacity and utilization by date for O(1) lookup
  const capMap = new Map<string, DailyCapacityV2>();
  for (const c of capacity) capMap.set(c.date, c);

  const utilMap = new Map<string, DailyUtilizationV2>();
  for (const u of utilization) utilMap.set(u.date, u);

  // Group demand days by month key, preserving insertion order
  const monthGroups = new Map<string, DailyDemandV2[]>();
  for (const day of demand) {
    const mk = toMonthKey(day.date);
    const group = monthGroups.get(mk);
    if (group) {
      group.push(day);
    } else {
      monthGroups.set(mk, [day]);
    }
  }

  // Build buckets
  const buckets: MonthlyRollupBucket[] = [];

  for (const [monthKey, days] of monthGroups) {
    let totalDemandMH = 0;
    let totalCapacityMH = 0;
    let totalGapMH = 0;
    let totalAircraftCount = 0;
    let totalAllocatedMH: number | null = null;
    let totalForecastedMH: number | null = null;
    let totalWorkedMH: number | null = null;
    let totalBilledMH: number | null = null;
    const byCustomer: Record<string, number> = {};
    const shiftAccs = new Map<string, ShiftAccumulator>();

    for (const day of days) {
      totalDemandMH += day.totalDemandMH;
      totalAircraftCount += day.aircraftCount;

      // Lens overlays at day level
      totalAllocatedMH = accumulateOptional(totalAllocatedMH, day.totalAllocatedDemandMH);
      totalForecastedMH = accumulateOptional(totalForecastedMH, day.totalForecastedDemandMH);
      totalWorkedMH = accumulateOptional(totalWorkedMH, day.totalWorkedMH);
      totalBilledMH = accumulateOptional(totalBilledMH, day.totalBilledMH);

      // Per-customer at day level
      for (const [cust, mh] of Object.entries(day.byCustomer)) {
        byCustomer[cust] = (byCustomer[cust] ?? 0) + mh;
      }

      // Capacity for this day
      const cap = capMap.get(day.date);
      if (cap) {
        totalCapacityMH += cap.totalProductiveMH;

        // Per-shift capacity
        for (const sc of cap.byShift) {
          let acc = shiftAccs.get(sc.shiftCode);
          if (!acc) {
            acc = emptyShiftAccumulator();
            shiftAccs.set(sc.shiftCode, acc);
          }
          acc.totalCapacityMH += sc.productiveMH;
        }
      }

      // Utilization (for gap) for this day
      const util = utilMap.get(day.date);
      if (util) {
        totalGapMH += util.gapMH;

        // Per-shift utilization gap
        for (const su of util.byShift) {
          let acc = shiftAccs.get(su.shiftCode);
          if (!acc) {
            acc = emptyShiftAccumulator();
            shiftAccs.set(su.shiftCode, acc);
          }
          acc.totalGapMH += su.gapMH;
        }
      }

      // Per-shift demand + lens overlays + customer
      for (const sd of day.byShift) {
        let acc = shiftAccs.get(sd.shiftCode);
        if (!acc) {
          acc = emptyShiftAccumulator();
          shiftAccs.set(sd.shiftCode, acc);
        }
        acc.totalDemandMH += sd.demandMH;
        acc.totalAllocatedMH = accumulateOptional(acc.totalAllocatedMH, sd.allocatedDemandMH);
        acc.totalForecastedMH = accumulateOptional(acc.totalForecastedMH, sd.forecastedDemandMH);
        acc.totalWorkedMH = accumulateOptional(acc.totalWorkedMH, sd.workedMH);
        acc.totalBilledMH = accumulateOptional(acc.totalBilledMH, sd.billedMH);

        // Per-customer per-shift
        for (const wp of sd.wpContributions) {
          acc.byCustomer[wp.customer] = (acc.byCustomer[wp.customer] ?? 0) + wp.allocatedMH;
        }
      }
    }

    // Build per-shift buckets
    const byShift: MonthlyShiftBucket[] = [];
    for (const [shiftCode, acc] of shiftAccs) {
      byShift.push({
        shiftCode,
        totalDemandMH: round1(acc.totalDemandMH),
        totalCapacityMH: round1(acc.totalCapacityMH),
        avgUtilization:
          acc.totalCapacityMH > 0 ? round1((acc.totalDemandMH / acc.totalCapacityMH) * 100) : null,
        totalGapMH: round1(acc.totalGapMH),
        totalAllocatedMH: acc.totalAllocatedMH !== null ? round1(acc.totalAllocatedMH) : null,
        totalForecastedMH: acc.totalForecastedMH !== null ? round1(acc.totalForecastedMH) : null,
        totalWorkedMH: acc.totalWorkedMH !== null ? round1(acc.totalWorkedMH) : null,
        totalBilledMH: acc.totalBilledMH !== null ? round1(acc.totalBilledMH) : null,
        byCustomer: acc.byCustomer,
      });
    }

    // Sort shifts by conventional order: DAY, SWING, NIGHT
    const SHIFT_ORDER: Record<string, number> = { DAY: 0, SWING: 1, NIGHT: 2 };
    byShift.sort((a, b) => (SHIFT_ORDER[a.shiftCode] ?? 99) - (SHIFT_ORDER[b.shiftCode] ?? 99));

    buckets.push({
      monthKey,
      label: formatMonthLabel(monthKey),
      dayCount: days.length,
      totalDemandMH: round1(totalDemandMH),
      totalCapacityMH: round1(totalCapacityMH),
      avgUtilizationPercent:
        totalCapacityMH > 0 ? round1((totalDemandMH / totalCapacityMH) * 100) : null,
      totalGapMH: round1(totalGapMH),
      totalAircraftCount,
      totalAllocatedMH: totalAllocatedMH !== null ? round1(totalAllocatedMH) : null,
      totalForecastedMH: totalForecastedMH !== null ? round1(totalForecastedMH) : null,
      totalWorkedMH: totalWorkedMH !== null ? round1(totalWorkedMH) : null,
      totalBilledMH: totalBilledMH !== null ? round1(totalBilledMH) : null,
      byShift,
      byCustomer,
    });
  }

  // Sort buckets chronologically
  buckets.sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  // Compute date range from demand array (already sorted assumption not required)
  const dates = demand.map((d) => d.date).sort();
  return {
    buckets,
    totalMonths: buckets.length,
    dateRange: { start: dates[0], end: dates[dates.length - 1] },
  };
}
