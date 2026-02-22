/**
 * Universal Import Hub — Auto-Mapping Engine
 *
 * Three-pass auto-mapping of source fields to target FieldDefs:
 * 1. Exact alias match (case-sensitive)
 * 2. Case-insensitive name match
 * 3. Fuzzy normalized match (strip separators, compare lowercase)
 */

import { IMPORT_TYPE_KEY } from "./types";
import type { FieldDef, FieldMapping } from "./types";

/**
 * Normalize a field name for fuzzy comparison.
 * Strips common separators, lowercases.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_.\s]+/g, "")
    .trim();
}

/**
 * Auto-map source fields to target fields using a three-pass strategy.
 * Each source field is mapped at most once; each target field is mapped at most once.
 */
export function autoMap(sourceFields: string[], targetFields: FieldDef[]): FieldMapping[] {
  const usedSources = new Set<string>();
  const mappings: FieldMapping[] = targetFields.map((f) => ({
    targetField: f.name,
    sourceField: null,
  }));

  // Pass 1: Exact alias match (case-sensitive)
  for (const mapping of mappings) {
    if (mapping.sourceField) continue;
    const field = targetFields.find((f) => f.name === mapping.targetField);
    if (!field?.aliases) continue;

    for (const alias of field.aliases) {
      const match = sourceFields.find((s) => s === alias && !usedSources.has(s));
      if (match) {
        mapping.sourceField = match;
        usedSources.add(match);
        break;
      }
    }
  }

  // Pass 2: Case-insensitive name match (target name ↔ source name)
  for (const mapping of mappings) {
    if (mapping.sourceField) continue;
    const targetLower = mapping.targetField.toLowerCase();

    const match = sourceFields.find((s) => s.toLowerCase() === targetLower && !usedSources.has(s));
    if (match) {
      mapping.sourceField = match;
      usedSources.add(match);
    }
  }

  // Pass 3: Fuzzy normalized match
  for (const mapping of mappings) {
    if (mapping.sourceField) continue;
    const targetNorm = normalize(mapping.targetField);

    // Also try aliases in normalized form
    const field = targetFields.find((f) => f.name === mapping.targetField);
    const aliasNorms = (field?.aliases ?? []).map(normalize);

    const match = sourceFields.find((s) => {
      if (usedSources.has(s)) return false;
      const sourceNorm = normalize(s);
      return sourceNorm === targetNorm || aliasNorms.includes(sourceNorm);
    });

    if (match) {
      mapping.sourceField = match;
      usedSources.add(match);
    }
  }

  return mappings;
}

/**
 * Apply a field mapping to transform source records into target-shaped records.
 * Runs field transforms and applies default values for unmapped required fields.
 */
export function applyMapping(
  records: Record<string, unknown>[],
  mapping: FieldMapping[],
  fields: FieldDef[],
): Record<string, unknown>[] {
  const fieldMap = new Map(fields.map((f) => [f.name, f]));

  return records.map((sourceRecord) => {
    const targetRecord: Record<string, unknown> = {};

    for (const m of mapping) {
      const field = fieldMap.get(m.targetField);
      if (!field) continue;

      let value: unknown;

      if (m.sourceField) {
        // Resolve nested field paths (e.g., "Aircraft.Title")
        value = resolveNestedValue(sourceRecord, m.sourceField);
      } else {
        value = field.defaultValue ?? null;
      }

      // Apply field transform
      if (field.transform && value != null) {
        value = field.transform(value);
      }

      targetRecord[field.name] = value;
    }

    return targetRecord;
  });
}

/**
 * Resolve a potentially nested field path from a record.
 * Supports dot notation: "Aircraft.Title" → record.Aircraft.Title
 */
function resolveNestedValue(record: Record<string, unknown>, fieldPath: string): unknown {
  // First try direct key (handles "Aircraft.Title" as a literal key)
  if (fieldPath in record) {
    return record[fieldPath];
  }

  // Then try dot-notation traversal
  const parts = fieldPath.split(".");
  let current: unknown = record;

  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Flatten nested source field names for auto-mapping.
 * e.g., { Aircraft: { Title: "..." } } → ["Aircraft.Title"]
 */
export function extractSourceFields(
  records: Record<string, unknown>[],
  maxDepth: number = 2,
): string[] {
  const fields = new Set<string>();

  function walk(obj: Record<string, unknown>, prefix: string, depth: number) {
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      fields.add(fullKey);

      if (
        depth < maxDepth &&
        obj[key] != null &&
        typeof obj[key] === "object" &&
        !Array.isArray(obj[key])
      ) {
        walk(obj[key] as Record<string, unknown>, fullKey, depth + 1);
      }
    }
  }

  // Sample from throughout the dataset to catch fields that only appear in some records
  const len = records.length;
  const sampleSize = Math.min(len, 100);
  const step = Math.max(1, Math.floor(len / sampleSize));
  for (let i = 0; i < len && fields.size < 500; i += step) {
    walk(records[i], "", 0);
  }

  // Remove reserved _importType key (metadata, not a data field)
  fields.delete(IMPORT_TYPE_KEY);

  return Array.from(fields).sort();
}
