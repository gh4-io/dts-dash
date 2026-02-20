/**
 * Universal Import Hub — Validation Pipeline
 *
 * Runs per-field validation + transform, then schema-level postMapValidate.
 * Produces a ValidationPreview with errors, warnings, badges, and preview rows.
 */

import type {
  FieldDef,
  FieldMapping,
  ImportContext,
  ImportSchema,
  ValidationPreview,
} from "./types";
import { applyMapping } from "./mapping";

const MAX_ERRORS = 50;
const PREVIEW_ROWS = 5;

/**
 * Validate records against a schema using the provided field mapping.
 * Returns a ValidationPreview with all results.
 */
export async function validateRecords(
  rawRecords: Record<string, unknown>[],
  schema: ImportSchema,
  mapping: FieldMapping[],
  ctx: ImportContext,
): Promise<ValidationPreview> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Apply mapping to transform source → target shape
  const mappedRecords = applyMapping(rawRecords, mapping, schema.fields);

  // Compute field coverage
  const fieldCoverage = computeFieldCoverage(mapping, schema.fields);

  // Check required fields are mapped
  for (const field of schema.fields) {
    if (field.required) {
      const m = mapping.find((m) => m.targetField === field.name);
      if (!m?.sourceField && field.defaultValue === undefined) {
        errors.push(`Required field "${field.label}" is not mapped and has no default value`);
      }
    }
  }

  // Per-record, per-field validation
  const fieldMap = new Map(schema.fields.map((f) => [f.name, f]));

  for (let i = 0; i < mappedRecords.length && errors.length < MAX_ERRORS; i++) {
    const record = mappedRecords[i];

    for (const [fieldName, field] of fieldMap) {
      const value = record[fieldName];

      // Required check
      if (field.required && (value == null || value === "")) {
        const m = mapping.find((m) => m.targetField === fieldName);
        if (m?.sourceField) {
          errors.push(`Row ${i + 1}: "${field.label}" is required but empty`);
        }
        if (errors.length >= MAX_ERRORS) break;
        continue;
      }

      // Type check (skip null/undefined for optional fields)
      if (value != null && value !== "") {
        const typeError = validateFieldType(value, field, i + 1);
        if (typeError) {
          errors.push(typeError);
          if (errors.length >= MAX_ERRORS) break;
          continue;
        }
      }

      // Custom field validator
      if (field.validate && value != null && value !== "") {
        const customError = field.validate(value, record);
        if (customError) {
          errors.push(`Row ${i + 1}, "${field.label}": ${customError}`);
          if (errors.length >= MAX_ERRORS) break;
        }
      }
    }
  }

  // Cap errors
  if (errors.length >= MAX_ERRORS) {
    errors.push(`... validation stopped after ${MAX_ERRORS} errors`);
  }

  // Schema-level post-map validation (cross-record checks, FK lookups)
  if (schema.postMapValidate && errors.length === 0) {
    const postResult = await schema.postMapValidate(
      mappedRecords as Parameters<NonNullable<typeof schema.postMapValidate>>[0],
      ctx,
    );
    errors.push(...postResult.errors);
    warnings.push(...postResult.warnings);
  }

  // Generate summary badges
  const badges = schema.summarize
    ? schema.summarize(mappedRecords as Parameters<NonNullable<typeof schema.summarize>>[0])
    : [];

  // Preview rows (first N records, mapped)
  const previewRows = mappedRecords.slice(0, PREVIEW_ROWS);

  return {
    valid: errors.length === 0,
    recordCount: mappedRecords.length,
    errors,
    warnings,
    badges,
    previewRows,
    fieldCoverage,
  };
}

/**
 * Validate a field value matches the expected FieldType.
 */
function validateFieldType(value: unknown, field: FieldDef, rowNum: number): string | null {
  switch (field.type) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) {
        return `Row ${rowNum}, "${field.label}": expected number, got "${String(value)}"`;
      }
      break;
    }
    case "boolean": {
      if (
        typeof value !== "boolean" &&
        !["true", "false", "1", "0", "yes", "no"].includes(String(value).toLowerCase())
      ) {
        return `Row ${rowNum}, "${field.label}": expected boolean, got "${String(value)}"`;
      }
      break;
    }
    case "date": {
      const date = new Date(String(value));
      if (isNaN(date.getTime())) {
        return `Row ${rowNum}, "${field.label}": invalid date "${String(value)}"`;
      }
      break;
    }
    // string and json: no type validation needed
  }
  return null;
}

/**
 * Compute field coverage statistics from the mapping.
 */
function computeFieldCoverage(
  mapping: FieldMapping[],
  fields: FieldDef[],
): ValidationPreview["fieldCoverage"] {
  const explicitlyMapped = mapping.filter((m) => m.sourceField !== null);
  const mappedTargets = new Set(explicitlyMapped.map((m) => m.targetField));

  // Fields with defaultValue are effectively covered even without an explicit mapping
  const coveredByDefault = fields.filter(
    (f) => f.defaultValue !== undefined && !mappedTargets.has(f.name),
  ).length;
  const mapped = explicitlyMapped.length + coveredByDefault;

  const total = fields.length;
  const requiredFields = fields.filter((f) => f.required);
  const requiredMapped = requiredFields.filter(
    (f) => mappedTargets.has(f.name) || f.defaultValue !== undefined,
  ).length;

  return {
    mapped,
    total,
    required: requiredFields.length,
    requiredMapped,
  };
}
