/**
 * Aircraft Models Import Schema
 */

import { db } from "@/lib/db/client";
import { aircraftModels, manufacturers, unifiedImportLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/aircraft-models");

const CANONICAL_TYPES = ["B777", "B767", "B747", "B757", "B737", "Unknown"];

const aircraftModelsSchema: ImportSchema = {
  id: "aircraft-models",
  display: {
    name: "Aircraft Models",
    description: "Aircraft model codes with manufacturer and canonical type",
    icon: "fa-solid fa-plane-up",
    category: "Master Data",
  },
  fields: [
    {
      name: "modelCode",
      label: "Model Code",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["model_code", "ModelCode", "code", "model"],
      description: "Unique model code (e.g., 767-300F, 747-400)",
    },
    {
      name: "canonicalType",
      label: "Canonical Type",
      type: "string",
      required: false,
      aliases: ["canonical_type", "CanonicalType", "type"],
      description: `Normalized type (${CANONICAL_TYPES.join(", ")})`,
      validate: (value) => {
        if (value && !CANONICAL_TYPES.includes(String(value))) {
          return `Must be one of: ${CANONICAL_TYPES.join(", ")}`;
        }
        return null;
      },
    },
    {
      name: "manufacturer",
      label: "Manufacturer",
      type: "string",
      required: false,
      aliases: ["Manufacturer", "mfr"],
      description: "Manufacturer name (resolved to FK)",
    },
    {
      name: "displayName",
      label: "Display Name",
      type: "string",
      required: false,
      aliases: ["display_name", "DisplayName"],
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
  dedupKey: ["modelCode"],
  maxSizeMB: 5,

  help: {
    description:
      "Aircraft model reference data with canonical type classification and manufacturer linkage.",
    expectedFormat: 'JSON array or CSV with "modelCode" column',
    sampleSnippet: `[
  { "modelCode": "767-300F", "canonicalType": "B767", "manufacturer": "Boeing" },
  { "modelCode": "747-400", "canonicalType": "B747", "manufacturer": "Boeing" }
]`,
    notes: [
      "Model code must be unique",
      "Manufacturer is resolved to FK by name lookup",
      `Valid canonical types: ${CANONICAL_TYPES.join(", ")}`,
    ],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(aircraftModels).orderBy(aircraftModels.sortOrder);
      // Resolve manufacturer names
      const mfrs = await db.select().from(manufacturers);
      const mfrMap = new Map(mfrs.map((m) => [m.id, m.name]));
      return rows.map((r) => ({
        modelCode: r.modelCode,
        canonicalType: r.canonicalType,
        manufacturer: r.manufacturerId ? mfrMap.get(r.manufacturerId) || null : null,
        displayName: r.displayName,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      }));
    },
  },

  templateRecords: [
    {
      modelCode: "767-300F",
      canonicalType: "B767",
      manufacturer: "Boeing",
      displayName: "767-300 Freighter",
      sortOrder: 1,
    },
    {
      modelCode: "747-400",
      canonicalType: "B747",
      manufacturer: "Boeing",
      displayName: "747-400",
      sortOrder: 2,
    },
  ],

  async commit(records, ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];
    let inserted = 0;
    let updated = 0;
    const skipped = 0;

    const logEntry = db
      .insert(unifiedImportLog)
      .values({
        importedAt: now,
        dataType: "aircraft-models",
        source: ctx.source,
        format: ctx.format,
        fileName: ctx.fileName || null,
        importedBy: ctx.userId,
        status: "success",
        recordsTotal: records.length,
      })
      .returning({ id: unifiedImportLog.id })
      .get();
    const logId = logEntry.id;

    try {
      const existing = await db.select().from(aircraftModels);
      const codeMap = new Map(existing.map((m) => [m.modelCode, m]));

      // Resolve manufacturer names to IDs
      const mfrs = await db.select().from(manufacturers);
      const mfrNameMap = new Map(mfrs.map((m) => [m.name, m.id]));

      for (const record of records) {
        const modelCode = String(record.modelCode).trim();
        const manufacturerId = record.manufacturer
          ? (mfrNameMap.get(String(record.manufacturer).trim()) ?? null)
          : null;

        if (record.manufacturer && !manufacturerId) {
          warnings.push(`Model "${modelCode}": manufacturer "${record.manufacturer}" not found`);
        }

        const ex = codeMap.get(modelCode);

        if (!ex) {
          db.insert(aircraftModels)
            .values({
              modelCode,
              canonicalType: record.canonicalType ? String(record.canonicalType) : "Unknown",
              manufacturerId,
              displayName: record.displayName ? String(record.displayName) : modelCode,
              sortOrder: record.sortOrder != null ? Number(record.sortOrder) : 0,
              isActive: record.isActive !== false,
            })
            .run();
          inserted++;
        } else {
          db.update(aircraftModels)
            .set({
              canonicalType: record.canonicalType ? String(record.canonicalType) : ex.canonicalType,
              manufacturerId: manufacturerId ?? ex.manufacturerId,
              displayName: record.displayName ? String(record.displayName) : ex.displayName,
              sortOrder: record.sortOrder != null ? Number(record.sortOrder) : ex.sortOrder,
              isActive: record.isActive !== false,
            })
            .where(eq(aircraftModels.id, ex.id))
            .run();
          updated++;
        }
      }

      db.update(unifiedImportLog)
        .set({
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
        })
        .where(eq(unifiedImportLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Aircraft models import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Aircraft models import failed");
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

registerSchema(aircraftModelsSchema);
