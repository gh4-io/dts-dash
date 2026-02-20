/**
 * Universal Import Hub — Parser
 *
 * Unified parser that delegates to existing OData/CSV parsers.
 * Auto-detects format from content when not specified.
 */

import { parseODataJSON } from "@/lib/utils/odata-parser";
import { parseCSV } from "@/lib/utils/csv-parser";
import { extractSourceFields } from "./mapping";
import type { ParseResult } from "./types";

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
