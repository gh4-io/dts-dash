/**
 * Manufacturers Import Schema
 */

import { db } from "@/lib/db/client";
import { manufacturers, importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/manufacturers");

const manufacturersSchema: ImportSchema = {
  id: "manufacturers",
  display: {
    name: "Manufacturers",
    description: "Aircraft manufacturer reference data",
    icon: "fa-solid fa-industry",
    category: "Master Data",
  },
  fields: [
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Name", "manufacturer", "Manufacturer"],
      description: "Manufacturer name (e.g., Boeing, Airbus)",
    },
    {
      name: "sortOrder",
      label: "Sort Order",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["sort_order", "order", "SortOrder"],
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
    description: "Aircraft manufacturer reference data. Used as FK in aircraft models.",
    expectedFormat: 'JSON array or CSV with "name" column',
    sampleSnippet: `[
  { "name": "Boeing", "sortOrder": 1 },
  { "name": "Airbus", "sortOrder": 2 }
]`,
    notes: ["Name must be unique", "Used as foreign key in aircraft models table"],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(manufacturers).orderBy(manufacturers.sortOrder);
      return rows.map((r) => ({ name: r.name, sortOrder: r.sortOrder, isActive: r.isActive }));
    },
  },

  templateRecords: [
    { name: "Boeing", sortOrder: 1, isActive: true },
    { name: "Airbus", sortOrder: 2, isActive: true },
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
        dataType: "manufacturers",
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
      const existing = await db.select().from(manufacturers);
      const nameMap = new Map(existing.map((m) => [m.name, m]));

      for (const record of records) {
        const name = String(record.name ?? "").trim();

        if (!name) {
          warnings.push("Skipping record with empty name");
          skipped++;
          continue;
        }

        const ex = nameMap.get(name);

        if (!ex) {
          db.insert(manufacturers)
            .values({
              name,
              sortOrder: record.sortOrder != null ? Number(record.sortOrder) : 0,
              isActive: record.isActive !== false,
            })
            .run();
          inserted++;
        } else {
          const hasChanges =
            ex.sortOrder !== (record.sortOrder != null ? Number(record.sortOrder) : ex.sortOrder) ||
            ex.isActive !== (record.isActive !== false);
          if (hasChanges) {
            db.update(manufacturers)
              .set({
                sortOrder: record.sortOrder != null ? Number(record.sortOrder) : ex.sortOrder,
                isActive: record.isActive !== false,
              })
              .where(eq(manufacturers.id, ex.id))
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

      log.info({ logId, inserted, updated, skipped }, "Manufacturers import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Manufacturers import failed");
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

registerSchema(manufacturersSchema);
