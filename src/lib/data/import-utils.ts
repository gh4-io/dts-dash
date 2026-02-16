import { db } from "@/lib/db/client";
import { importLog } from "@/lib/db/schema";
import { invalidateCache } from "@/lib/data/reader";
import fs from "fs/promises";
import path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationSummary {
  recordCount: number;
  customerCount: number;
  aircraftCount: number;
  dateRange: { start: string; end: string } | null;
}

export interface ValidationResult {
  valid: boolean;
  summary: ValidationSummary | null;
  warnings: string[];
  errors: string[];
  records?: unknown[];
}

export interface CommitOptions {
  jsonContent: string;
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
      valid: false,
      summary: null,
      warnings: [],
      errors: ["No records found in JSON data"],
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

  return {
    valid: errors.length === 0,
    summary: {
      recordCount: records.length,
      customerCount: customerSet.size,
      aircraftCount: aircraftSet.size,
      dateRange,
    },
    warnings,
    errors,
    records,
  };
}

// ─── Commit ──────────────────────────────────────────────────────────────────

/**
 * Write validated data to data/input.json, log to import_log, invalidate cache.
 */
export async function commitImportData(
  options: CommitOptions
): Promise<CommitResult> {
  const { jsonContent, records, source, fileName, importedBy, idempotencyKey } =
    options;

  // Write to data/input.json
  const dataPath = path.join(process.cwd(), "data", "input.json");
  await fs.writeFile(dataPath, jsonContent, "utf-8");

  // Log to import_log
  const logId = crypto.randomUUID();
  try {
    db.insert(importLog)
      .values({
        id: logId,
        importedAt: new Date().toISOString(),
        recordCount: records.length,
        source,
        fileName: fileName || null,
        importedBy,
        status: "success",
        errors: null,
        idempotencyKey: idempotencyKey || null,
      })
      .run();
  } catch (logErr) {
    console.error("[import-utils] Failed to log import:", logErr);
    if ((logErr as Error).message?.includes("FOREIGN KEY")) {
      console.warn(
        "[import-utils] Foreign key constraint failed for importedBy"
      );
    }
  }

  // Invalidate reader cache
  invalidateCache();

  console.warn(
    `[import] Committed ${records.length} records from ${source}, logId=${logId}`
  );

  return { success: true, logId, recordCount: records.length };
}
