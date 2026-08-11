/**
 * Default values for the demand model stored in the app_config table.
 * Single source of truth — imported by transformer.ts and config/route.ts
 * to avoid drift between duplicate constants.
 *
 * The capacity-per-person and static shift constants that used to live here
 * belonged to a superseded capacity engine and were removed with it; capacity
 * is modelled by `capacity_assumptions` + `capacity_shifts` (see
 * src/lib/capacity/).
 */

export const DEFAULT_MH = 3.0;
export const DEFAULT_WP_MH_MODE: "include" | "exclude" = "exclude";
export const DEFAULT_CLEANUP_GRACE_HOURS = 6;

export const DEFAULT_INGEST_RATE_LIMIT_SECONDS = 60;
export const DEFAULT_INGEST_MAX_SIZE_MB = 50;
export const DEFAULT_INGEST_CHUNK_TIMEOUT_SECONDS = 300;
