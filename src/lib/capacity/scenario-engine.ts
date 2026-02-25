/**
 * Scenario Engine (E-02)
 *
 * Pure computation functions for demand scenario modeling.
 * Applies demand multipliers to create "what-if" scenarios
 * and recomputes utilization + summary.
 *
 * Zero DB dependencies — all data passed as arguments.
 */

import type { DailyDemandV2, DailyCapacityV2, DemandScenario, ScenarioResult } from "@/types";
import { computeUtilizationV2, computeCapacitySummary } from "./capacity-core";

// ─── Predefined Scenarios ─────────────────────────────────────────────────

export const DEMAND_SCENARIOS: readonly DemandScenario[] = [
  { id: "baseline", label: "Baseline", demandMultiplier: 1.0 },
  { id: "plus10", label: "+10% Demand", demandMultiplier: 1.1 },
] as const;

// ─── Private Helpers ──────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Apply a demand scenario by scaling demand values and recomputing
 * utilization and summary.
 *
 * Key constraint: lens overlay values (allocatedDemandMH, forecastedDemandMH,
 * workedMH, billedMH, peakConcurrency) are NEVER scaled — they represent
 * independent data sources.
 */
export function applyDemandScenario(
  demand: DailyDemandV2[],
  capacity: DailyCapacityV2[],
  scenario: DemandScenario,
): ScenarioResult {
  const { demandMultiplier, id: scenarioId } = scenario;

  // Shortcut: baseline returns original data recomputed
  if (demandMultiplier === 1.0) {
    const utilization = computeUtilizationV2(demand, capacity);
    const summary = computeCapacitySummary(utilization);
    return { scenarioId, demand, utilization, summary };
  }

  // Deep-copy and scale demand
  const scaledDemand: DailyDemandV2[] = demand.map((d) => {
    const scaledByCustomer: Record<string, number> = {};
    for (const [customer, mh] of Object.entries(d.byCustomer)) {
      scaledByCustomer[customer] = round1(mh * demandMultiplier);
    }

    return {
      ...d,
      totalDemandMH: round1(d.totalDemandMH * demandMultiplier),
      byCustomer: scaledByCustomer,
      byShift: d.byShift.map((s) => ({
        ...s,
        demandMH: round1(s.demandMH * demandMultiplier),
        // R-05: wpContributions.allocatedMH IS scaled — it's WP-level demand
        // (how many MH this work package contributes to shift demand). This is
        // distinct from allocatedDemandMH below, which is a lens overlay value
        // from demand contracts and must NOT be scaled.
        wpContributions: s.wpContributions.map((wp) => ({
          ...wp,
          allocatedMH: round1(wp.allocatedMH * demandMultiplier),
        })),
        // DO NOT scale lens overlays — these are independent data sources
        allocatedDemandMH: s.allocatedDemandMH,
        forecastedDemandMH: s.forecastedDemandMH,
        workedMH: s.workedMH,
        billedMH: s.billedMH,
        peakConcurrency: s.peakConcurrency,
        avgConcurrency: s.avgConcurrency,
      })),
      // DO NOT scale lens overlays at day level
      totalAllocatedDemandMH: d.totalAllocatedDemandMH,
      totalForecastedDemandMH: d.totalForecastedDemandMH,
      totalWorkedMH: d.totalWorkedMH,
      totalBilledMH: d.totalBilledMH,
      peakConcurrency: d.peakConcurrency,
      avgConcurrency: d.avgConcurrency,
    };
  });

  const utilization = computeUtilizationV2(scaledDemand, capacity);
  const summary = computeCapacitySummary(utilization);

  return { scenarioId, demand: scaledDemand, utilization, summary };
}
