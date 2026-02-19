import { db } from "@/lib/db/client";
import { importLog, workPackages, users } from "@/lib/db/schema";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { isCanceled } from "@/lib/utils/status";
import { eq, inArray, sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const BATCH_SIZE = 250; // 250 rows × ~29 cols ≈ 7,250 params — safe under SQLite 3.47 limit (32,766)

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
  importedBy: number;
  idempotencyKey?: string;
}

export interface CommitResult {
  success: boolean;
  logId: number;
  recordCount: number;
  newCount: number;
  changedCount: number;
  skippedCount: number;
  upsertedCount: number; // newCount + changedCount (backwards-compat)
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
        authId: crypto.randomUUID(),
        email: `system-import-${importedBy}@localhost`,
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
  let logId: number;
  try {
    const inserted = db.insert(importLog)
      .values({
        importedAt,
        recordCount: records.length,
        source,
        fileName: fileName || null,
        importedBy,
        status: "success",
        errors: null,
        idempotencyKey: idempotencyKey || null,
      })
      .returning({ id: importLog.id })
      .get();

    logId = inserted.id;
    log.info({ logId, source }, "Import log entry created");
  } catch (logErr) {
    log.error(
      { err: logErr, importedBy },
      "Failed to create import log entry"
    );
    if ((logErr as Error).message?.includes("FOREIGN KEY")) {
      log.warn(
        { importedBy },
        "Foreign key constraint failed — system user may not exist in users table"
      );
    }
    return { success: false, logId: 0, recordCount: records.length, newCount: 0, changedCount: 0, skippedCount: 0, upsertedCount: 0, canceledCount: 0 };
  }

  // Map all records to value objects
  const valueBatch = records.map((rec) => {
    const r = rec as Record<string, unknown>;
    const aircraft = r.Aircraft as Record<string, unknown> | undefined;
    const rawStatus = String(r.Workpackage_x0020_Status ?? "New");
    const status = isCanceled(rawStatus) ? "Canceled" : rawStatus;
    return {
      guid: String(r.GUID),
      spId: r.ID != null ? Number(r.ID) : null,
      title: r.Title != null ? String(r.Title) : null,
      aircraftReg: String(aircraft?.Title ?? "Unknown"),
      aircraftType: aircraft?.field_5 != null
        ? String(aircraft.field_5)
        : aircraft?.AircraftType != null
          ? String(aircraft.AircraftType)
          : null,
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
      aircraftSpId: aircraft?.ID != null ? Number(aircraft.ID) : null,
      spModified: r.Modified != null ? String(r.Modified) : null,
      spCreated: r.Created != null ? String(r.Created) : null,
      spVersion: r.OData__UIVersionString != null ? String(r.OData__UIVersionString) : null,
      importLogId: logId,
      importedAt,
    };
  });

  // Fetch existing records by GUID to check for changes
  const existingGuids = valueBatch.map((v) => v.guid);
  const existing = db
    .select({
      guid: workPackages.guid,
      spModified: workPackages.spModified,
      spVersion: workPackages.spVersion,
    })
    .from(workPackages)
    .where(inArray(workPackages.guid, existingGuids))
    .all();

  const existingMap = new Map(existing.map((e) => [e.guid, { spModified: e.spModified, spVersion: e.spVersion }]));

  // Partition records into "new" and "changed" based on GUID + version comparison
  const newRecords: typeof valueBatch = [];
  const changedRecords: typeof valueBatch = [];
  let skippedCount = 0;

  for (const record of valueBatch) {
    const existing = existingMap.get(record.guid);
    if (!existing) {
      // New record
      newRecords.push(record);
    } else if (
      existing.spModified !== record.spModified ||
      existing.spVersion !== record.spVersion
    ) {
      // Record has changed — update it
      changedRecords.push(record);
    } else {
      // Record is identical — skip
      skippedCount++;
      log.debug({ guid: record.guid }, "Skipping unchanged record (GUID + version match)");
    }
  }

  const upsertedCount = newRecords.length + changedRecords.length;
  let canceledCount = 0;

  // Count canceled records
  for (const record of [...newRecords, ...changedRecords]) {
    if (record.status === "Canceled") canceledCount++;
  }

  log.info(
    { logId, newCount: newRecords.length, changedCount: changedRecords.length, skippedCount },
    "Import partitioned: new/changed/skipped"
  );

  // UPSERT new records
  try {
    db.transaction(() => {
      // Insert new records
      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const chunk = newRecords.slice(i, i + BATCH_SIZE);
        if (chunk.length > 0) {
          db.insert(workPackages).values(chunk).run();
        }
      }

      // Update changed records
      for (const record of changedRecords) {
        db.update(workPackages)
          .set({
            spId: record.spId,
            title: record.title,
            aircraftReg: record.aircraftReg,
            aircraftType: record.aircraftType,
            customer: record.customer,
            customerRef: record.customerRef,
            flightId: record.flightId,
            arrival: record.arrival,
            departure: record.departure,
            totalMH: record.totalMH,
            totalGroundHours: record.totalGroundHours,
            status: record.status,
            description: record.description,
            parentId: record.parentId,
            hasWorkpackage: record.hasWorkpackage,
            workpackageNo: record.workpackageNo,
            calendarComments: record.calendarComments,
            isNotClosedOrCanceled: record.isNotClosedOrCanceled,
            documentSetId: record.documentSetId,
            aircraftSpId: record.aircraftSpId,
            spModified: record.spModified,
            spCreated: record.spCreated,
            spVersion: record.spVersion,
            importLogId: record.importLogId,
            importedAt: record.importedAt,
          })
          .where(eq(workPackages.guid, record.guid))
          .run();
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

    return { success: false, logId, recordCount: records.length, newCount: 0, changedCount: 0, skippedCount: 0, upsertedCount: 0, canceledCount: 0 };
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
      newCount: newRecords.length,
      changedCount: changedRecords.length,
      skippedCount,
      upsertedCount,
      canceledCount,
      customerCount: customerSet.size,
      aircraftCount: aircraftSet.size,
    },
    "Import committed successfully"
  );

  return {
    success: true,
    logId,
    recordCount: records.length,
    newCount: newRecords.length,
    changedCount: changedRecords.length,
    skippedCount,
    upsertedCount,
    canceledCount,
  };
}
