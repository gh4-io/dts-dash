/**
 * Universal Import Hub — Exporter
 *
 * Export data from any schema type with configurable filters.
 * Generate template files with example data for download.
 */

import { toCSV } from "@/lib/utils/csv-parser";
import { IMPORT_TYPE_KEY } from "./types";
import type { ImportSchema } from "./types";

export interface ExportOutput {
  content: string;
  filename: string;
  mimeType: string;
}

/**
 * Export data for a schema with optional filters.
 * Queries the database via schema.export.query(), formats as JSON or CSV.
 */
export async function exportData(
  schema: ImportSchema,
  filters: Record<string, unknown>,
  format: "json" | "csv",
): Promise<ExportOutput> {
  if (!schema.export) {
    throw new Error(`Schema "${schema.id}" does not support export`);
  }

  const records = await schema.export.query(filters);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${schema.id}-export-${timestamp}.${format}`;

  if (format === "json") {
    return {
      content: JSON.stringify(records, null, 2),
      filename,
      mimeType: "application/json",
    };
  }

  // CSV: use exportable fields
  const headers = schema.fields.filter((f) => f.exportInclude !== false).map((f) => f.name);

  return {
    content: toCSV(records as Record<string, unknown>[], headers),
    filename,
    mimeType: "text/csv",
  };
}

/**
 * Generate a template file with example data for a schema.
 * Uses schema.templateRecords if provided, otherwise synthesizes from fields.
 */
export function generateTemplate(schema: ImportSchema, format: "json" | "csv"): ExportOutput {
  const rawRecords =
    schema.templateRecords && schema.templateRecords.length > 0
      ? schema.templateRecords
      : synthesizeTemplateRecords(schema);

  // Inject _importType into each record for auto-detection on re-import
  const records = rawRecords.map((rec) => ({
    [IMPORT_TYPE_KEY]: schema.id,
    ...rec,
  }));

  const filename = `${schema.id}-template.${format}`;

  if (format === "json") {
    return {
      content: JSON.stringify(records, null, 2),
      filename,
      mimeType: "application/json",
    };
  }

  // CSV: _importType + all field names as headers
  const headers = [IMPORT_TYPE_KEY, ...schema.fields.map((f) => f.name)];

  return {
    content: toCSV(records as Record<string, unknown>[], headers),
    filename,
    mimeType: "text/csv",
  };
}

/**
 * Synthesize example records from field definitions when no templateRecords.
 * Generates 2 rows with placeholder values based on field types.
 */
function synthesizeTemplateRecords(schema: ImportSchema): Record<string, unknown>[] {
  const row1: Record<string, unknown> = {};
  const row2: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const [v1, v2] = getExampleValues(field);
    row1[field.name] = v1;
    row2[field.name] = v2;
  }

  return [row1, row2];
}

function getExampleValues(field: import("./types").FieldDef): [unknown, unknown] {
  if (field.defaultValue !== undefined) {
    return [field.defaultValue, field.defaultValue];
  }

  switch (field.type) {
    case "string":
      return [`example-${field.name}-1`, `example-${field.name}-2`];
    case "number":
      return [1, 2];
    case "boolean":
      return [true, false];
    case "date":
      return ["2025-01-01T00:00:00Z", "2025-06-15T12:00:00Z"];
    case "json":
      return ["{}", "{}"];
    default:
      return ["", ""];
  }
}
