/**
 * Rotation Patterns Import Schema
 *
 * 3-week rotation cycle definitions used by the staffing matrix.
 */

import { db } from "@/lib/db/client";
import { rotationPatterns, importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/rotation-patterns");

const rotationPatternsSchema: ImportSchema = {
  id: "rotation-patterns",
  display: {
    name: "Rotation Patterns",
    description: "3-week rotation cycle definitions (21-day on/off patterns)",
    icon: "fa-solid fa-calendar-days",
    category: "Capacity",
  },
  fields: [
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Name", "pattern_name", "patternName"],
      description: "Unique pattern name (e.g., Standard 5-2, Panama 2-2-3)",
      validate: (value) => {
        if (!value || String(value).trim() === "") return "Name is required";
        return null;
      },
    },
    {
      name: "description",
      label: "Description",
      type: "string",
      required: false,
      aliases: ["Description", "desc"],
      description: "Optional description (e.g., 9ON/12OFF RPT7 MON,TUE,WED)",
    },
    {
      name: "pattern",
      label: "Pattern",
      type: "string",
      required: true,
      aliases: ["Pattern", "rotation_pattern", "rotationPattern", "code", "matrix21", "Matrix21"],
      description: "21-character string of x/X (work) and o/O (off) — auto-normalized to lowercase",
      transform: (value) => {
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
    {
      name: "isActive",
      label: "Active",
      type: "boolean",
      required: false,
      defaultValue: true,
      aliases: ["is_active", "active"],
    },
    {
      name: "sortOrder",
      label: "Sort Order",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["sort_order", "SortOrder"],
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["name"],
  maxSizeMB: 5,

  help: {
    description:
      "3-week rotation cycle definitions used by the staffing matrix. " +
      "Each pattern is a 21-character string where 'x' = work day and 'o' = off day, " +
      "representing 3 weeks (Sun-Sat) of a repeating cycle.",
    expectedFormat: 'JSON array or CSV with "name" and "pattern" columns',
    sampleSnippet: `[
  { "name": "Standard 5-2", "pattern": "oxxxxoxoxxxxoxoxxxxox" },
  { "name": "Compressed 4-3", "pattern": "oxxxxoooxxxxoooxxxxoo" },
  { "name": "Weekend Bridge", "pattern": "xooooxxxooooxxxoooox" }
]`,
    notes: [
      "Pattern must be exactly 21 characters (3 weeks × 7 days)",
      "Use 'x' for work days and 'o' for off days",
      "Name is used as dedup key (upsert by name)",
      "Day order: Sun, Mon, Tue, Wed, Thu, Fri, Sat (repeated 3×)",
    ],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(rotationPatterns).orderBy(rotationPatterns.sortOrder);
      return rows.map((r) => ({
        name: r.name,
        description: r.description,
        pattern: r.pattern,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      }));
    },
  },

  templateRecords: [
    { name: "Standard 5-2", pattern: "oxxxxoxoxxxxoxoxxxxox" },
    { name: "Compressed 4-3", pattern: "oxxxxoooxxxxoooxxxxoo" },
    { name: "Weekend Bridge", pattern: "xooooxxxooooxxxoooox" },
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
        dataType: "rotation-patterns",
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
      const existing = await db.select().from(rotationPatterns);
      const nameMap = new Map(existing.map((e) => [e.name.toLowerCase(), e]));

      for (const record of records) {
        const name = String(record.name ?? "").trim();
        if (!name) {
          warnings.push("Skipping record with empty name");
          skipped++;
          continue;
        }

        const pattern = String(record.pattern ?? "")
          .trim()
          .toLowerCase();
        if (pattern.length !== 21 || !/^[xo]+$/.test(pattern)) {
          warnings.push(`Skipping "${name}": invalid pattern`);
          skipped++;
          continue;
        }

        const description = record.description ? String(record.description).trim() : null;
        const sortOrder = record.sortOrder != null ? Number(record.sortOrder) : 0;
        const isActive = record.isActive !== false;

        const ex = nameMap.get(name.toLowerCase());
        if (!ex) {
          db.insert(rotationPatterns)
            .values({
              name,
              description,
              pattern,
              isActive,
              sortOrder,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          inserted++;
        } else {
          db.update(rotationPatterns)
            .set({ description, pattern, isActive, sortOrder, updatedAt: now })
            .where(eq(rotationPatterns.id, ex.id))
            .run();
          updated++;
        }
      }

      db.update(importLog)
        .set({ recordsInserted: inserted, recordsUpdated: updated, recordsSkipped: skipped })
        .where(eq(importLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Rotation patterns import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Rotation patterns import failed");
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

registerSchema(rotationPatternsSchema);
