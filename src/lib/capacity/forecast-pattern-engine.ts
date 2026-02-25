/**
 * Forecast Pattern Engine — Day-of-Week Aggregation
 *
 * Aggregates demand and capacity data by day-of-week (Mon–Sun) to produce
 * a "typical week" pattern for the Forecast lens. Pure functions, zero DB imports.
 */

import type { DailyDemandV2, DailyCapacityV2 } from "@/types";

// --- Types ---

export interface DayOfWeekPattern {
  /** ISO 8601 day: 1=Mon, 2=Tue, ... 7=Sun */
  dayOfWeek: number;
  /** Short label: "Mon", "Tue", etc. */
  label: string;
  /** Average total demand MH for this weekday */
  avgDemandMH: number;
  /** Average demand MH per shift for this weekday */
  avgDemandByShift: Record<string, number>;
  /** Average demand MH per customer per shift: shiftCode → customer → avg MH */
  avgDemandByCustomerByShift: Record<string, Record<string, number>>;
  /** Average total productive capacity MH for this weekday */
  avgCapacityMH: number;
  /** Average productive capacity MH per shift */
  avgCapacityByShift: Record<string, number>;
  /** Average forecasted demand MH (null if no forecast data for this day) */
  avgForecastedMH: number | null;
  /** Average forecasted demand MH per shift */
  avgForecastedByShift: Record<string, number>;
  /** Average allocated demand MH per shift */
  avgAllocatedByShift: Record<string, number>;
  /** Number of dates that contributed to this average */
  sampleCount: number;
}

export interface ForecastPatternResult {
  /** 7 entries ordered Mon (1) through Sun (7) */
  pattern: DayOfWeekPattern[];
  /** Number of distinct ISO weeks represented in the dataset */
  totalWeeks: number;
  /** Date range of the source data */
  dateRange: { start: string; end: string };
}

// --- Constants ---

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

// --- Internal helpers ---

interface DayBucket {
  sumDemandMH: number;
  sumCapacityMH: number;
  sumForecastedMH: number;
  forecastCount: number;
  /** Number of demand dates contributing to this bucket */
  count: number;
  /** Number of capacity dates contributing to this bucket (independent of demand) */
  capacityCount: number;
  shiftSums: Record<string, { sum: number; count: number }>;
  /** shift → customer → running MH sum (divide by bucket.count for avg) */
  customerShiftSums: Record<string, Record<string, number>>;
  /** shift → running capacity MH sum (divide by bucket.capacityCount for avg) */
  capacityShiftSums: Record<string, number>;
  /** shift → { sum, count } for forecasted MH */
  forecastShiftSums: Record<string, { sum: number; count: number }>;
  /** shift → { sum, count } for allocated MH */
  allocatedShiftSums: Record<string, { sum: number; count: number }>;
}

function createEmptyBucket(): DayBucket {
  return {
    sumDemandMH: 0,
    sumCapacityMH: 0,
    sumForecastedMH: 0,
    forecastCount: 0,
    count: 0,
    capacityCount: 0,
    shiftSums: {},
    customerShiftSums: {},
    capacityShiftSums: {},
    forecastShiftSums: {},
    allocatedShiftSums: {},
  };
}

const EMPTY_PATTERN: Omit<DayOfWeekPattern, "dayOfWeek" | "label"> = {
  avgDemandMH: 0,
  avgDemandByShift: {},
  avgDemandByCustomerByShift: {},
  avgCapacityMH: 0,
  avgCapacityByShift: {},
  avgForecastedMH: null,
  avgForecastedByShift: {},
  avgAllocatedByShift: {},
  sampleCount: 0,
};

