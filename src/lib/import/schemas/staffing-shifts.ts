/**
 * Staffing Shifts Import Schema
 *
 * Shift definitions within a staffing config, combining rotation patterns
 * with shift times, headcount, and category assignments.
 */

import { db } from "@/lib/db/client";
import { staffingShifts, staffingConfigs, rotationPatterns, importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/staffing-shifts");

const VALID_CATEGORIES = ["DAY", "SWING", "NIGHT", "OTHER"];

const staffingShiftsSchema: ImportSchema = {
  id: "staffing-shifts",
  display: {
    name: "Staffing Shifts",
    description: "Shift definitions with rotation patterns, times, and headcount",
    icon: "fa-solid fa-layer-group",
    category: "Capacity",
  },
  fields: [
    {
      name: "name",
      label: "Name",
      type: "string",
      required: true,
      isKey: true,
      aliases: ["Name", "shift_name", "shiftName"],
      description: "Shift name (e.g., Day 10FSS, Night Standard)",
      validate: (value) => {
        if (!value || String(value).trim() === "") return "Name is required";
        return null;
      },
    },
    {
      name: "configId",
      label: "Config ID",
      type: "number",
      required: true,
      aliases: ["config_id", "configId"],
      description: "ID of the staffing config this shift belongs to",
    },
    {
      name: "category",
      label: "Category",
      type: "string",
      required: true,
      aliases: ["Category", "shift_category"],
      description: "Shift category: DAY, SWING, NIGHT, or OTHER",
      validate: (value) => {
        if (!VALID_CATEGORIES.includes(String(value ?? "").toUpperCase()))
          return "Category must be DAY, SWING, NIGHT, or OTHER";
        return null;
      },
    },
    {
      name: "rotationName",
      label: "Rotation Name",
      type: "string",
      required: true,
      aliases: ["rotation_name", "rotationName", "rotation"],
      description: "Name of the rotation pattern to use (must exist)",
    },
    {
      name: "rotationStartDate",
      label: "Rotation Start",
      type: "string",
      required: true,
      aliases: ["rotation_start_date", "rotationStartDate"],
      description: "Rotation anchor date (YYYY-MM-DD)",
    },
    {
      name: "startHour",
      label: "Start Hour",
      type: "number",
      required: true,
      aliases: ["start_hour", "StartHour"],
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n) || n < 0 || n > 23) return "Start hour must be 0-23";
        return null;
      },
    },
    {
      name: "startMinute",
      label: "Start Min",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["start_minute", "StartMinute"],
    },
    {
      name: "endHour",
      label: "End Hour",
      type: "number",
      required: true,
      aliases: ["end_hour", "EndHour"],
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n) || n < 0 || n > 23) return "End hour must be 0-23";
        return null;
      },
    },
    {
      name: "endMinute",
      label: "End Min",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["end_minute", "EndMinute"],
    },
    {
      name: "breakMinutes",
      label: "Break (min)",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["break_minutes", "breakMinutes"],
    },
    {
      name: "lunchMinutes",
      label: "Lunch (min)",
      type: "number",
      required: false,
      defaultValue: 0,
      aliases: ["lunch_minutes", "lunchMinutes"],
    },
    {
      name: "mhOverride",
      label: "MH Override",
      type: "number",
      required: false,
      aliases: ["mh_override", "mhOverride"],
      description: "Paid hours override (if blank, computed from shift times minus breaks)",
    },
    {
      name: "headcount",
      label: "Headcount",
      type: "number",
      required: true,
      aliases: ["Headcount", "head_count"],
      description: "Number of AMTs assigned to this shift",
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n) || n < 0) return "Headcount must be >= 0";
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
  dedupKey: ["name", "configId"],
  maxSizeMB: 5,

  help: {
    description:
      "Staffing shift definitions that combine a rotation pattern with shift times, " +
      "category (Day/Swing/Night/Other), and headcount. Each shift references a rotation " +
      "pattern by name and belongs to a staffing config by ID.",
    expectedFormat:
      'JSON array or CSV with "name", "configId", "category", and "rotationName" columns',
    sampleSnippet: `[
  { "name": "Day 10FSS", "configId": 1, "category": "DAY", "rotationName": "Weekend Bridge", "rotationStartDate": "2026-01-04", "startHour": 7, "endHour": 17, "headcount": 8 },
  { "name": "Night Standard", "configId": 1, "category": "NIGHT", "rotationName": "Standard 5-2", "rotationStartDate": "2026-01-04", "startHour": 23, "endHour": 7, "headcount": 12 }
]`,
    notes: [
      "Rotation pattern must exist (matched by name, case-insensitive)",
      "Config ID must reference an existing staffing config",
      "Category must be DAY, SWING, NIGHT, or OTHER",
      "Dedup key is name + configId (upsert within same config)",
    ],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(staffingShifts).orderBy(staffingShifts.sortOrder);
      const allPatterns = await db.select().from(rotationPatterns);
      const patternMap = new Map(allPatterns.map((p) => [p.id, p.name]));

      return rows.map((r) => ({
        name: r.name,
        configId: r.configId,
        category: r.category,
        rotationName:
          (r.rotationId ? patternMap.get(r.rotationId) : null) ?? String(r.rotationId ?? 0),
        rotationStartDate: r.rotationStartDate,
        startHour: r.startHour,
        startMinute: r.startMinute,
        endHour: r.endHour,
        endMinute: r.endMinute,
        breakMinutes: r.breakMinutes,
        lunchMinutes: r.lunchMinutes,
        mhOverride: r.mhOverride,
        headcount: r.headcount,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      }));
    },
  },

  templateRecords: [
    {
      name: "Day Standard",
      configId: 1,
      category: "DAY",
      rotationName: "Standard 5-2",
      rotationStartDate: "2026-01-04",
      startHour: 7,
      endHour: 15,
      headcount: 10,
    },
    {
      name: "Night Standard",
      configId: 1,
      category: "NIGHT",
      rotationName: "Standard 5-2",
      rotationStartDate: "2026-01-04",
      startHour: 23,
      endHour: 7,
      headcount: 8,
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
        dataType: "staffing-shifts",
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
      // Build lookup maps
      const allPatterns = await db.select().from(rotationPatterns);
      const patternNameMap = new Map(allPatterns.map((p) => [p.name.toLowerCase(), p.id]));

      const allConfigs = await db.select().from(staffingConfigs);
      const configIdSet = new Set(allConfigs.map((c) => c.id));

      const existingShifts = await db.select().from(staffingShifts);
      const shiftKey = (name: string, configId: number) => `${name.toLowerCase()}::${configId}`;
      const shiftMap = new Map(existingShifts.map((s) => [shiftKey(s.name, s.configId), s]));

      for (const record of records) {
        const name = String(record.name ?? "").trim();
        if (!name) {
          warnings.push("Skipping record with empty name");
          skipped++;
          continue;
        }

        const configId = Number(record.configId);
        if (!configIdSet.has(configId)) {
          warnings.push(`Skipping "${name}": config ID ${configId} not found`);
          skipped++;
          continue;
        }

        const rotationName = String(record.rotationName ?? "").trim();
        const rotationId = patternNameMap.get(rotationName.toLowerCase());
        if (!rotationId) {
          warnings.push(`Skipping "${name}": rotation "${rotationName}" not found`);
          skipped++;
          continue;
        }

        const category = String(record.category ?? "").toUpperCase() as
          | "DAY"
          | "SWING"
          | "NIGHT"
          | "OTHER";
        if (!VALID_CATEGORIES.includes(category)) {
          warnings.push(`Skipping "${name}": invalid category "${category}"`);
          skipped++;
          continue;
        }

        const values = {
          configId,
          name,
          category,
          rotationId,
          rotationStartDate: String(record.rotationStartDate ?? ""),
          startHour: Number(record.startHour ?? 0),
          startMinute: Number(record.startMinute ?? 0),
          endHour: Number(record.endHour ?? 0),
          endMinute: Number(record.endMinute ?? 0),
          breakMinutes: Number(record.breakMinutes ?? 0),
          lunchMinutes: Number(record.lunchMinutes ?? 0),
          mhOverride: record.mhOverride != null ? Number(record.mhOverride) : null,
          headcount: Number(record.headcount ?? 0),
          isActive: record.isActive !== false,
          sortOrder: Number(record.sortOrder ?? 0),
        };

        const ex = shiftMap.get(shiftKey(name, configId));
        if (!ex) {
          db.insert(staffingShifts)
            .values({ ...values, createdAt: now, updatedAt: now })
            .run();
          inserted++;
        } else {
          db.update(staffingShifts)
            .set({ ...values, updatedAt: now })
            .where(eq(staffingShifts.id, ex.id))
            .run();
          updated++;
        }
      }

      db.update(importLog)
        .set({ recordsInserted: inserted, recordsUpdated: updated, recordsSkipped: skipped })
        .where(eq(importLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Staffing shifts import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Staffing shifts import failed");
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

registerSchema(staffingShiftsSchema);
