/**
 * Rotation Presets Import Schema
 *
 * Library of preset rotation patterns for quick-fill in the pattern editor.
 * Presets are reference data — always visible once imported, no isActive flag.
 */

import { db } from "@/lib/db/client";
import { rotationPresets, importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/rotation-presets");

const rotationPresetsSchema: ImportSchema = {
  id: "rotation-presets",
  display: {
    name: "Rotation Presets",
    description: "Library of preset rotation patterns for quick-fill in the editor",
    icon: "fa-solid fa-swatchbook",
    category: "Capacity",
  },
  fields: [
    {
      name: "code",
      label: "Code",
      type: "string",
      required: false,
      aliases: ["Code", "preset_code", "presetCode"],
      description: "Optional preset code (e.g., A, B1, CQ1)",
    },
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Name", "preset_name", "presetName"],
      description: "Display name (14 char max, e.g., R7-MTW)",
      validate: (value) => {
        if (!value || String(value).trim() === "") return "Name is required";
        if (String(value).trim().length > 14) return "Name must be 14 characters or less";
        return null;
      },
    },
    {
      name: "description",
      label: "Description",
      type: "string",
      required: false,
      aliases: ["Description", "desc"],
      description: "Longer description (e.g., 9ON/12OFF RPT7 MON,TUE,WED)",
    },
    {
      name: "pattern",
      label: "Pattern",
      type: "string",
      required: true,
      aliases: ["Pattern", "matrix21", "Matrix21", "rotation_pattern"],
      description: "21-character on/off pattern (X=work, O=off — auto-normalized to lowercase)",
      transform: (value) => {
        // Normalize: uppercase X/O → lowercase x/o, anything else → o
        return String(value ?? "")
          .toLowerCase()
          .split("")
          .map((c) => (c === "x" ? "x" : "o"))
          .join("");
      },
      validate: (value) => {
        const s = String(value ?? "").toLowerCase();
        if (s.length !== 21) return "Pattern must be exactly 21 characters";
        if (!/^[xo]+$/.test(s)) return "Pattern must contain only x/o (or X/O)";
        return null;
      },
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["name"],
  maxSizeMB: 5,

  help: {
    description:
      "Library of preset rotation patterns for the staffing editor's quick-fill feature. " +
      "Supports uppercase (X/O) or lowercase (x/o) patterns — auto-normalized to lowercase. " +
      "Deduplicates by name (upsert).",
    expectedFormat:
      'JSON array or CSV with "name" and "pattern" (or "matrix21") columns. ' +
      '"code" is optional. Also accepts wrapped format: { "data": [...] }',
    sampleSnippet: `[
  { "code": "A", "name": "R7-MTW", "description": "9ON/12OFF RPT7 MON,TUE,WED", "matrix21": "OXXXOOOOXXXOOOOXXXOOO" },
  { "code": "C", "name": "R7-RFS", "description": "9ON/12OFF RPT7 THU,FRI,SAT", "matrix21": "OOOOXXXOOOOXXXOOOOXXX" }
]`,
    notes: [
      "Pattern can use uppercase (X/O) or lowercase (x/o) — auto-normalized",
      "Name is the dedup key (upsert by name); code is optional",
      "Name max 14 characters (matches rotation pattern editor limit)",
      'Alias "matrix21" maps to "pattern" field automatically',
      'Accepts wrapped JSON format: { "desc": {...}, "data": [...] }',
    ],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(rotationPresets).orderBy(rotationPresets.code);
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
        pattern: r.pattern,
        sortOrder: r.sortOrder,
      }));
    },
  },

  templateRecords: [
    {
      code: "A",
      name: "R7-MTW",
      description: "9ON/12OFF RPT7 MON,TUE,WED",
      pattern: "oxxxooooxxxooooxxxooo",
    },
    {
      code: "C",
      name: "R7-RFS",
      description: "9ON/12OFF RPT7 THU,FRI,SAT",
      pattern: "ooooxxxooooxxxooooxxx",
    },
    {
      code: "D",
      name: "R7-UMT",
      description: "9ON/12OFF RPT7 SUN,MON,TUE",
      pattern: "xxxooooxxxooooxxxoooo",
    },
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
        dataType: "rotation-presets",
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
      const existing = await db.select().from(rotationPresets);
      const nameMap = new Map(existing.map((e) => [e.name.toLowerCase(), e]));

      for (const record of records) {
        const name = String(record.name ?? "")
          .trim()
          .slice(0, 14);
        if (!name) {
          warnings.push("Skipping record with empty name");
          skipped++;
          continue;
        }

        const pattern = String(record.pattern ?? "")
          .trim()
          .toLowerCase()
          .split("")
          .map((c) => (c === "x" ? "x" : "o"))
          .join("");
        if (pattern.length !== 21 || !/^[xo]+$/.test(pattern)) {
          warnings.push(`Skipping "${name}": invalid pattern`);
          skipped++;
          continue;
        }

        const code = record.code ? String(record.code).trim() : null;
        const description = record.description ? String(record.description).trim() : null;
        const sortOrder = record.sortOrder != null ? Number(record.sortOrder) : 0;

        const ex = nameMap.get(name.toLowerCase());
        if (!ex) {
          db.insert(rotationPresets)
            .values({
              code,
              name,
              description,
              pattern,
              sortOrder,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          inserted++;
        } else {
          db.update(rotationPresets)
            .set({ code, description, pattern, sortOrder, updatedAt: now })
            .where(eq(rotationPresets.id, ex.id))
            .run();
          updated++;
        }
      }

      db.update(importLog)
        .set({
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
        })
        .where(eq(importLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Rotation presets import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Rotation presets import failed");
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

registerSchema(rotationPresetsSchema);
