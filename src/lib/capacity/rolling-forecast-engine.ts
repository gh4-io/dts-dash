/**
 * Rolling Forecast Engine (E-01)
 *
 * Pure computation functions for rolling 8-week demand forecast.
 * Uses recency-weighted day-of-week averages from historical demand
 * to project demand forward.
 *
 * Zero DB dependencies — all data passed as arguments.
 */

import type { DailyDemandV2, RollingForecastDay, RollingForecastResult } from "@/types";

// ─── Private Helpers ──────────────────────────────────────────────────────

/** ISO day of week: 1=Mon..7=Sun */
function toIsoDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const jsDay = d.getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Compute a rolling forecast by projecting demand forward using
 * recency-weighted day-of-week patterns from historical data.
 *
 * @param demand - Historical daily demand data
 * @param options.weeksAhead - Number of weeks to forecast (default 8)
 * @param options.maxHistoryWeeks - Max weeks of history to use (default 12)
 */
export function computeRollingForecast(
  demand: DailyDemandV2[],
  options?: { weeksAhead?: number; maxHistoryWeeks?: number },
): RollingForecastResult {
  const weeksAhead = options?.weeksAhead ?? 8;
  const maxHistoryWeeks = options?.maxHistoryWeeks ?? 12;

  if (demand.length === 0) {
    return { forecastDays: [], weeksAhead, basedOnWeeks: 0, patternSource: "dayOfWeek" };
  }

  // Sort by date ascending
  const sorted = [...demand].sort((a, b) => a.date.localeCompare(b.date));

  const lastHistoricalDate = sorted[sorted.length - 1].date;

  // Cutoff: only use last N weeks of history
  const cutoffDate = addDays(lastHistoricalDate, -(maxHistoryWeeks * 7));

  const recentDemand = sorted.filter((d) => d.date >= cutoffDate);

  // Build recency-weighted day-of-week buckets (ISO 1=Mon..7=Sun)
  interface DowBucket {
    weightedSum: number;
    totalWeight: number;
    sampleCount: number;
    shiftWeightedSums: Record<string, number>;
    shiftTotalWeights: Record<string, number>;
  }

  const buckets = new Map<number, DowBucket>();
  for (let dow = 1; dow <= 7; dow++) {
    buckets.set(dow, {
      weightedSum: 0,
      totalWeight: 0,
      sampleCount: 0,
      shiftWeightedSums: {},
      shiftTotalWeights: {},
    });
  }

  for (const day of recentDemand) {
    const dow = toIsoDayOfWeek(day.date);
    const bucket = buckets.get(dow)!;

    // Compute weeksAgo for decay weighting
    const dayMs = new Date(day.date + "T12:00:00Z").getTime();
    const lastMs = new Date(lastHistoricalDate + "T12:00:00Z").getTime();
    const weeksAgo = Math.floor((lastMs - dayMs) / (7 * 24 * 60 * 60 * 1000));
    const weight = 1 / (1 + weeksAgo * 0.15);

    bucket.weightedSum += day.totalDemandMH * weight;
    bucket.totalWeight += weight;
    bucket.sampleCount++;

    // Per-shift
    for (const shift of day.byShift) {
      bucket.shiftWeightedSums[shift.shiftCode] =
        (bucket.shiftWeightedSums[shift.shiftCode] ?? 0) + shift.demandMH * weight;
      bucket.shiftTotalWeights[shift.shiftCode] =
        (bucket.shiftTotalWeights[shift.shiftCode] ?? 0) + weight;
    }
  }

  // Compute basedOnWeeks (unique week numbers in the data)
  const weekSet = new Set<string>();
  for (const day of recentDemand) {
    const d = new Date(day.date + "T12:00:00Z");
    // Use ISO week start (Monday) as key
    const dayOfWeek = d.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + mondayOffset);
    weekSet.add(monday.toISOString().slice(0, 10));
  }
  const basedOnWeeks = weekSet.size;

  // Generate forecast days
  const forecastDays: RollingForecastDay[] = [];
  const totalForecastDays = weeksAhead * 7;

  for (let i = 1; i <= totalForecastDays; i++) {
    const date = addDays(lastHistoricalDate, i);
    const dow = toIsoDayOfWeek(date);
    const bucket = buckets.get(dow)!;

    const forecastedDemandMH =
      bucket.totalWeight > 0 ? round1(bucket.weightedSum / bucket.totalWeight) : 0;

    const forecastedByShift: Record<string, number> = {};
    for (const [shiftCode, wSum] of Object.entries(bucket.shiftWeightedSums)) {
      const wTotal = bucket.shiftTotalWeights[shiftCode] ?? 0;
      forecastedByShift[shiftCode] = wTotal > 0 ? round1(wSum / wTotal) : 0;
    }

    // I-06: Confidence is based on per-DOW historical sample count, not horizon
    // distance. Day 1 and Day 56 of forecast share the same confidence for a
    // given weekday. This is acceptable because forecast accuracy depends more
    // on pattern stability (sample depth) than projection distance at 8 weeks.
    // Thresholds: high = 8+ samples, medium = 4–7 samples, low = 1–3 samples.
    let confidence: "high" | "medium" | "low";
    if (bucket.sampleCount >= 8) {
      confidence = "high";
    } else if (bucket.sampleCount >= 4) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    forecastDays.push({
      date,
      forecastedDemandMH,
      forecastedByShift,
      isForecast: true,
      confidence,
    });
  }

  return { forecastDays, weeksAhead, basedOnWeeks, patternSource: "dayOfWeek" };
}
