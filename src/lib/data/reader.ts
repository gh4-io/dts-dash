import { db } from "@/lib/db/client";
import { workPackages } from "@/lib/db/schema";
import { notLike } from "drizzle-orm";
import type { SharePointWorkPackage, WpStatus } from "@/types";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("reader");

/**
 * Work Package Reader
 * Reads work packages from SQLite work_packages table (D-029)
 * Implements module-level caching with invalidation flag
 */

let cachedData: SharePointWorkPackage[] | null = null;
let shouldInvalidate = false;

/**
 * Read work packages from the database.
 * Returns cached data if available, re-reads on invalidation.
 */
export function readWorkPackages(): SharePointWorkPackage[] {
  if (cachedData && !shouldInvalidate) {
    return cachedData;
  }

  try {
    const rows = db
      .select()
      .from(workPackages)
      .where(notLike(workPackages.status, "Cancel%"))
      .all();

    cachedData = rows.map((row) => ({
      GUID: row.guid,
      ID: row.spId ?? undefined,
      Aircraft: {
        Title: row.aircraftReg,
        field_5: row.aircraftType ?? undefined,
      },
      Customer: row.customer,
      Arrival: row.arrival,
      Departure: row.departure,
      TotalMH: row.totalMH,
      TotalGroundHours: row.totalGroundHours ?? "0",
      Workpackage_x0020_Status: (row.status ?? "New") as WpStatus,
      Title: row.title ?? undefined,
      CustomerReference: row.customerRef ?? undefined,
      Description: row.description ?? undefined,
      FlightId: row.flightId,
      ParentID: row.parentId,
      HasWorkpackage: row.hasWorkpackage ?? undefined,
      WorkpackageNo: row.workpackageNo ?? undefined,
      CalendarComments: row.calendarComments ?? undefined,
      IsNotClosedOrCanceled: (row.isNotClosedOrCanceled as "1" | "0") ?? undefined,
      Modified: row.spModified ?? undefined,
      Created: row.spCreated ?? undefined,
      DocumentSetID: row.documentSetId ?? undefined,
      AircraftId: row.aircraftSpId ?? undefined,
      OData__UIVersionString: row.spVersion ?? undefined,
    }));

    shouldInvalidate = false;
    log.info(`Loaded ${cachedData.length} work packages from database`);
    return cachedData;
  } catch (error) {
    log.error({ err: error }, "Failed to read work packages from database");
    cachedData = [];
    shouldInvalidate = false;
    return [];
  }
}

/**
 * Invalidate the cache (e.g., after a new import)
 * Next call to readWorkPackages() will re-read from database
 */
export function invalidateCache(): void {
  shouldInvalidate = true;
  log.info("Cache invalidated");
}

/**
 * Get current cache status (for debugging/admin)
 */
export function getCacheStatus(): {
  isCached: boolean;
  recordCount: number;
  willInvalidate: boolean;
} {
  return {
    isCached: cachedData !== null,
    recordCount: cachedData?.length ?? 0,
    willInvalidate: shouldInvalidate,
  };
}
