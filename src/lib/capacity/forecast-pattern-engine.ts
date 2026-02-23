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
  /** Average demand MH per customer for this weekday */
  avgDemandByCustomer: Record<string, number>;
  /** Average total productive capacity MH for this weekday */
  avgCapacityMH: number;
  /** Average forecasted demand MH (null if no forecast data for this day) */
  avgForecastedMH: number | null;
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
  count: number;
  shiftSums: Record<string, { sum: number; count: number }>;
  customerSums: Record<string, { sum: number; count: number }>;
}

function createEmptyBucket(): DayBucket {
  return {
    sumDemandMH: 0,
    sumCapacityMH: 0,
    sumForecastedMH: 0,
    forecastCount: 0,
    count: 0,
    shiftSums: {},
    customerSums: {},
  };
}

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
 * per-shift demand, and forecasted demand. Returns 7 entries ordered Monday-first.
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
        avgDemandMH: 0,
        avgDemandByShift: {},
        avgDemandByCustomer: {},
        avgCapacityMH: 0,
        avgForecastedMH: null,
        sampleCount: 0,
      })),
      totalWeeks: 0,
      dateRange: { start: "", end: "" },
    };
  }

  // Index capacity by date for O(1) lookup
  const capByDate = new Map<string, DailyCapacityV2>();
  for (const c of capacity) {
    capByDate.set(c.date, c);
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

    // Shift breakdown
    for (const shift of day.byShift) {
      if (!bucket.shiftSums[shift.shiftCode]) {
        bucket.shiftSums[shift.shiftCode] = { sum: 0, count: 0 };
      }
      bucket.shiftSums[shift.shiftCode].sum += shift.demandMH;
      bucket.shiftSums[shift.shiftCode].count += 1;
    }

    // Customer breakdown
    for (const [customerName, mh] of Object.entries(day.byCustomer)) {
      if (!bucket.customerSums[customerName]) {
        bucket.customerSums[customerName] = { sum: 0, count: 0 };
      }
      bucket.customerSums[customerName].sum += mh;
      bucket.customerSums[customerName].count += 1;
    }

    // Capacity
    const cap = capByDate.get(day.date);
    if (cap) {
      bucket.sumCapacityMH += cap.totalProductiveMH;
    }

    // Forecast overlay (only count entries that actually have the field)
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

  // Build result
  const pattern: DayOfWeekPattern[] = [1, 2, 3, 4, 5, 6, 7].map((dow) => {
    const bucket = buckets[dow];
    const count = bucket.count;

    if (count === 0) {
      return {
        dayOfWeek: dow,
        label: DAY_LABELS[dow],
        avgDemandMH: 0,
        avgDemandByShift: {},
        avgDemandByCustomer: {},
        avgCapacityMH: 0,
        avgForecastedMH: null,
        sampleCount: 0,
      };
    }

    const avgDemandByShift: Record<string, number> = {};
    for (const [code, acc] of Object.entries(bucket.shiftSums)) {
      avgDemandByShift[code] = round1(acc.sum / acc.count);
    }

    const avgDemandByCustomer: Record<string, number> = {};
    for (const [name, acc] of Object.entries(bucket.customerSums)) {
      avgDemandByCustomer[name] = round1(acc.sum / acc.count);
    }

    return {
      dayOfWeek: dow,
      label: DAY_LABELS[dow],
      avgDemandMH: round1(bucket.sumDemandMH / count),
      avgDemandByShift,
      avgDemandByCustomer,
      avgCapacityMH: round1(bucket.sumCapacityMH / count),
      avgForecastedMH:
        bucket.forecastCount > 0 ? round1(bucket.sumForecastedMH / bucket.forecastCount) : null,
      sampleCount: count,
    };
  });

  return {
    pattern,
    totalWeeks: isoWeeks.size,
    dateRange: { start: minDate, end: maxDate },
  };
}
