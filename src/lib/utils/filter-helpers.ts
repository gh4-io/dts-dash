import type { WorkPackage, FilterState, AircraftType } from "@/types";

/**
 * Filter Helpers
 * Parse filter query params from URL and apply filters to work packages
 */

/**
 * Parse filter query params from URLSearchParams
 * Returns FilterState with validated values
 */
export function parseFilterParams(query: URLSearchParams): Partial<FilterState> {
  const start = query.get("start");
  const end = query.get("end");
  const timezone = query.get("timezone");
  const operatorsRaw = query.get("operators");
  const aircraftRaw = query.get("aircraft");
  const typesRaw = query.get("types");

  const operators = operatorsRaw ? operatorsRaw.split(",").filter(Boolean) : [];
  const aircraft = aircraftRaw ? aircraftRaw.split(",").filter(Boolean) : [];
  const types = typesRaw ? (typesRaw.split(",").filter(Boolean) as AircraftType[]) : [];

  return {
    ...(start && { start }),
    ...(end && { end }),
    ...(timezone && { timezone }),
    ...(operators.length > 0 && { operators }),
    ...(aircraft.length > 0 && { aircraft }),
    ...(types.length > 0 && { types }),
  };
}

/**
 * Validate filter state
 * Ensures start <= end, valid dates, etc.
 */
export function validateFilterState(state: Partial<FilterState>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (state.start && state.end) {
    const startDate = new Date(state.start);
    const endDate = new Date(state.end);

    if (isNaN(startDate.getTime())) {
      errors.push("Invalid start date");
    }
    if (isNaN(endDate.getTime())) {
      errors.push("Invalid end date");
    }
    if (startDate > endDate) {
      errors.push("Start date must be before or equal to end date");
    }

    // Max 30-day range
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      errors.push("Date range cannot exceed 30 days");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Apply date-range filter only (no operator/aircraft/type filtering).
 * Used to scope the dataset by time window before extracting facets.
 */
export function applyDateRangeFilter(
  workPackages: WorkPackage[],
  filters: Partial<FilterState>,
): WorkPackage[] {
  let filtered = workPackages;

  if (filters.start && filters.end) {
    const startDate = new Date(filters.start);
    const endDate = new Date(filters.end);
    filtered = filtered.filter((wp) => wp.arrival < endDate && wp.departure > startDate);
  } else if (filters.start) {
    const startDate = new Date(filters.start);
    filtered = filtered.filter((wp) => wp.departure > startDate);
  } else if (filters.end) {
    const endDate = new Date(filters.end);
    filtered = filtered.filter((wp) => wp.arrival < endDate);
  }

  return filtered;
}

/**
 * Apply operator/aircraft/type filters (assumes date-range already applied).
 */
function applyEntityFilters(
  workPackages: WorkPackage[],
  filters: Partial<FilterState>,
): WorkPackage[] {
  let filtered = workPackages;

  if (filters.operators && filters.operators.length > 0) {
    filtered = filtered.filter((wp) => filters.operators!.includes(wp.customer));
  }
  if (filters.aircraft && filters.aircraft.length > 0) {
    filtered = filtered.filter((wp) => filters.aircraft!.includes(wp.aircraftReg));
  }
  if (filters.types && filters.types.length > 0) {
    filtered = filtered.filter((wp) => filters.types!.includes(wp.inferredType));
  }

  return filtered;
}

/**
 * Apply filters to work packages
 * Returns filtered array
 */
export function applyFilters(
  workPackages: WorkPackage[],
  filters: Partial<FilterState>,
): WorkPackage[] {
  const dateFiltered = applyDateRangeFilter(workPackages, filters);
  return applyEntityFilters(dateFiltered, filters);
}

/** Facets: unique sorted values for key string columns */
export interface Facets {
  customer: string[];
  aircraftReg: string[];
  inferredType: string[];
  status: string[];
}

/**
 * Extract unique sorted values for string columns from a work package set.
 * Call on the date-range-filtered (but not entity-filtered) set to get all
 * available options within the time window.
 */
export function extractFacets(workPackages: WorkPackage[]): Facets {
  const customers = new Set<string>();
  const aircraft = new Set<string>();
  const types = new Set<string>();
  const statuses = new Set<string>();

  for (const wp of workPackages) {
    if (wp.customer) customers.add(wp.customer);
    if (wp.aircraftReg) aircraft.add(wp.aircraftReg);
    if (wp.inferredType) types.add(wp.inferredType);
    if (wp.status) statuses.add(wp.status);
  }

  const sort = (a: string, b: string) => a.localeCompare(b);
  return {
    customer: Array.from(customers).sort(sort),
    aircraftReg: Array.from(aircraft).sort(sort),
    inferredType: Array.from(types).sort(sort),
    status: Array.from(statuses).sort(sort),
  };
}

/**
 * Get default filter state
 */
export function getDefaultFilterState(): FilterState {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1); // Yesterday
  const end = new Date(now);
  end.setDate(end.getDate() + 2); // +2 days (3-day range)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: "UTC",
    operators: [],
    aircraft: [],
    types: [],
  };
}
