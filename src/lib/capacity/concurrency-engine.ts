/**
 * Concurrency Pressure Engine (P2-4)
 *
 * Higher-level aggregation and overlay for concurrency data.
 * Builds on computeConcurrencyPressure() from flight-events-engine.ts
 * which produces hourly ConcurrencyBucket[].
 *
 * Pure functions — zero DB imports.
 */

import type {
  ConcurrencyBucket,
  ConcurrencyDaySummary,
  ConcurrencyShiftSummary,
  CapacityShift,
  DailyDemandV2,
} from "@/types";
import { resolveShiftForHour } from "./demand-engine";
import { getLocalHour, getLocalDateStr } from "./tz-helpers";

/**
 * Aggregate hourly concurrency buckets into per-day summaries.
 * Groups by date in the shift timezone.
 *
 * @param timezone - IANA timezone for date grouping (default: "UTC")
 */
export function aggregateConcurrencyByDay(
  buckets: ConcurrencyBucket[],
  timezone: string = "UTC",
): Map<string, ConcurrencyDaySummary> {
  if (buckets.length === 0) return new Map();

  // Group buckets by date in shift timezone
  const byDate = new Map<string, ConcurrencyBucket[]>();
  for (const b of buckets) {
    const date = getLocalDateStr(new Date(b.hour), timezone);
    const existing = byDate.get(date);
    if (existing) {
      existing.push(b);
    } else {
      byDate.set(date, [b]);
    }
  }

  const result = new Map<string, ConcurrencyDaySummary>();
  for (const [date, dayBuckets] of byDate) {
    let peak = 0;
    let peakHour: string | null = null;
    let total = 0;
    let concurrencyHours = 0;

    for (const b of dayBuckets) {
      total += b.aircraftCount;
      if (b.aircraftCount >= 2) {
        concurrencyHours++;
      }
      if (b.aircraftCount > peak) {
        peak = b.aircraftCount;
        peakHour = b.hour;
      }
    }

    result.set(date, {
      peakAircraft: peak,
      avgAircraft: Math.round((total / dayBuckets.length) * 100) / 100,
      concurrencyHours,
      peakHour,
    });
  }

  return result;
}

/**
 * Aggregate hourly concurrency buckets into per-shift-per-day summaries.
 * Uses resolveShiftForHour to map each bucket's hour to its shift in the configured timezone.
 * Buckets that don't map to any shift are silently skipped.
 *
 * @param timezone - IANA timezone for shift hour interpretation (default: "UTC")
 */
export function aggregateConcurrencyByShift(
  buckets: ConcurrencyBucket[],
  shifts: CapacityShift[],
  timezone: string = "UTC",
): Map<string, Map<string, ConcurrencyShiftSummary>> {
  if (buckets.length === 0 || shifts.length === 0) return new Map();

  // Group by (date, shiftCode) using shift timezone
  const grouped = new Map<string, Map<string, ConcurrencyBucket[]>>();

  for (const b of buckets) {
    const d = new Date(b.hour);
    const localHour = getLocalHour(d, timezone);
    const shift = resolveShiftForHour(localHour, shifts);
    if (!shift) continue;

    const date = getLocalDateStr(d, timezone);
    let dateMap = grouped.get(date);
    if (!dateMap) {
      dateMap = new Map();
      grouped.set(date, dateMap);
    }
    const shiftBuckets = dateMap.get(shift.code);
    if (shiftBuckets) {
      shiftBuckets.push(b);
    } else {
      dateMap.set(shift.code, [b]);
    }
  }

  // Compute summaries
  const result = new Map<string, Map<string, ConcurrencyShiftSummary>>();
  for (const [date, shiftMap] of grouped) {
    const summaryMap = new Map<string, ConcurrencyShiftSummary>();
    for (const [shiftCode, shiftBuckets] of shiftMap) {
      let peak = 0;
      let total = 0;
      let concurrencyHours = 0;

      for (const b of shiftBuckets) {
        total += b.aircraftCount;
        if (b.aircraftCount >= 2) concurrencyHours++;
        if (b.aircraftCount > peak) peak = b.aircraftCount;
      }

      summaryMap.set(shiftCode, {
        shiftCode,
        peakAircraft: peak,
        avgAircraft: Math.round((total / shiftBuckets.length) * 100) / 100,
        concurrencyHours,
      });
    }
    result.set(date, summaryMap);
  }

  return result;
}

/**
 * Overlay concurrency pressure data onto demand days/shifts.
 * Sets peakConcurrency and avgConcurrency on each DailyDemandV2 and ShiftDemandV2.
 * Returns demand unchanged if no concurrency data (short-circuit).
 *
 * Informational only — does NOT affect utilization calculation (D-045).
 */
export function applyConcurrencyPressure(
  demand: DailyDemandV2[],
  dailyAgg: Map<string, ConcurrencyDaySummary>,
  shiftAgg: Map<string, Map<string, ConcurrencyShiftSummary>>,
): DailyDemandV2[] {
  if (dailyAgg.size === 0) return demand;

  return demand.map((day) => {
    const daySummary = dailyAgg.get(day.date);
    if (!daySummary) return day;

    const dayShiftMap = shiftAgg.get(day.date);
    const byShift = day.byShift.map((s) => {
      const shiftSummary = dayShiftMap?.get(s.shiftCode);
      if (shiftSummary) {
        return {
          ...s,
          peakConcurrency: shiftSummary.peakAircraft,
          avgConcurrency: shiftSummary.avgAircraft,
        };
      }
      return s;
    });

    return {
      ...day,
      peakConcurrency: daySummary.peakAircraft,
      avgConcurrency: daySummary.avgAircraft,
      byShift,
    };
  });
}

/**
 * Compute a normalized concurrency pressure index.
 * Ratio of peak concurrent aircraft to available headcount.
 * Higher values indicate more pressure per person.
 *
 * Returns 0 if capacityHeadcount <= 0 or peak is 0.
 * Not clamped — values above 100 indicate peak aircraft exceeds headcount.
 */
export function computeConcurrencyPressureIndex(peak: number, capacityHeadcount: number): number {
  if (peak <= 0 || capacityHeadcount <= 0) return 0;
  return Math.round((peak / capacityHeadcount) * 10000) / 100;
}
