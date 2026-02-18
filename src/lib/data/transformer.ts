import { db } from "@/lib/db/client";
import { mhOverrides, appConfig, workPackages, aircraft } from "@/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import type { SharePointWorkPackage, WorkPackage, MHSource, AppConfig } from "@/types";
import { createChildLogger } from "@/lib/logger";
import { normalizeAircraftTypes, invalidateMappingsCache } from "@/lib/utils/aircraft-type";
import {
  DEFAULT_MH,
  DEFAULT_WP_MH_MODE,
  DEFAULT_THEORETICAL_CAPACITY_PER_PERSON,
  DEFAULT_REAL_CAPACITY_PER_PERSON,
  DEFAULT_SHIFTS,
  DEFAULT_SHIFTS_JSON,
  DEFAULT_INGEST_RATE_LIMIT_SECONDS,
  DEFAULT_INGEST_MAX_SIZE_MB,
} from "@/lib/data/config-defaults";

const log = createChildLogger("transformer");

/**
 * Work Package Transformer
 * Converts raw SharePoint data to normalized WorkPackage format
 * Applies effectiveMH formula: override > WP MH (if include) > default 3.0
 */

let cachedConfig: AppConfig | null = null;
let cachedOverrides: Map<string, number> | null = null; // GUID -> overrideMH
let cachedAircraftTypes: Map<string, string> | null = null; // registration -> aircraftType

/**
 * Load app config from SQLite
 */
async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configRows = await db.select().from(appConfig);
    const configMap = Object.fromEntries(configRows.map((r) => [r.key, r.value]));

    cachedConfig = {
      defaultMH: parseFloat(configMap.defaultMH ?? String(DEFAULT_MH)),
      wpMHMode: (configMap.wpMHMode as "include" | "exclude") ?? DEFAULT_WP_MH_MODE,
      theoreticalCapacityPerPerson: parseFloat(
        configMap.theoreticalCapacityPerPerson ?? String(DEFAULT_THEORETICAL_CAPACITY_PER_PERSON),
      ),
      realCapacityPerPerson: parseFloat(
        configMap.realCapacityPerPerson ?? String(DEFAULT_REAL_CAPACITY_PER_PERSON),
      ),
      shifts: JSON.parse(configMap.shifts ?? DEFAULT_SHIFTS_JSON),
      ingestApiKey: configMap.ingestApiKey ?? "",
      ingestRateLimitSeconds: parseInt(
        configMap.ingestRateLimitSeconds ?? String(DEFAULT_INGEST_RATE_LIMIT_SECONDS),
        10,
      ),
      ingestMaxSizeMB: parseInt(
        configMap.ingestMaxSizeMB ?? String(DEFAULT_INGEST_MAX_SIZE_MB),
        10,
      ),
      masterDataConformityMode: (configMap.masterDataConformityMode as "strict" | "warning" | "auto-add") ?? "warning",
      masterDataOverwriteConfirmed: (configMap.masterDataOverwriteConfirmed as "allow" | "warn" | "reject") ?? "warn",
      allowedHostnames: JSON.parse(configMap.allowedHostnames ?? "[]"),
    };

    return cachedConfig;
  } catch (error) {
    log.error({ err: error }, "Failed to load config");
    // Return defaults
    cachedConfig = {
      defaultMH: DEFAULT_MH,
      wpMHMode: DEFAULT_WP_MH_MODE,
      theoreticalCapacityPerPerson: DEFAULT_THEORETICAL_CAPACITY_PER_PERSON,
      realCapacityPerPerson: DEFAULT_REAL_CAPACITY_PER_PERSON,
      shifts: [...DEFAULT_SHIFTS],
      ingestApiKey: "",
      ingestRateLimitSeconds: DEFAULT_INGEST_RATE_LIMIT_SECONDS,
      ingestMaxSizeMB: DEFAULT_INGEST_MAX_SIZE_MB,
      masterDataConformityMode: "warning",
      masterDataOverwriteConfirmed: "warn",
      allowedHostnames: [],
    };
    return cachedConfig;
  }
}

/**
 * Load MH overrides from SQLite, keyed by work package GUID.
 * Joins mh_overrides with work_packages to resolve GUID from the auto-increment ID.
 */
async function loadOverrides(): Promise<Map<string, number>> {
  if (cachedOverrides) {
    return cachedOverrides;
  }

  try {
    const rows = await db
      .select({
        guid: workPackages.guid,
        overrideMH: mhOverrides.overrideMH,
      })
      .from(mhOverrides)
      .innerJoin(workPackages, eq(workPackages.id, mhOverrides.workPackageId));

    cachedOverrides = new Map(rows.map((r) => [r.guid, r.overrideMH]));
    log.info(`Loaded ${cachedOverrides.size} MH overrides`);
    return cachedOverrides;
  } catch (error) {
    log.error({ err: error }, "Failed to load overrides");
    cachedOverrides = new Map();
    return cachedOverrides;
  }
}

/**
 * Load aircraft type map from SQLite — keyed by registration.
 * Only includes rows with a non-null aircraftType.
 */
