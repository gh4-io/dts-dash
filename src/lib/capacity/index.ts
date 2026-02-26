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
  computeDailyCapacityFromStaffing,
  computeUtilizationV2,
  validateHeadcountCoverage,
  computeCapacitySummary,
  deriveNonOperatingFromStaffing,
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
  computeCoverageGaps,
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

// Allocation engine (pure functions)
export {
  findMatchingAllocations,
  computeAllocatedMH,
  applyAllocations,
  validateContract,
  computeContractProjection,
  getProjectionStatus,
} from "./allocation-engine";

// Allocation data access (CRUD)
export {
  loadDemandContracts,
  loadDemandContract,
  createDemandContract,
  updateDemandContract,
  deleteDemandContract,
  loadCustomerNameMap,
  loadPerEventContractMap,
} from "./allocation-data";

// Flight events engine (pure functions)
export {
  computeEventWindows,
  computeAllEventWindows,
  computeCoverageRequirements,
  computeConcurrencyPressure,
  validateFlightEvent,
  expandRecurringEvent,
  VALID_STATUSES as VALID_FLIGHT_EVENT_STATUSES,
} from "./flight-events-engine";

// Event attribution engine (G-10, pure functions)
export {
  aggregateCoverageByCustomer,
  summarizeEventsByCustomer,
  buildCustomerCoverageMap,
} from "./event-attribution-engine";

// Concurrency pressure analysis (P2-4, pure functions)
export {
  aggregateConcurrencyByDay,
  aggregateConcurrencyByShift,
  applyConcurrencyPressure,
  computeConcurrencyPressureIndex,
} from "./concurrency-engine";

// Flight events data access (CRUD)
export {
  loadFlightEvents,
  loadFlightEvent,
  createFlightEvent,
  updateFlightEvent,
  deleteFlightEvent,
} from "./flight-events-data";

// Forecast day-of-week pattern (pure functions)
export { computeDayOfWeekPattern } from "./forecast-pattern-engine";
export type { DayOfWeekPattern, ForecastPatternResult } from "./forecast-pattern-engine";

// Forecast engine (pure functions)
export {
  generateForecast,
  applyForecastRates,
  extractHistoricalSeries,
  computeMovingAverage,
  computeWeightedAverage,
  fitLinearRegression,
  validateForecastModel,
  validateForecastRate,
} from "./forecast-engine";

// Time bookings engine (pure functions)
export {
  aggregateWorkedHours,
  applyWorkedHours,
  computeVariance,
  validateTimeBooking,
} from "./time-bookings-engine";

// Time bookings data access (CRUD)
export {
  loadTimeBookings,
  loadTimeBooking,
  createTimeBooking,
  updateTimeBooking,
  deleteTimeBooking,
} from "./time-bookings-data";

// Billing engine (pure functions)
export {
  aggregateBilledHours,
  applyBilledHours,
  computeBillingVariance,
  validateBillingEntry,
} from "./billing-engine";

// Billing data access (CRUD)
export {
  loadBillingEntries,
  loadBillingEntry,
  createBillingEntry,
  updateBillingEntry,
  deleteBillingEntry,
} from "./billing-data";

// Timezone helpers (pure functions)
export { getLocalHour, getLocalDateStr, isValidTimezone } from "./tz-helpers";

// Lens configuration (P2-7, pure constants)
export { CAPACITY_LENSES, getAvailableLenses } from "./lens-config";
export type { CapacityLensDefinition } from "./lens-config";

// Forecast data access (CRUD)
export {
  loadForecastModels,
  loadForecastModel,
  createForecastModel,
  updateForecastModel,
  deleteForecastModel,
  loadActiveForecastModel,
  loadForecastRates,
  loadForecastRate,
  createForecastRate,
  bulkInsertForecastRates,
  updateForecastRate,
  deleteForecastRate,
  clearGeneratedRates,
} from "./forecast-data";

// Rolling forecast engine (E-01, pure functions)
export { computeRollingForecast } from "./rolling-forecast-engine";

// Monthly rollup engine (G-09, pure functions)
export { aggregateMonthlyRollup } from "./monthly-rollup-engine";

// Scenario engine (E-02, pure functions)
export { applyDemandScenario, DEMAND_SCENARIOS } from "./scenario-engine";

// Gap analysis engine (E-03, pure functions)
export { computeGapSummary } from "./gap-engine";

// Weekly MH Projections engine (TEMPORARY — OI-067, pure functions)
export {
  validateProjectionEntry,
  buildProjectionOverlay,
  hasProjectionData,
} from "./projection-engine";
export type { ProjectionValidation } from "./projection-engine";

// Weekly MH Projections data access (TEMPORARY — OI-067)
export {
  loadWeeklyProjections,
  bulkSaveProjections,
  deleteAllProjections,
} from "./projection-data";
export type { ProjectionUpsertRow } from "./projection-data";
