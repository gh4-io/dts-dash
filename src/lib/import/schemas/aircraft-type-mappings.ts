/**
 * Aircraft Type Mappings Import Schema
 *
 * Pattern-based normalization rules for aircraft types.
 * Replaces the dedicated aircraft type editor.
 */

import { db } from "@/lib/db/client";
import { aircraftTypeMappings, unifiedImportLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/aircraft-type-mappings");

const CANONICAL_TYPES = ["B777", "B767", "B747", "B757", "B737", "Unknown"];

const aircraftTypeMappingsSchema: ImportSchema = {
  id: "aircraft-type-mappings",
  display: {
    name: "Aircraft Type Mappings",
    description: "Pattern-based normalization rules for aircraft types",
    icon: "fa-solid fa-plane-circle-check",
    category: "Master Data",
  },
  fields: [
    {
      name: "pattern",
      label: "Pattern",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Pattern", "raw_type", "rawType"],
      description: "Regex or substring pattern to match raw aircraft type strings",
    },
    {
      name: "canonicalType",
      label: "Canonical Type",
      type: "string",
      required: true,
      aliases: ["canonical_type", "CanonicalType", "type", "normalized"],
      description: `Normalized type (${CANONICAL_TYPES.join(", ")})`,
      validate: (value) => {
        if (!CANONICAL_TYPES.includes(String(value))) {
          return `Must be one of: ${CANONICAL_TYPES.join(", ")}`;
        }
        return null;
      },
    },
    {
      name: "description",
      label: "Description",
      type: "string",
      required: false,
      aliases: ["Description", "desc", "note"],
      description: "Optional description of what this pattern matches",
    },
    {
      name: "priority",
      label: "Priority",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["Priority", "order", "weight"],
      description: "Higher priority patterns are evaluated first",
    },
    {
      name: "isActive",
      label: "Active",
      type: "boolean",
      required: false,
      defaultValue: true,
      aliases: ["is_active", "active", "enabled"],
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["pattern"],
  maxSizeMB: 5,

  help: {
    description:
      "Aircraft type mapping rules normalize raw aircraft type strings (e.g., '767-300(F)', 'B747-4R7F') to canonical types (B777, B767, B747, B757, B737, Unknown). Higher priority patterns are evaluated first.",
    expectedFormat: 'JSON array or CSV with "pattern" and "canonicalType" columns',
    sampleSnippet: `[
  { "pattern": "767", "canonicalType": "B767", "priority": 10 },
  { "pattern": "747", "canonicalType": "B747", "priority": 10 }
]`,
    notes: [
      "Patterns are matched as substrings against raw type strings",
      "Higher priority patterns are evaluated first",
      `Valid canonical types: ${CANONICAL_TYPES.join(", ")}`,
    ],
    troubleshooting: [
      {
        error: "Invalid canonical type",
        fix: `Use one of: ${CANONICAL_TYPES.join(", ")}`,
      },
    ],
  },

  export: {
    query: async () => {
      const rows = await db
        .select()
        .from(aircraftTypeMappings)
        .orderBy(aircraftTypeMappings.priority);
      return rows.map((r) => ({
        pattern: r.pattern,
        canonicalType: r.canonicalType,
        description: r.description,
        priority: r.priority,
        isActive: r.isActive,
      }));
    },
    defaultSort: "priority",
  },

  templateRecords: [
    {
      pattern: "767",
      canonicalType: "B767",
      description: "All 767 variants",
      priority: 10,
      isActive: true,
    },
    {
      pattern: "747",
      canonicalType: "B747",
      description: "All 747 variants",
      priority: 10,
      isActive: true,
    },
    {
      pattern: "777",
      canonicalType: "B777",
      description: "All 777 variants",
      priority: 10,
      isActive: true,
    },
  ],

  async commit(records, ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Create log entry
    const logEntry = db
      .insert(unifiedImportLog)
      .values({
        importedAt: now,
        dataType: "aircraft-type-mappings",
        source: ctx.source,
        format: ctx.format,
        fileName: ctx.fileName || null,
        importedBy: ctx.userId,
        status: "success",
        recordsTotal: records.length,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
      })
      .returning({ id: unifiedImportLog.id })
      .get();

    const logId = logEntry.id;

    try {
      // Fetch existing mappings
      const existing = await db.select().from(aircraftTypeMappings);
      const existingMap = new Map(existing.map((m) => [m.pattern, m]));

      for (const record of records) {
        const pattern = String(record.pattern).trim();
        const canonicalType = String(record.canonicalType).trim() as
          | "B777"
          | "B767"
          | "B747"
          | "B757"
          | "B737"
          | "Unknown";

        const existing = existingMap.get(pattern);

        if (!existing) {
          db.insert(aircraftTypeMappings)
            .values({
              pattern,
              canonicalType,
              description: record.description ? String(record.description) : null,
              priority: record.priority != null ? Number(record.priority) : 0,
              isActive: record.isActive !== false,
            })
            .run();
          inserted++;
        } else {
          // Update if changed
          const hasChanges =
            existing.canonicalType !== canonicalType ||
            existing.description !== (record.description ? String(record.description) : null) ||
            existing.priority !== (record.priority != null ? Number(record.priority) : 0);

          if (hasChanges) {
            db.update(aircraftTypeMappings)
              .set({
                canonicalType: canonicalType as
                  | "B777"
                  | "B767"
                  | "B747"
                  | "B757"
                  | "B737"
                  | "Unknown",
                description: record.description ? String(record.description) : null,
                priority: record.priority != null ? Number(record.priority) : existing.priority,
                updatedAt: now,
              })
              .where(eq(aircraftTypeMappings.id, existing.id))
              .run();
            updated++;
          } else {
            skipped++;
          }
        }
      }

      // Update log
      db.update(unifiedImportLog)
        .set({ recordsInserted: inserted, recordsUpdated: updated, recordsSkipped: skipped })
        .where(eq(unifiedImportLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Aircraft type mappings import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Aircraft type mappings import failed");

      db.update(unifiedImportLog)
        .set({ status: "failed", errors: JSON.stringify([errMsg]) })
        .where(eq(unifiedImportLog.id, logId))
        .run();
    }

    return {
      success: errors.length === 0,
      logId,
      recordsTotal: records.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      errors,
      warnings,
    };
  },
};

registerSchema(aircraftTypeMappingsSchema);
