/**
 * Engine Types Import Schema
 */

import { db } from "@/lib/db/client";
import { engineTypes, importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/engine-types");

const engineTypesSchema: ImportSchema = {
  id: "engine-types",
  display: {
    name: "Engine Types",
    description: "Aircraft engine type reference data",
    icon: "fa-solid fa-fan",
    category: "Master Data",
  },
  fields: [
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Name", "engine", "Engine", "engineType"],
      description: "Engine type name (e.g., CF6-80C2, PW4000)",
    },
    {
      name: "manufacturer",
      label: "Manufacturer",
      type: "string",
      required: false,
      aliases: ["Manufacturer", "mfr", "engine_manufacturer"],
      description: "Engine manufacturer (e.g., GE, Pratt & Whitney, Rolls-Royce)",
    },
    {
      name: "sortOrder",
      label: "Sort Order",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["sort_order"],
    },
    {
      name: "isActive",
      label: "Active",
      type: "boolean",
      required: false,
      defaultValue: true,
      aliases: ["is_active", "active"],
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["name"],
  maxSizeMB: 5,

  help: {
    description: "Engine type reference data. Used as FK in aircraft records.",
    expectedFormat: 'JSON array or CSV with "name" column',
    sampleSnippet: `[
  { "name": "CF6-80C2", "manufacturer": "GE Aviation" },
  { "name": "PW4000", "manufacturer": "Pratt & Whitney" }
]`,
    notes: ["Name must be unique", "Used as foreign key in aircraft table"],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(engineTypes).orderBy(engineTypes.sortOrder);
      return rows.map((r) => ({
        name: r.name,
        manufacturer: r.manufacturer,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      }));
    },
  },

  templateRecords: [
    { name: "CF6-80C2", manufacturer: "GE Aviation", sortOrder: 1 },
    { name: "PW4000", manufacturer: "Pratt & Whitney", sortOrder: 2 },
  ],

  async commit(records, ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const logEntry = db
      .insert(importLog)
      .values({
        importedAt: now,
        dataType: "engine-types",
        source: ctx.source,
        format: ctx.format,
        fileName: ctx.fileName || null,
        importedBy: ctx.userId,
        status: "success",
        recordCount: records.length,
      })
      .returning({ id: importLog.id })
      .get();
    const logId = logEntry.id;

    try {
      const existing = await db.select().from(engineTypes);
      const nameMap = new Map(existing.map((e) => [e.name, e]));

      for (const record of records) {
        const name = String(record.name ?? "").trim();

        if (!name) {
          warnings.push("Skipping record with empty name");
          skipped++;
          continue;
        }

        const ex = nameMap.get(name);

        if (!ex) {
          db.insert(engineTypes)
            .values({
              name,
              manufacturer: record.manufacturer ? String(record.manufacturer).trim() : null,
              sortOrder: record.sortOrder != null ? Number(record.sortOrder) : 0,
              isActive: record.isActive !== false,
            })
            .run();
          inserted++;
        } else {
          const hasChanges =
            ex.manufacturer !==
              (record.manufacturer ? String(record.manufacturer).trim() : ex.manufacturer) ||
            ex.sortOrder !== (record.sortOrder != null ? Number(record.sortOrder) : ex.sortOrder);
          if (hasChanges) {
            db.update(engineTypes)
              .set({
                manufacturer: record.manufacturer
                  ? String(record.manufacturer).trim()
                  : ex.manufacturer,
                sortOrder: record.sortOrder != null ? Number(record.sortOrder) : ex.sortOrder,
                isActive: record.isActive !== false,
              })
              .where(eq(engineTypes.id, ex.id))
              .run();
            updated++;
          } else {
            skipped++;
          }
        }
      }

      db.update(importLog)
        .set({ recordsInserted: inserted, recordsUpdated: updated, recordsSkipped: skipped })
        .where(eq(importLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Engine types import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Engine types import failed");
      db.update(importLog)
        .set({ status: "failed", errors: JSON.stringify([errMsg]) })
        .where(eq(importLog.id, logId))
        .run();
    }

    return {
      success: errors.length === 0,
      logId,
      recordCount: records.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      errors,
      warnings,
    };
  },
};

registerSchema(engineTypesSchema);
