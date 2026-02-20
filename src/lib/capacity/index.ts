/**
 * Capacity Modeling Module (v0.3.0)
 *
 * Public API for the capacity modeling system.
 */

// Core compute engine (pure functions)
export {
  resolveHeadcount,
  computeProductiveHoursPerPerson,
  computeDailyCapacityV2,
  computeUtilizationV2,
  validateHeadcountCoverage,
  computeCapacitySummary,
} from "./capacity-core";

// Demand engine (pure functions)
export {
  resolveShiftForHour,
  enumerateGroundSlots,
  applyDemandCurve,
  validateDemandCurveWeights,
  computeDailyDemandV2,
} from "./demand-engine";
export type { DemandWorkPackage } from "./demand-engine";

// Data access layer (DB queries)
export { loadShifts, loadAssumptions, loadPlans, loadExceptions } from "./capacity-data";
