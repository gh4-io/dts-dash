import { db } from "@/lib/db/client";
import { importLog, workPackages, users } from "@/lib/db/schema";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { isCanceled } from "@/lib/utils/status";
import { eq, sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("import-utils");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationSummary {
  recordCount: number;
  customerCount: number;
  aircraftCount: number;
  dateRange: { start: string; end: string } | null;
  canceledCount: number;
}

export interface ValidationResult {
  valid: boolean;
  summary: ValidationSummary | null;
  warnings: string[];
  errors: string[];
  records?: unknown[];
}

export interface CommitOptions {
  records: unknown[];
  source: "file" | "paste" | "api";
  fileName?: string;
  importedBy: string;
  idempotencyKey?: string;
}

export interface CommitResult {
  success: boolean;
  logId: string;
  recordCount: number;
  upsertedCount: number;
  canceledCount: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE_MB = 50;

/**
 * Validate JSON content for import.
 * Parses the string, checks structure, validates required fields,
 * computes summary statistics.
 */
export function validateImportData(
  jsonContent: string,
  maxSizeMB: number = DEFAULT_MAX_SIZE_MB
): ValidationResult {
  // Size check
  if (jsonContent.length > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      summary: null,
      warnings: [],
      errors: [`JSON content exceeds ${maxSizeMB}MB limit`],
    };
  }

  // Parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch {
    return {
      valid: false,
      summary: null,
      warnings: [],
      errors: ["Invalid JSON format"],
    };
  }

  // Extract records array (OData format or bare array)
  const records = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>).value ?? [];

  if (!Array.isArray(records)) {
    return {
      valid: false,
      summary: null,
      warnings: [],
      errors: ["Expected an array of records or { value: [...] } OData format"],
    };
  }

  if (records.length === 0) {
    return {
      valid: true,
      summary: {
        recordCount: 0,
        customerCount: 0,
        aircraftCount: 0,
        dateRange: null,
        canceledCount: 0,
      },
      warnings: [],
      errors: [],
      records: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  records.forEach((rec: Record<string, unknown>, idx: number) => {
    const aircraft = rec.Aircraft as Record<string, unknown> | undefined;
    if (!aircraft?.Title) {
      errors.push(`Record ${idx + 1}: missing Aircraft.Title`);
    }
    if (!rec.Arrival && !rec.Departure) {
      errors.push(`Record ${idx + 1}: missing both Arrival and Departure dates`);
    }
    if (!rec.GUID) {
      errors.push(`Record ${idx + 1}: missing GUID (required for upsert)`);
    }
  });

  // Cap error reporting
  if (errors.length > 20) {
    const total = errors.length;
    errors.length = 20;
    errors.push(`... and ${total - 20} more errors`);
  }

  // Compute summary stats
  const customerSet = new Set<string>();
  const aircraftSet = new Set<string>();
  const timestamps: number[] = [];

  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    if (r.Customer) customerSet.add(String(r.Customer));
    const aircraft = r.Aircraft as Record<string, unknown> | undefined;
    if (aircraft?.Title) aircraftSet.add(String(aircraft.Title));

    for (const field of ["Arrival", "Departure"]) {
      const val = r[field];
      if (val) {
        const ts = new Date(String(val)).getTime();
        if (!isNaN(ts)) timestamps.push(ts);
      }
    }
  }

  const dateRange =
    timestamps.length > 0
      ? {
          start: new Date(Math.min(...timestamps)).toISOString(),
          end: new Date(Math.max(...timestamps)).toISOString(),
        }
      : null;

  // Warnings
  const missingMH = records.filter(
    (r: Record<string, unknown>) => r.TotalMH == null
  ).length;
  if (missingMH > 0) {
    warnings.push(
      `${missingMH} record${missingMH !== 1 ? "s" : ""} missing TotalMH (will use default 3.0)`
    );
  }

  const missingType = records.filter((r: Record<string, unknown>) => {
    const aircraft = r.Aircraft as Record<string, unknown> | undefined;
    return !aircraft?.field_5 && !aircraft?.AircraftType;
  }).length;
  if (missingType > 0) {
    warnings.push(
      `${missingType} record${missingType !== 1 ? "s" : ""} missing aircraft type (will infer from registration)`
    );
  }

  const canceledCount = records.filter((r: Record<string, unknown>) =>
    isCanceled(r.Workpackage_x0020_Status != null ? String(r.Workpackage_x0020_Status) : null)
  ).length;
  if (canceledCount > 0) {
    warnings.push(
      `${canceledCount} record${canceledCount !== 1 ? "s" : ""} have Canceled status (excluded from views, purged after grace period)`
    );
  }

  return {
    valid: errors.length === 0,
    summary: {
      recordCount: records.length,
      customerCount: customerSet.size,
      aircraftCount: aircraftSet.size,
      dateRange,
      canceledCount,
    },
    warnings,
    errors,
    records,
  };
}

// ─── Commit ──────────────────────────────────────────────────────────────────

/**
 * UPSERT validated records into work_packages table by GUID.
 * Logs to import_log, invalidates reader + transformer caches.
 */
