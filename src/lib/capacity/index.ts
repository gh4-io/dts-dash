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

// Staffing engine (pure functions)
export {
  isWorkingDay,
  computeEffectivePaidHours,
  resolveStaffingDay,
  computeWeeklyMatrix,
  resolveStaffingForCapacity,
  buildPatternMap,
  validatePattern,
  countWorkingDays,
} from "./staffing-engine";

// Staffing data access (rotation patterns, configs, shifts)
export {
  loadRotationPatterns,
  loadRotationPattern,
  createRotationPattern,
  updateRotationPattern,
  deleteRotationPattern,
  isRotationPatternInUse,
  loadStaffingConfigs,
  loadActiveStaffingConfig,
  loadStaffingConfig,
  createStaffingConfig,
  updateStaffingConfig,
  deleteStaffingConfig,
  activateStaffingConfig,
  duplicateStaffingConfig,
  loadStaffingShifts,
  createStaffingShift,
  updateStaffingShift,
  deleteStaffingShift,
  loadRotationPresets,
  loadRotationPresetCount,
} from "./staffing-data";
