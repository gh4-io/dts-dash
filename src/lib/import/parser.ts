/**
 * Universal Import Hub — Parser
 *
 * Unified parser that delegates to existing OData/CSV parsers.
 * Auto-detects format from content when not specified.
 * Detects import type via the reserved `_importType` key.
 */

import { parseODataJSON } from "@/lib/utils/odata-parser";
import { parseCSV } from "@/lib/utils/csv-parser";
import { extractSourceFields } from "./mapping";
import { IMPORT_TYPE_KEY, DEFAULT_SCHEMA_ID } from "./types";
import type { ParseResult } from "./types";

// Re-export for convenience (consumers can import from parser or types)
export { IMPORT_TYPE_KEY, DEFAULT_SCHEMA_ID };

/**
 * Detect the import schema type from data content.
 *
 * For JSON:
 *   1. Top-level object `_importType` key (wrapper metadata)
 *   2. OData unwrap (`value`, `data`, `d.results`) → first record
 *   3. Bare array → first record
 * For CSV:
 *   `_importType` column header → first data row value
 *
 * Always returns a schema ID — falls back to `"work-packages"` if not found.
 */
export function detectImportType(content: string): string {
  const trimmed = content.trimStart();

  // JSON detection
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);

      // Case 1: Top-level object with _importType
      if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) {
        if (parsed[IMPORT_TYPE_KEY]) {
          return String(parsed[IMPORT_TYPE_KEY]);
        }
        // Unwrap OData and check first record
        const records = extractRecordsFromWrapper(parsed);
        if (records.length > 0 && records[0][IMPORT_TYPE_KEY]) {
          return String(records[0][IMPORT_TYPE_KEY]);
        }
      }

      // Case 2: Bare array → check first record
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.[IMPORT_TYPE_KEY]) {
        return String(parsed[0][IMPORT_TYPE_KEY]);
      }
    } catch {
      // Not valid JSON — fall through to CSV check
    }
  }

  // CSV detection: check if first header contains _importType
  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline > 0) {
    const headerLine = trimmed.substring(0, firstNewline).trim();
    const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const typeIndex = headers.indexOf(IMPORT_TYPE_KEY);
    if (typeIndex >= 0) {
      const dataLine = trimmed.substring(firstNewline + 1).trim();
      const firstDataNewline = dataLine.indexOf("\n");
      const firstRow = (
        firstDataNewline > 0 ? dataLine.substring(0, firstDataNewline) : dataLine
      ).trim();
      const values = firstRow.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      if (values[typeIndex]) {
        return values[typeIndex];
      }
    }
  }

  return DEFAULT_SCHEMA_ID;
}

/**
 * Extract records array from a JSON wrapper object.
 * Mirrors OData unwrapping logic without throwing.
 */
function extractRecordsFromWrapper(obj: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(obj.value)) return obj.value as Record<string, unknown>[];
  if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  if (obj.d && typeof obj.d === "object" && obj.d !== null) {
    const d = obj.d as Record<string, unknown>;
    if (Array.isArray(d.results)) return d.results as Record<string, unknown>[];
  }
  return [];
}

/**
 * Strip the reserved `_importType` key from parsed records.
 * Call this after parsing/preProcessing to prevent the key from
 * appearing in field mapping or being committed to the database.
 */
export function stripImportTypeKey(records: Record<string, unknown>[]): Record<string, unknown>[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return records.map(({ [IMPORT_TYPE_KEY]: _discarded, ...rest }) => rest);
}

/**
 * Auto-detect format from content string.
 * Looks at the first non-whitespace character.
 */
export function detectFormat(content: string): "json" | "csv" {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // Verify it actually parses as JSON before committing
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Starts with { or [ but isn't valid JSON — treat as CSV
      return "csv";
    }
  }
  return "csv";
}

/**
 * Parse raw content into records and extract source field names.
 * Delegates to existing odata-parser (JSON) or csv-parser (CSV).
 */
export function parseContent(content: string, format?: "json" | "csv"): ParseResult {
  const detectedFormat = format ?? detectFormat(content);

  if (detectedFormat === "json") {
    return parseJSON(content);
  }
  return parseCSVContent(content);
}

/**
 * Parse JSON content (bare array, OData simple, OData nested).
 */
function parseJSON(content: string): ParseResult {
  const parsed = parseODataJSON<Record<string, unknown>>(content);
  const records = parsed.records;
  const sourceFields = extractSourceFields(records);

  return {
    records,
    sourceFields,
    detectedFormat: "json",
    recordCount: records.length,
  };
}

/**
 * Parse CSV content into records.
 * Uses a generic mapper that preserves all columns as-is.
 */
function parseCSVContent(content: string): ParseResult {
  // Parse with no required headers and a pass-through mapper
  const result = parseCSV<Record<string, string>>(
    content,
    [], // no required headers for generic parse
    (row) => row,
  );

  if (result.errors.length > 0) {
    throw new Error(`CSV parse errors: ${result.errors.join("; ")}`);
  }

  const records: Record<string, unknown>[] = result.data;
  const sourceFields = result.headers;

  return {
    records,
    sourceFields,
    detectedFormat: "csv",
    recordCount: records.length,
  };
}

/**
 * Check content size against limit.
 * Returns error message or null if within limit.
 */
export function checkContentSize(content: string, maxSizeMB: number = 50): string | null {
  const sizeBytes = new TextEncoder().encode(content).length;
  const sizeMB = sizeBytes / (1024 * 1024);

  if (sizeMB > maxSizeMB) {
    return `Content size (${sizeMB.toFixed(1)}MB) exceeds ${maxSizeMB}MB limit`;
  }
  return null;
}
