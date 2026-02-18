/**
 * Default values for the demand/capacity model stored in the app_config table.
 * Single source of truth — imported by transformer.ts, config/route.ts,
 * and capacity/route.ts to avoid drift between duplicate constants.
 */

export const DEFAULT_MH = 3.0;
export const DEFAULT_WP_MH_MODE: "include" | "exclude" = "exclude";
export const DEFAULT_THEORETICAL_CAPACITY_PER_PERSON = 8.0;
export const DEFAULT_REAL_CAPACITY_PER_PERSON = 6.5;

export const DEFAULT_SHIFTS = [
  { name: "Day", startHour: 7, endHour: 15, headcount: 8 },
  { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
  { name: "Night", startHour: 23, endHour: 7, headcount: 4 },
] as const;

/** JSON string form for DB fallback parsing */
export const DEFAULT_SHIFTS_JSON = JSON.stringify(DEFAULT_SHIFTS);

export const DEFAULT_CLEANUP_GRACE_HOURS = 6;

export const DEFAULT_INGEST_RATE_LIMIT_SECONDS = 60;
export const DEFAULT_INGEST_MAX_SIZE_MB = 50;
export const DEFAULT_INGEST_CHUNK_TIMEOUT_SECONDS = 300;