/** Convert JS getUTCDay() (0=Sun..6=Sat) to ISO 8601 (1=Mon..7=Sun) */
function toIsoDayOfWeek(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** Get ISO week number from a date string */
function getIsoWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 ... Sun=7
  // Set to nearest Thursday (ISO week definition)
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// --- Main function ---

/**
 * Aggregates demand and capacity data by day-of-week to produce a "typical week" pattern.
 *
 * Groups each date by its weekday (Mon–Sun), computes averages for demand, capacity,
 * per-shift demand, customer×shift demand, and forecasted/allocated demand.
 * Returns 7 entries ordered Monday-first.
 */
export function computeDayOfWeekPattern(
  demand: DailyDemandV2[],
  capacity: DailyCapacityV2[],
): ForecastPatternResult {
  // Empty case
  if (demand.length === 0) {
    return {
      pattern: [1, 2, 3, 4, 5, 6, 7].map((dow) => ({
        dayOfWeek: dow,
        label: DAY_LABELS[dow],
        ...EMPTY_PATTERN,
      })),
      totalWeeks: 0,
      dateRange: { start: "", end: "" },
    };
  }

  // Initialize 7 buckets (1=Mon ... 7=Sun)
  const buckets: Record<number, DayBucket> = {};
  for (let i = 1; i <= 7; i++) {
    buckets[i] = createEmptyBucket();
  }

  // Track ISO weeks and date range
  const isoWeeks = new Set<string>();
  let minDate = demand[0].date;
  let maxDate = demand[0].date;

  // Accumulate
  for (const day of demand) {
    const d = new Date(day.date + "T12:00:00Z");
    const isoDow = toIsoDayOfWeek(d.getUTCDay());
    const bucket = buckets[isoDow];

    bucket.sumDemandMH += day.totalDemandMH;
    bucket.count += 1;

    // Shift breakdown + customer×shift + forecast×shift + allocated×shift
    for (const shift of day.byShift) {
      if (!bucket.shiftSums[shift.shiftCode]) {
        bucket.shiftSums[shift.shiftCode] = { sum: 0, count: 0 };
      }
      bucket.shiftSums[shift.shiftCode].sum += shift.demandMH;
      bucket.shiftSums[shift.shiftCode].count += 1;

      // Customer×shift from wpContributions
      for (const wp of shift.wpContributions) {
        if (!bucket.customerShiftSums[shift.shiftCode]) {
          bucket.customerShiftSums[shift.shiftCode] = {};
        }
        const cs = bucket.customerShiftSums[shift.shiftCode];
        cs[wp.customer] = (cs[wp.customer] ?? 0) + wp.allocatedMH;
      }

      // Forecasted per shift
      if (shift.forecastedDemandMH != null) {
        if (!bucket.forecastShiftSums[shift.shiftCode]) {
          bucket.forecastShiftSums[shift.shiftCode] = { sum: 0, count: 0 };
        }
        bucket.forecastShiftSums[shift.shiftCode].sum += shift.forecastedDemandMH;
        bucket.forecastShiftSums[shift.shiftCode].count += 1;
      }

      // Allocated per shift
      if (shift.allocatedDemandMH != null) {
        if (!bucket.allocatedShiftSums[shift.shiftCode]) {
          bucket.allocatedShiftSums[shift.shiftCode] = { sum: 0, count: 0 };
        }
        bucket.allocatedShiftSums[shift.shiftCode].sum += shift.allocatedDemandMH;
        bucket.allocatedShiftSums[shift.shiftCode].count += 1;
      }
    }

    // Forecast overlay total (only count entries that actually have the field)
    if (day.totalForecastedDemandMH != null) {
      bucket.sumForecastedMH += day.totalForecastedDemandMH;
      bucket.forecastCount += 1;
    }

    // Track weeks and date range
    const year = d.getUTCFullYear();
    const week = getIsoWeekNumber(day.date);
    isoWeeks.add(`${year}-W${week}`);

    if (day.date < minDate) minDate = day.date;
    if (day.date > maxDate) maxDate = day.date;
  }

  // Accumulate capacity independently — covers all dates regardless of demand coverage.
  // This ensures days with no work packages still show correct capacity averages.
  for (const cap of capacity) {
    const d = new Date(cap.date + "T12:00:00Z");
    const isoDow = toIsoDayOfWeek(d.getUTCDay());
    const bucket = buckets[isoDow];
    bucket.sumCapacityMH += cap.totalProductiveMH;
    bucket.capacityCount += 1;
    for (const sc of cap.byShift) {
      bucket.capacityShiftSums[sc.shiftCode] =
        (bucket.capacityShiftSums[sc.shiftCode] ?? 0) + sc.productiveMH;
    }
  }

  // Build result
  const pattern: DayOfWeekPattern[] = [1, 2, 3, 4, 5, 6, 7].map((dow) => {
    const bucket = buckets[dow];
    const count = bucket.count;
    const capCount = bucket.capacityCount;

    if (count === 0 && capCount === 0) {
      return {
        dayOfWeek: dow,
        label: DAY_LABELS[dow],
        ...EMPTY_PATTERN,
      };
    }

    const avgDemandByShift: Record<string, number> = {};
    for (const [code, acc] of Object.entries(bucket.shiftSums)) {
      avgDemandByShift[code] = round1(acc.sum / acc.count);
    }

    const avgDemandByCustomerByShift: Record<string, Record<string, number>> = {};
    for (const [shiftCode, customers] of Object.entries(bucket.customerShiftSums)) {
      avgDemandByCustomerByShift[shiftCode] = {};
      for (const [customer, sum] of Object.entries(customers)) {
        avgDemandByCustomerByShift[shiftCode][customer] = round1(sum / count);
      }
    }

    // Capacity is averaged over its own date count, independent of demand coverage
    const avgCapacityByShift: Record<string, number> = {};
    for (const [code, sum] of Object.entries(bucket.capacityShiftSums)) {
      avgCapacityByShift[code] = capCount > 0 ? round1(sum / capCount) : 0;
    }

    const avgForecastedByShift: Record<string, number> = {};
    for (const [code, acc] of Object.entries(bucket.forecastShiftSums)) {
      avgForecastedByShift[code] = round1(acc.sum / acc.count);
    }

    const avgAllocatedByShift: Record<string, number> = {};
    for (const [code, acc] of Object.entries(bucket.allocatedShiftSums)) {
      avgAllocatedByShift[code] = round1(acc.sum / acc.count);
    }

    return {
      dayOfWeek: dow,
      label: DAY_LABELS[dow],
      avgDemandMH: count > 0 ? round1(bucket.sumDemandMH / count) : 0,
      avgDemandByShift,
      avgDemandByCustomerByShift,
      avgCapacityMH: capCount > 0 ? round1(bucket.sumCapacityMH / capCount) : 0,
      avgCapacityByShift,
      avgForecastedMH:
        bucket.forecastCount > 0 ? round1(bucket.sumForecastedMH / bucket.forecastCount) : null,
      avgForecastedByShift,
      avgAllocatedByShift,
      sampleCount: count,
    };
  });

  return {
    pattern,
    totalWeeks: isoWeeks.size,
    dateRange: { start: minDate, end: maxDate },
  };
}