async function loadAircraftTypes(): Promise<Map<string, string>> {
  if (cachedAircraftTypes) {
    return cachedAircraftTypes;
  }

  try {
    const rows = db
      .select({
        registration: aircraft.registration,
        aircraftType: aircraft.aircraftType,
      })
      .from(aircraft)
      .where(isNotNull(aircraft.aircraftType))
      .all();

    cachedAircraftTypes = new Map(
      rows.map((r) => [r.registration, r.aircraftType as string])
    );
    log.info(`Loaded ${cachedAircraftTypes.size} aircraft types from master data`);
    return cachedAircraftTypes;
  } catch (error) {
    log.error({ err: error }, "Failed to load aircraft types");
    cachedAircraftTypes = new Map();
    return cachedAircraftTypes;
  }
}

/**
 * Invalidate caches (e.g., after config/override changes or import)
 */
export function invalidateTransformerCache(): void {
  cachedConfig = null;
  cachedOverrides = null;
  cachedAircraftTypes = null;
  invalidateMappingsCache(); // ensure type mapping rules are also refreshed
  log.info("Cache invalidated");
}

/**
 * Transform raw SharePoint work packages to normalized format
 */
export async function transformWorkPackages(
  raw: SharePointWorkPackage[]
): Promise<WorkPackage[]> {
  const config = await loadConfig();
  const overrides = await loadOverrides();

  // Load aircraft master type map (registration → aircraftType from ac.json field_5)
  const aircraftTypeMap = await loadAircraftTypes();

  // Resolve type per WP:
  //   1. Aircraft master data (truth source — populated from ac.json field_5)
  //   2. WP field_5 (raw type from the work package record itself)
  //   3. WP AircraftType fallback field
  //   4. null → normalizer returns raw string or "Unknown" if nothing present
  const rawTypes = raw.map((wp) =>
    aircraftTypeMap.get(wp.Aircraft?.Title ?? "") ??
    wp.Aircraft?.field_5 ??
    wp.Aircraft?.AircraftType ??
    null
  );
  const normalizedTypes = await normalizeAircraftTypes(rawTypes);

  return raw.map((wp, idx): WorkPackage => {
    // Parse dates
    const arrival = new Date(wp.Arrival);
    const departure = new Date(wp.Departure);

    // Parse TotalGroundHours (string → number, NaN → 0)
    const groundHoursRaw = parseFloat(wp.TotalGroundHours);
    const groundHours = isNaN(groundHoursRaw) ? 0 : groundHoursRaw;

    // Parse IsNotClosedOrCanceled (string "1"/"0" → boolean, default true if absent)
    const isActive = wp.IsNotClosedOrCanceled ? wp.IsNotClosedOrCanceled === "1" : true;

    // Compute effectiveMH — overrides keyed by GUID
    const manualOverride = overrides.get(wp.GUID) ?? null;
    const wpMH = wp.TotalMH;
    const hasWP = wp.HasWorkpackage ?? false;
    const { effectiveMH, mhSource } = computeEffectiveMH(
      manualOverride,
      wpMH,
      hasWP,
      config.defaultMH,
      config.wpMHMode
    );

    return {
      id: wp.ID ?? 0,
      guid: wp.GUID,
      aircraftReg: wp.Aircraft?.Title ?? "Unknown",
      customer: wp.Customer,
      flightId: wp.FlightId ?? null,
      arrival,
      departure,
      totalMH: wpMH,
      groundHours,
      status: wp.Workpackage_x0020_Status,
      effectiveMH,
      mhSource,
      manualMHOverride: manualOverride,
      inferredType: normalizedTypes[idx]?.canonical ?? "Unknown",
      title: wp.Title ?? null,
      description: wp.Description ?? null,
      customerReference: wp.CustomerReference ?? null,
      hasWorkpackage: hasWP,
      workpackageNo: wp.WorkpackageNo ?? null,
      calendarComments: wp.CalendarComments ?? null,
      isActive,
      modified: wp.Modified ? new Date(wp.Modified) : null,
      created: wp.Created ? new Date(wp.Created) : null,
    };
  });
}

/**
 * Compute effectiveMH using priority chain
 * Priority: manual override > WP MH (if include mode) > default MH
 */
function computeEffectiveMH(
  manualOverride: number | null,
  wpMH: number | null,
  hasWorkpackage: boolean,
  defaultMH: number,
  wpMHMode: "include" | "exclude"
): { effectiveMH: number; mhSource: MHSource } {
  // 1. Manual override takes precedence
  if (manualOverride !== null) {
    return { effectiveMH: manualOverride, mhSource: "manual" };
  }

  // 2. WP MH (if include mode + has workpackage + non-null)
  if (wpMHMode === "include" && hasWorkpackage && wpMH !== null && wpMH > 0) {
    return { effectiveMH: wpMH, mhSource: "workpackage" };
  }

  // 3. Default MH
  return { effectiveMH: defaultMH, mhSource: "default" };
}
