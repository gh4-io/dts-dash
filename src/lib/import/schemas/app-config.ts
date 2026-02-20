/**
 * App Config Import Schema
 *
 * Key-value pairs for application configuration.
 * Useful for backup/restore of settings.
 */

import { db } from "@/lib/db/client";
import { appConfig, unifiedImportLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/app-config");

const appConfigSchema: ImportSchema = {
  id: "app-config",
  display: {
    name: "App Config",
    description: "Application configuration key-value pairs",
    icon: "fa-solid fa-sliders",
    category: "Configuration",
  },
  fields: [
    {
      name: "key",
      label: "Key",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Key", "setting", "name", "config_key"],
      description: "Configuration key (e.g., ingestMaxSizeMB)",
    },
    {
      name: "value",
      label: "Value",
      type: "string",
      required: true,
      aliases: ["Value", "val", "config_value"],
      description: "Configuration value (stored as text)",
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["key"],
  maxSizeMB: 1,

  help: {
    description:
      "Application configuration stored as key-value pairs. Useful for backing up and restoring system settings.",
    expectedFormat: 'JSON array or CSV with "key" and "value" columns',
    sampleSnippet: `[
  { "key": "ingestMaxSizeMB", "value": "50" },
  { "key": "defaultTheme", "value": "neutral" }
]`,
    notes: [
      "All values are stored as text strings",
      "Existing keys are overwritten with new values",
      "This does NOT include server.config.yml settings",
    ],
    troubleshooting: [{ error: "Missing key", fix: "Every record must have a non-empty key" }],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(appConfig);
      return rows.map((r) => ({ key: r.key, value: r.value }));
    },
  },

  templateRecords: [
    { key: "ingestMaxSizeMB", value: "50" },
    { key: "defaultTheme", value: "neutral" },
  ],

  async commit(records, ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const logEntry = db
      .insert(unifiedImportLog)
      .values({
        importedAt: now,
        dataType: "app-config",
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
      const existing = await db.select().from(appConfig);
      const keyMap = new Map(existing.map((c) => [c.key, c]));

      for (const record of records) {
        const key = String(record.key).trim();
        const value = String(record.value);

        const ex = keyMap.get(key);

        if (!ex) {
          db.insert(appConfig).values({ key, value, updatedAt: now }).run();
          inserted++;
        } else if (ex.value !== value) {
          db.update(appConfig).set({ value, updatedAt: now }).where(eq(appConfig.key, key)).run();
          updated++;
        } else {
          skipped++;
        }
      }

      db.update(unifiedImportLog)
        .set({ recordsInserted: inserted, recordsUpdated: updated, recordsSkipped: skipped })
        .where(eq(unifiedImportLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "App config import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "App config import failed");
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

registerSchema(appConfigSchema);