export async function commitImportData(
  options: CommitOptions
): Promise<CommitResult> {
  const { records, source, fileName, importedBy, idempotencyKey } = options;

  const logId = crypto.randomUUID();
  const importedAt = new Date().toISOString();

  // Compute summary stats for logging
  const customerSet = new Set<string>();
  const aircraftSet = new Set<string>();
  for (const rec of records) {
    const r = rec as Record<string, unknown>;
    if (r.Customer) customerSet.add(String(r.Customer));
    const aircraft = r.Aircraft as Record<string, unknown> | undefined;
    if (aircraft?.Title) aircraftSet.add(String(aircraft.Title));
  }

  log.info(
    {
      logId,
      source,
      recordCount: records.length,
      customerCount: customerSet.size,
      aircraftCount: aircraftSet.size,
      fileName: fileName || null,
    },
    "Starting import commit"
  );

  // Ensure the importedBy user exists (auto-create system user if needed)
  const existingUser = db.select({ id: users.id }).from(users).where(eq(users.id, importedBy)).get();
  if (!existingUser) {
    log.info({ importedBy }, "Auto-creating system user for import FK");
    db.insert(users)
      .values({
        id: importedBy,
        email: `system-${importedBy.slice(0, 8)}@localhost`,
        displayName: "System (API)",
        passwordHash: "",
        role: "user",
        isActive: false,
        forcePasswordChange: false,
        tokenVersion: 0,
      })
      .run();
  }

  // Create import log entry first
  try {
    db.insert(importLog)
      .values({
        id: logId,
        importedAt,
        recordCount: records.length,
        source,
        fileName: fileName || null,
        importedBy,
        status: "success",
        errors: null,
        idempotencyKey: idempotencyKey || null,
      })
      .run();

    log.info({ logId, source }, "Import log entry created");
  } catch (logErr) {
    log.error(
      { err: logErr, logId, importedBy },
      "Failed to create import log entry"
    );
    if ((logErr as Error).message?.includes("FOREIGN KEY")) {
      log.warn(
        { importedBy, logId },
        "Foreign key constraint failed — system user may not exist in users table"
      );
    }
  }

  // UPSERT records in a single transaction
  let upsertedCount = 0;
  let canceledCount = 0;

  try {
    db.transaction(() => {
      for (const rec of records) {
        const r = rec as Record<string, unknown>;
        const aircraft = r.Aircraft as Record<string, unknown> | undefined;

        // Normalize canceled status to canonical "Canceled" spelling
        const rawStatus = String(r.Workpackage_x0020_Status ?? "New");
        const status = isCanceled(rawStatus) ? "Canceled" : rawStatus;

        const values = {
          guid: String(r.GUID),
          spId: r.ID != null ? Number(r.ID) : null,
          title: r.Title != null ? String(r.Title) : null,
          aircraftReg: String(aircraft?.Title ?? "Unknown"),
          aircraftType: aircraft?.field_5 != null ? String(aircraft.field_5) : (aircraft?.AircraftType != null ? String(aircraft.AircraftType) : null),
          customer: String(r.Customer ?? "Unknown"),
          customerRef: r.CustomerReference != null ? String(r.CustomerReference) : null,
          flightId: r.FlightId != null ? String(r.FlightId) : null,
          arrival: String(r.Arrival ?? ""),
          departure: String(r.Departure ?? ""),
          totalMH: r.TotalMH != null ? Number(r.TotalMH) : null,
          totalGroundHours: r.TotalGroundHours != null ? String(r.TotalGroundHours) : null,
          status,
          description: r.Description != null ? String(r.Description) : null,
          parentId: r.ParentID != null ? String(r.ParentID) : null,
          hasWorkpackage: r.HasWorkpackage != null ? Boolean(r.HasWorkpackage) : null,
          workpackageNo: r.WorkpackageNo != null ? String(r.WorkpackageNo) : null,
          calendarComments: r.CalendarComments != null ? String(r.CalendarComments) : null,
          isNotClosedOrCanceled: r.IsNotClosedOrCanceled != null ? String(r.IsNotClosedOrCanceled) : null,
          documentSetId: r.DocumentSetID != null ? Number(r.DocumentSetID) : null,
          aircraftSpId: r.AircraftId != null ? Number(r.AircraftId) : null,
          spModified: r.Modified != null ? String(r.Modified) : null,
          spCreated: r.Created != null ? String(r.Created) : null,
          spVersion: r.OData__UIVersionString != null ? String(r.OData__UIVersionString) : null,
          importLogId: logId,
          importedAt,
        };

        db.insert(workPackages)
          .values(values)
          .onConflictDoUpdate({
            target: workPackages.guid,
            set: {
              ...values,
              importLogId: logId,
              importedAt,
            },
          })
          .run();

        upsertedCount++;
        if (status === "Canceled") canceledCount++;
      }
    });
  } catch (err) {
    log.error(
      { err, logId, source, recordCount: records.length },
      "Failed to upsert work packages"
    );

    // Update import log to failed
    try {
      db.run(
        sql`UPDATE import_log SET status = 'failed', errors = ${(err as Error).message} WHERE id = ${logId}`
      );
      log.info({ logId }, "Import log status updated to failed");
    } catch (updateErr) {
      log.error({ err: updateErr, logId }, "Failed to update import log status");
    }

    return { success: false, logId, recordCount: records.length, upsertedCount: 0, canceledCount: 0 };
  }

  // Invalidate caches
  invalidateCache();
  invalidateTransformerCache();
  log.debug("Reader and transformer caches invalidated");

  if (canceledCount > 0) {
    log.info({ canceledCount, logId }, "Canceled work packages imported (excluded from views)");
  }

  log.info(
    {
      logId,
      source,
      recordCount: records.length,
      upsertedCount,
      canceledCount,
      customerCount: customerSet.size,
      aircraftCount: aircraftSet.size,
    },
    "Import committed successfully"
  );

  return { success: true, logId, recordCount: records.length, upsertedCount, canceledCount };
}
