import { db } from "@/lib/db/client";
import { mhOverrides, appConfig } from "@/lib/db/schema";
import type { SharePointWorkPackage, WorkPackage, MHSource, AppConfig } from "@/types";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("transformer");

/**
 * Work Package Transformer
 * Converts raw SharePoint data to normalized WorkPackage format
 * Applies effectiveMH formula: override > WP MH (if include) > default 3.0
 */

let cachedConfig: AppConfig | null = null;
let cachedOverrides: Map<number, number> | null = null;

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
      defaultMH: parseFloat(configMap.defaultMH ?? "3.0"),
      wpMHMode: (configMap.wpMHMode as "include" | "exclude") ?? "exclude",
      theoreticalCapacityPerPerson: parseFloat(configMap.theoreticalCapacityPerPerson ?? "8.0"),
      realCapacityPerPerson: parseFloat(configMap.realCapacityPerPerson ?? "6.5"),
      shifts: JSON.parse(
        configMap.shifts ??
          JSON.stringify([
            { name: "Day", startHour: 7, endHour: 15, headcount: 8 },
            { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
            { name: "Night", startHour: 23, endHour: 7, headcount: 4 },
          ])
      ),
      timelineDefaultDays: parseInt(configMap.timelineDefaultDays ?? "3", 10),
      defaultTimezone: configMap.defaultTimezone ?? "UTC",
      ingestApiKey: configMap.ingestApiKey ?? "",
      ingestRateLimitSeconds: parseInt(configMap.ingestRateLimitSeconds ?? "60", 10),
      ingestMaxSizeMB: parseInt(configMap.ingestMaxSizeMB ?? "50", 10),
      masterDataConformityMode: (configMap.masterDataConformityMode as "strict" | "warning" | "auto-add") ?? "warning",
      masterDataOverwriteConfirmed: (configMap.masterDataOverwriteConfirmed as "allow" | "warn" | "reject") ?? "warn",
      allowedHostnames: JSON.parse(configMap.allowedHostnames ?? "[]"),
    };

    return cachedConfig;
  } catch (error) {
    log.error({ err: error }, "Failed to load config");
    // Return defaults
    cachedConfig = {
      defaultMH: 3.0,
      wpMHMode: "exclude",
      theoreticalCapacityPerPerson: 8.0,
      realCapacityPerPerson: 6.5,
      shifts: [
        { name: "Day", startHour: 7, endHour: 15, headcount: 8 },
        { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
        { name: "Night", startHour: 23, endHour: 7, headcount: 4 },
      ],
      timelineDefaultDays: 3,
      defaultTimezone: "UTC",
      ingestApiKey: "",
      ingestRateLimitSeconds: 60,
      ingestMaxSizeMB: 50,
      masterDataConformityMode: "warning",
      masterDataOverwriteConfirmed: "warn",
      allowedHostnames: [],
    };
    return cachedConfig;
  }
}

/**
 * Load MH overrides from SQLite
 */
async function loadOverrides(): Promise<Map<number, number>> {
  if (cachedOverrides) {
    return cachedOverrides;
  }

  try {
    const overrides = await db.select().from(mhOverrides);
    cachedOverrides = new Map(overrides.map((o) => [o.workPackageId, o.overrideMH]));
    log.info(`Loaded ${cachedOverrides.size} MH overrides`);
    return cachedOverrides;
  } catch (error) {
    log.error({ err: error }, "Failed to load overrides");
    cachedOverrides = new Map();
    return cachedOverrides;
  }
}

/**
 * Invalidate caches (e.g., after config/override changes)
 */
export function invalidateTransformerCache(): void {
  cachedConfig = null;
  cachedOverrides = null;
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

  // Normalize aircraft types in batch
  // Prefer field_5 (actual type from SharePoint) or AircraftType, fallback to registration
  const rawTypes = raw.map((wp) =>
    wp.Aircraft?.field_5 ?? wp.Aircraft?.AircraftType ?? wp.Aircraft?.Title ?? null
  );
  const normalizedTypesModule = await import("@/lib/utils/aircraft-type");
  const normalizedTypes = await normalizedTypesModule.normalizeAircraftTypes(rawTypes);

  return raw.map((wp, idx): WorkPackage => {
    // Parse dates
    const arrival = new Date(wp.Arrival);
    const departure = new Date(wp.Departure);

    // Parse TotalGroundHours (string → number, NaN → 0)
    const groundHoursRaw = parseFloat(wp.TotalGroundHours);
    const groundHours = isNaN(groundHoursRaw) ? 0 : groundHoursRaw;

    // Parse IsNotClosedOrCanceled (string "1"/"0" → boolean)
    const isActive = wp.IsNotClosedOrCanceled === "1";

    // Compute effectiveMH
    const manualOverride = overrides.get(wp.ID) ?? null;
    const wpMH = wp.TotalMH;
    const { effectiveMH, mhSource } = computeEffectiveMH(
      manualOverride,
      wpMH,
      wp.HasWorkpackage,
      config.defaultMH,
      config.wpMHMode
    );

    return {
      id: wp.ID,
      documentSetId: wp.DocumentSetID,
      aircraftReg: wp.Aircraft?.Title ?? "Unknown",
      aircraftId: wp.AircraftId,
      customer: wp.Customer,
      flightId: wp.FlightId,
      arrival,
      departure,
      totalMH: wpMH,
      groundHours,
      status: wp.Workpackage_x0020_Status,
      hasWorkpackage: wp.HasWorkpackage,
      workpackageNo: wp.WorkpackageNo,
      calendarComments: wp.CalendarComments,
      isActive,
      modified: new Date(wp.Modified),
      created: new Date(wp.Created),
      effectiveMH,
      mhSource,
      manualMHOverride: manualOverride,
      inferredType: normalizedTypes[idx]?.canonical ?? "Unknown",
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
