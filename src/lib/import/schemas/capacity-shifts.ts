/**
 * Capacity Shifts Import Schema
 *
 * Reference data for shift windows (Day/Swing/Night) used by the capacity modeling engine.
 */

import { db } from "@/lib/db/client";
import { capacityShifts, importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/capacity-shifts");

const capacityShiftsSchema: ImportSchema = {
  id: "capacity-shifts",
  display: {
    name: "Capacity Shifts",
    description: "Shift window definitions for capacity modeling",
    icon: "fa-solid fa-clock",
    category: "Capacity",
  },
  fields: [
    {
      name: "code",
      label: "Code",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Code", "shift_code", "shiftCode"],
      description: "Unique shift code (e.g., DAY, SWING, NIGHT)",
      validate: (value) => {
        if (!value || String(value).trim() === "") return "Shift code is required";
        return null;
      },
    },
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
      aliases: ["Name", "shift_name", "shiftName"],
      description: "Display name (e.g., Day, Swing, Night)",
    },
    {
      name: "startHour",
      label: "Start Hour",
      type: "number",
      required: true,
      aliases: ["start_hour", "StartHour"],
      description: "Shift start hour (0-23)",
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n) || n < 0 || n > 23) return "Start hour must be 0-23";
        return null;
      },
    },
    {
      name: "endHour",
      label: "End Hour",
      type: "number",
      required: true,
      aliases: ["end_hour", "EndHour"],
      description: "Shift end hour (0-23). May be less than startHour for overnight shifts.",
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n) || n < 0 || n > 23) return "End hour must be 0-23";
        return null;
      },
    },
    {
      name: "paidHours",
      label: "Paid Hours",
      type: "number",
      required: true,
      aliases: ["paid_hours", "PaidHours"],
      description: "Paid hours per shift (e.g., 8.0)",
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n) || n <= 0 || n > 24) return "Paid hours must be between 0 and 24";
        return null;
      },
    },
    {
      name: "minHeadcount",
      label: "Min Headcount",
      type: "number",
      required: false,
      defaultValue: 1,
      aliases: ["min_headcount", "MinHeadcount"],
      description: "Minimum headcount for staffing warnings",
    },
    {
      name: "sortOrder",
      label: "Sort Order",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["sort_order", "SortOrder"],
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
  dedupKey: ["code"],
  maxSizeMB: 5,

  help: {
    description:
      "Shift window definitions used by the capacity modeling engine. " +
      "Defines time ranges and paid hours for each shift (e.g., Day 07-15, Swing 15-23, Night 23-07).",
    expectedFormat: 'JSON array or CSV with "code" column',
    sampleSnippet: `[
  { "code": "DAY", "name": "Day", "startHour": 7, "endHour": 15, "paidHours": 8.0, "minHeadcount": 2 },
  { "code": "SWING", "name": "Swing", "startHour": 15, "endHour": 23, "paidHours": 8.0 },
  { "code": "NIGHT", "name": "Night", "startHour": 23, "endHour": 7, "paidHours": 8.0 }
]`,
    notes: [
      "Code must be unique (used as dedup key)",
      "Overnight shifts: endHour < startHour (e.g., Night 23-07)",
      "Used as FK reference by headcount plans and exceptions",
    ],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(capacityShifts).orderBy(capacityShifts.sortOrder);
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        startHour: r.startHour,
        endHour: r.endHour,
        paidHours: r.paidHours,
        minHeadcount: r.minHeadcount,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      }));
    },
  },

  templateRecords: [
    { code: "DAY", name: "Day", startHour: 7, endHour: 15, paidHours: 8.0, minHeadcount: 2 },
    { code: "SWING", name: "Swing", startHour: 15, endHour: 23, paidHours: 8.0, minHeadcount: 1 },
    { code: "NIGHT", name: "Night", startHour: 23, endHour: 7, paidHours: 8.0, minHeadcount: 1 },
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
        dataType: "capacity-shifts",
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
      const existing = await db.select().from(capacityShifts);
      const codeMap = new Map(existing.map((e) => [e.code, e]));

      for (const record of records) {
        const code = String(record.code ?? "")
          .trim()
          .toUpperCase();

        if (!code) {
          warnings.push("Skipping record with empty code");
          skipped++;
          continue;
        }

        const ex = codeMap.get(code);
        const name = String(record.name ?? code).trim();
        const startHour = Number(record.startHour ?? 0);
        const endHour = Number(record.endHour ?? 0);
        const paidHours = Number(record.paidHours ?? 8.0);
        const minHeadcount = record.minHeadcount != null ? Number(record.minHeadcount) : 1;
        const sortOrder = record.sortOrder != null ? Number(record.sortOrder) : 0;
        const isActive = record.isActive !== false;

        if (!ex) {
          db.insert(capacityShifts)
            .values({
              code,
              name,
              startHour,
              endHour,
              paidHours,
              minHeadcount,
              sortOrder,
              isActive,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          inserted++;
        } else {
          db.update(capacityShifts)
            .set({
              name,
              startHour,
              endHour,
              paidHours,
              minHeadcount,
              sortOrder,
              isActive,
              updatedAt: now,
            })
            .where(eq(capacityShifts.id, ex.id))
            .run();
          updated++;
        }
      }

      db.update(importLog)
        .set({ recordsInserted: inserted, recordsUpdated: updated, recordsSkipped: skipped })
        .where(eq(importLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Capacity shifts import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Capacity shifts import failed");
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

registerSchema(capacityShiftsSchema);
