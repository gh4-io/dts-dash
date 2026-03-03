/**
 * Universal Import Hub — Schema Registry
 *
 * Simple registry of ImportSchema instances keyed by id.
 * Schemas self-register by calling registerSchema() at module load time.
 */

import type { ImportSchema, SerializableSchema } from "./types";

const registry = new Map<string, ImportSchema>();

/**
 * Register an import schema. Called by each schema file at module load.
 * Throws if a schema with the same id is already registered.
 */
export function registerSchema(schema: ImportSchema): void {
  if (registry.has(schema.id)) {
    throw new Error(
      `Import schema "${schema.id}" is already registered. Duplicate registration detected.`,
    );
  }
  registry.set(schema.id, schema);
}

/**
 * Get a schema by id. Returns undefined if not found.
 */
export function getSchema(id: string): ImportSchema | undefined {
  return registry.get(id);
}

/**
 * Get all registered schemas.
 */
export function getAllSchemas(): ImportSchema[] {
  return Array.from(registry.values());
}

/**
 * Get schemas grouped by display.category.
 */
export function getSchemasByCategory(): Record<string, ImportSchema[]> {
  const grouped: Record<string, ImportSchema[]> = {};
  for (const schema of registry.values()) {
    const cat = schema.display.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(schema);
  }
  return grouped;
}

/**
 * Convert a schema to its serializable form (for API responses).
 * Strips functions, keeps metadata + fields + help.
 */
export function toSerializable(schema: ImportSchema): SerializableSchema {
  return {
    id: schema.id,
    display: schema.display,
    fields: schema.fields,
    formats: schema.formats,
    commitStrategy: schema.commitStrategy,
    dedupKey: schema.dedupKey,
    maxSizeMB: schema.maxSizeMB,
    help: schema.help,
    hasExport: !!schema.export,
    hasTemplate: !!schema.templateRecords && schema.templateRecords.length > 0,
    exportFilters: schema.export?.filters,
  };
}

/**
 * Ensure all schemas are loaded by importing the barrel.
 * Call this once at app startup (e.g., in API routes).
 */
export async function ensureSchemasLoaded(): Promise<void> {
  await import("./schemas");
}
