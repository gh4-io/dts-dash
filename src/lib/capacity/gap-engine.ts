/**
 * Gap Analysis Engine (E-03)
 *
 * Pure computation functions for capacity gap analysis.
 * Aggregates existing gapMH values from utilization data
 * into summary metrics and classification.
 *
 * Zero DB dependencies — all data passed as arguments.
 */

import type { DailyUtilizationV2, GapSummary } from "@/types";

// ─── Private Helpers ──────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Compute gap summary from utilization data.
 *
 * Gap = productiveMH - demandMH (positive = surplus, negative = deficit)
 *
 * Classification by deficit ratio (deficitDays / totalDays):
 *   0       → "surplus"
 *   < 0.2   → "balanced"
 *   < 0.5   → "tight"
 *   >= 0.5  → "deficit"
 */
export function computeGapSummary(utilization: DailyUtilizationV2[]): GapSummary {
  if (utilization.length === 0) {
    return {
      avgDailyGapMH: 0,
      totalGapMH: 0,
      deficitDays: 0,
      surplusDays: 0,
      worstDayDeficit: null,
      worstShiftDeficit: null,
      avgGapByShift: {},
      classification: "balanced",
    };
  }

  let totalGapMH = 0;
  let deficitDays = 0;
  let surplusDays = 0;
  let worstDayDeficit: { date: string; gapMH: number } | null = null;
  let worstShiftDeficit: { date: string; shiftCode: string; gapMH: number } | null = null;

  // Per-shift accumulators
  const shiftGapSums: Record<string, number> = {};
  const shiftGapCounts: Record<string, number> = {};

  for (const u of utilization) {
    totalGapMH += u.gapMH;

    if (u.gapMH < 0) {
      deficitDays++;
    } else if (u.gapMH > 0) {
      surplusDays++;
    }
    // gapMH === 0 counts as neither

    // Track worst day deficit
    if (u.gapMH < 0 && (worstDayDeficit === null || u.gapMH < worstDayDeficit.gapMH)) {
      worstDayDeficit = { date: u.date, gapMH: round1(u.gapMH) };
    }

    // Per-shift analysis
    for (const s of u.byShift) {
      shiftGapSums[s.shiftCode] = (shiftGapSums[s.shiftCode] ?? 0) + s.gapMH;
      shiftGapCounts[s.shiftCode] = (shiftGapCounts[s.shiftCode] ?? 0) + 1;

      if (s.gapMH < 0 && (worstShiftDeficit === null || s.gapMH < worstShiftDeficit.gapMH)) {
        worstShiftDeficit = { date: u.date, shiftCode: s.shiftCode, gapMH: round1(s.gapMH) };
      }
    }
  }

  // Per-shift averages
  const avgGapByShift: Record<string, number> = {};
  for (const [code, sum] of Object.entries(shiftGapSums)) {
    const count = shiftGapCounts[code] ?? 1;
    avgGapByShift[code] = round1(sum / count);
  }

  // Classification
  const deficitRatio = deficitDays / utilization.length;
  let classification: GapSummary["classification"];
  if (deficitDays === 0) {
    classification = "surplus";
  } else if (deficitRatio < 0.2) {
    classification = "balanced";
  } else if (deficitRatio < 0.5) {
    classification = "tight";
  } else {
    classification = "deficit";
  }

  return {
    avgDailyGapMH: round1(totalGapMH / utilization.length),
    totalGapMH: round1(totalGapMH),
    deficitDays,
    surplusDays,
    worstDayDeficit,
    worstShiftDeficit,
    avgGapByShift,
    classification,
  };
}
