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

  const excludeOperatorsRaw = query.get("excludeOperators");
  const excludeAircraftRaw = query.get("excludeAircraft");
  const excludeTypesRaw = query.get("excludeTypes");

  const split = (raw: string | null) => (raw ? raw.split(",").filter(Boolean) : []);

  const operators = split(operatorsRaw);
  const aircraft = split(aircraftRaw);
  const types = split(typesRaw) as AircraftType[];
  const excludeOperators = split(excludeOperatorsRaw);
  const excludeAircraft = split(excludeAircraftRaw);
  const excludeTypes = split(excludeTypesRaw);

  return {
    ...(start && { start }),
    ...(end && { end }),
    ...(timezone && { timezone }),
    ...(operators.length > 0 && { operators }),
    ...(aircraft.length > 0 && { aircraft }),
    ...(types.length > 0 && { types }),
    ...(excludeOperators.length > 0 && { excludeOperators }),
    ...(excludeAircraft.length > 0 && { excludeAircraft }),
    ...(excludeTypes.length > 0 && { excludeTypes }),
  };
}

/**
 * Assemble the query params the data APIs expect from filter state.
 * Shared by every data hook so the wire format cannot drift between pages.
 */
export function buildFilterQuery(f: Partial<FilterState>): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.start) q.start = f.start;
  if (f.end) q.end = f.end;
  if (f.operators?.length) q.operators = f.operators.join(",");
  if (f.aircraft?.length) q.aircraft = f.aircraft.join(",");
  if (f.types?.length) q.types = f.types.join(",");
  if (f.excludeOperators?.length) q.excludeOperators = f.excludeOperators.join(",");
  if (f.excludeAircraft?.length) q.excludeAircraft = f.excludeAircraft.join(",");
  if (f.excludeTypes?.length) q.excludeTypes = f.excludeTypes.join(",");
  return q;
}

/** Every query key the browser URL uses for filter state. */
export const FILTER_URL_KEYS = [
  "start",
  "end",
  "tz",
  "op",
  "ac",
  "type",
  "nop",
  "nac",
  "ntype",
] as const;

/**
 * Assemble the *browser URL* params from filter state.
 *
 * Note the keys are the short forms (`op`, `nac`) rather than the long ones the
 * data APIs take (`operators`, `excludeAircraft`) — see buildFilterQuery for
 * those. Shared by the URL sync hook and by any link that needs to carry the
 * current window across a navigation, so the two cannot drift.
 */
export function buildFilterUrlParams(
  f: Partial<FilterState>,
  base?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of FILTER_URL_KEYS) params.delete(key);

  if (f.start) params.set("start", f.start);
  if (f.end) params.set("end", f.end);
  if (f.timezone && f.timezone !== "UTC") params.set("tz", f.timezone);
  if (f.operators?.length) params.set("op", f.operators.join(","));
  if (f.aircraft?.length) params.set("ac", f.aircraft.join(","));
  if (f.types?.length) params.set("type", f.types.join(","));
  if (f.excludeOperators?.length) params.set("nop", f.excludeOperators.join(","));
  if (f.excludeAircraft?.length) params.set("nac", f.excludeAircraft.join(","));
  if (f.excludeTypes?.length) params.set("ntype", f.excludeTypes.join(","));
  return params;
}

/**
 * Predicate for "does this customer survive the operator filter?".
 * Reused for the non-work-package demand sources (contracts, flight events,
 * time bookings, billing entries), which carry a customer but are not work
 * packages and so cannot go through applyFilters.
 */
export function makeCustomerPredicate(
  filters: Partial<FilterState>,
): (customer: string | null | undefined) => boolean {
  const include = filters.operators ?? [];
  const exclude = filters.excludeOperators ?? [];
  if (include.length === 0 && exclude.length === 0) return () => true;

  const includeSet = new Set(include);
  const excludeSet = new Set(exclude);
  return (customer) => {
    if (!customer) return include.length === 0; // unattributed rows survive only when nothing is required
    if (include.length > 0 && !includeSet.has(customer)) return false;
    return !excludeSet.has(customer);
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

  // Exclusions run last — an excluded value always loses, even if it also
  // appears in the inclusion list.
  if (filters.excludeOperators && filters.excludeOperators.length > 0) {
    filtered = filtered.filter((wp) => !filters.excludeOperators!.includes(wp.customer));
  }
  if (filters.excludeAircraft && filters.excludeAircraft.length > 0) {
    filtered = filtered.filter((wp) => !filters.excludeAircraft!.includes(wp.aircraftReg));
  }
  if (filters.excludeTypes && filters.excludeTypes.length > 0) {
    filtered = filtered.filter((wp) => !filters.excludeTypes!.includes(wp.inferredType));
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
 * Column filter rules over the wire.
 *
 * The Columns dialog can express rules the filter store has no field for
 * (status, ground time, arrival/departure, man-hours, shift). Those used to be
 * client-side only, which is why they had no effect on the capacity page — it
 * computes demand on the server. Serializing the whole rule set lets the
 * capacity API apply exactly what the user sees in the chips.
 *
 * Kept deliberately loose (`unknown[]` in, validated out) so this module does
 * not depend on the client-only use-actions store.
 */
export interface SerializableColumnFilter {
  id: string;
  column: string;
  operator: string;
  value: string;
  values: string[];
}

export function serializeColumnFilters(rules: SerializableColumnFilter[]): string {
  return JSON.stringify(
    rules.map((r) => ({
      id: r.id,
      column: r.column,
      operator: r.operator,
      value: r.value,
      values: r.values,
    })),
  );
}

/** Parse the `cf` query param. Returns [] for missing or malformed input. */
export function parseColumnFilters(raw: string | null): SerializableColumnFilter[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((r) => {
      if (typeof r !== "object" || r === null) return [];
      const rule = r as Record<string, unknown>;
      if (typeof rule.column !== "string" || typeof rule.operator !== "string") return [];
      return [
        {
          id: typeof rule.id === "string" ? rule.id : "",
          column: rule.column,
          operator: rule.operator,
          value: typeof rule.value === "string" ? rule.value : "",
          values: Array.isArray(rule.values)
            ? rule.values.filter((v) => typeof v === "string")
            : [],
        },
      ];
    });
  } catch {
    return [];
  }
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
    excludeOperators: [],
    excludeAircraft: [],
    excludeTypes: [],
  };
}
