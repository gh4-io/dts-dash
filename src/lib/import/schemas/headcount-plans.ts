/**
 * Headcount Plans Import Schema
 *
 * Effective-dated headcount targets per shift for capacity modeling.
 * Supports base headcount with optional weekday overrides.
 */

import { db } from "@/lib/db/client";
import { headcountPlans, capacityShifts, unifiedImportLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/headcount-plans");

/** Resolve a shift code to its DB id. Caches lookup. */
function buildShiftLookup(): Map<string, number> {
  const rows = db
    .select({ id: capacityShifts.id, code: capacityShifts.code })
    .from(capacityShifts)
    .all();
  return new Map(rows.map((r) => [r.code, r.id]));
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const headcountPlansSchema: ImportSchema = {
  id: "headcount-plans",
  display: {
    name: "Headcount Plans",
    description: "Effective-dated headcount targets per shift",
    icon: "fa-solid fa-people-group",
    category: "Capacity",
  },
  fields: [
    {
      name: "shiftCode",
      label: "Shift Code",
      type: "string",
      required: true,
      aliases: ["shift_code", "ShiftCode", "shift"],
      description: "Shift code (DAY, SWING, NIGHT) — must match an existing capacity shift",
      validate: (value) => {
        if (!value || String(value).trim() === "") return "Shift code is required";
        return null;
      },
    },
    {
      name: "headcount",
      label: "Headcount",
      type: "number",
      required: true,
      aliases: ["Headcount", "head_count", "heads"],
      description: "Number of people assigned to this shift",
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n) || n < 0) return "Headcount must be >= 0";
        return null;
      },
    },
    {
      name: "effectiveFrom",
      label: "Effective From",
      type: "date",
      required: true,
      aliases: ["effective_from", "EffectiveFrom", "startDate", "start_date"],
      description: "Start date for this headcount plan (YYYY-MM-DD)",
      validate: (value) => {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
          return "Effective from must be YYYY-MM-DD";
        return null;
      },
    },
    {
      name: "effectiveTo",
      label: "Effective To",
      type: "date",
      required: false,
      aliases: ["effective_to", "EffectiveTo", "endDate", "end_date"],
      description: "End date (YYYY-MM-DD). Null/empty = open-ended.",
      validate: (value) => {
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
          return "Effective to must be YYYY-MM-DD or empty";
        return null;
      },
    },
    {
      name: "dayOfWeek",
      label: "Day of Week",
      type: "number",
      required: false,
      aliases: ["day_of_week", "DayOfWeek", "weekday"],
      description: "0=Sun, 1=Mon, ..., 6=Sat. Null = all days.",
      validate: (value) => {
        if (value != null && value !== "") {
          const n = Number(value);
          if (isNaN(n) || n < 0 || n > 6) return "Day of week must be 0-6 (Sun-Sat)";
        }
        return null;
      },
    },
    {
      name: "label",
      label: "Label",
      type: "string",
      required: false,
      aliases: ["Label", "description", "name"],
      description: "Human-readable label for this plan entry",
    },
    {
      name: "notes",
      label: "Notes",
      type: "string",
      required: false,
      aliases: ["Notes", "comment"],
    },
    {
      name: "station",
      label: "Station",
      type: "string",
      required: false,
      defaultValue: "CVG",
      aliases: ["Station"],
      description: "Station code (default: CVG)",
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "insert",
  maxSizeMB: 5,

  help: {
    description:
      "Headcount plans define how many people are assigned to each shift. " +
      "Plans are effective-dated and support weekday overrides (e.g., different weekend staffing). " +
      "The most specific plan wins: weekday override > base plan, latest effectiveFrom wins ties.",
    expectedFormat: 'JSON array or CSV with "shiftCode", "headcount", "effectiveFrom" columns',
    sampleSnippet: `[
  { "shiftCode": "DAY", "headcount": 8, "effectiveFrom": "2025-01-01", "label": "Default Day" },
  { "shiftCode": "DAY", "headcount": 6, "effectiveFrom": "2025-01-01", "dayOfWeek": 0, "label": "Sunday Day" },
  { "shiftCode": "NIGHT", "headcount": 4, "effectiveFrom": "2025-01-01", "label": "Default Night" }
]`,
    notes: [
      "shiftCode must match an existing capacity shift (DAY, SWING, NIGHT)",
      "effectiveTo is optional — null means open-ended",
      "dayOfWeek overrides take precedence over base plans",
      "Plans are inserted (not upserted) — delete existing plans first if replacing",
    ],
    troubleshooting: [
      {
        error: "Unknown shift code",
        fix: "Ensure shiftCode matches one of: DAY, SWING, NIGHT (or your custom shift codes)",
      },
    ],
  },

  export: {
    query: async () => {
      const rows = await db.select().from(headcountPlans).orderBy(headcountPlans.effectiveFrom);
      const shiftMap = buildShiftLookup();
      const idToCode = new Map<number, string>();
      for (const [code, id] of shiftMap) idToCode.set(id, code);

      return rows.map((r) => ({
        shiftCode: idToCode.get(r.shiftId) ?? `shift_${r.shiftId}`,
        headcount: r.headcount,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        dayOfWeek: r.dayOfWeek,
        dayOfWeekName: r.dayOfWeek != null ? DAY_NAMES[r.dayOfWeek] : null,
        label: r.label,
        notes: r.notes,
        station: r.station,
      }));
    },
  },

  templateRecords: [
    { shiftCode: "DAY", headcount: 8, effectiveFrom: "2025-01-01", label: "Default Day shift" },
    { shiftCode: "SWING", headcount: 6, effectiveFrom: "2025-01-01", label: "Default Swing shift" },
    { shiftCode: "NIGHT", headcount: 4, effectiveFrom: "2025-01-01", label: "Default Night shift" },
  ],

  async commit(records, ctx: ImportContext): Promise<CommitResult> {
    const now = new Date().toISOString();
    const errors: string[] = [];
    const warnings: string[] = [];
    let inserted = 0;
    let skipped = 0;

    const logEntry = db
      .insert(unifiedImportLog)
      .values({
        importedAt: now,
        dataType: "headcount-plans",
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
      const shiftLookup = buildShiftLookup();

      for (const record of records) {
        const shiftCode = String(record.shiftCode ?? "")
          .trim()
          .toUpperCase();
        const shiftId = shiftLookup.get(shiftCode);

        if (!shiftId) {
          warnings.push(`Unknown shift code "${shiftCode}" — skipping`);
          skipped++;
          continue;
        }

        const headcount = Number(record.headcount ?? 0);
        const effectiveFrom = String(record.effectiveFrom ?? "").trim();

        if (!effectiveFrom) {
          warnings.push(`Missing effectiveFrom for shift ${shiftCode} — skipping`);
          skipped++;
          continue;
        }

        const effectiveTo = record.effectiveTo ? String(record.effectiveTo).trim() : null;
        const dayOfWeek =
          record.dayOfWeek != null && record.dayOfWeek !== "" ? Number(record.dayOfWeek) : null;
        const label = record.label ? String(record.label).trim() : null;
        const notes = record.notes ? String(record.notes).trim() : null;
        const station = record.station ? String(record.station).trim() : "CVG";

        db.insert(headcountPlans)
          .values({
            station,
            shiftId,
            headcount,
            effectiveFrom,
            effectiveTo,
            dayOfWeek,
            label,
            notes,
            createdAt: now,
            updatedAt: now,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .run();
        inserted++;
      }

      db.update(unifiedImportLog)
        .set({
          recordsInserted: inserted,
          recordsUpdated: 0,
          recordsSkipped: skipped,
          status: errors.length > 0 ? "partial" : "success",
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
        })
        .where(eq(unifiedImportLog.id, logId))
        .run();

      log.info({ logId, inserted, skipped }, "Headcount plans import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Headcount plans import failed");
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
      recordsUpdated: 0,
      recordsSkipped: skipped,
      errors,
      warnings,
    };
  },
};

registerSchema(headcountPlansSchema);
