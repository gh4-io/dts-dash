/**
 * Headcount Exceptions Import Schema
 *
 * Date-specific headcount delta overrides for capacity modeling.
 * Applied additively to base headcount plans, floored at 0.
 */

import { db } from "@/lib/db/client";
import { headcountExceptions, capacityShifts, importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult } from "../types";

const log = createChildLogger("import/headcount-exceptions");

/** Resolve a shift code to its DB id. */
function buildShiftLookup(): Map<string, number> {
  const rows = db
    .select({ id: capacityShifts.id, code: capacityShifts.code })
    .from(capacityShifts)
    .all();
  return new Map(rows.map((r) => [r.code, r.id]));
}

const headcountExceptionsSchema: ImportSchema = {
  id: "headcount-exceptions",
  display: {
    name: "Headcount Exceptions",
    description: "Date-specific headcount adjustments (holidays, overtime, etc.)",
    icon: "fa-solid fa-calendar-xmark",
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
      name: "exceptionDate",
      label: "Exception Date",
      type: "date",
      required: true,
      isKey: true,
      aliases: ["exception_date", "ExceptionDate", "date"],
      description: "Date for this exception (YYYY-MM-DD)",
      validate: (value) => {
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
          return "Exception date must be YYYY-MM-DD";
        return null;
      },
    },
    {
      name: "headcountDelta",
      label: "Headcount Delta",
      type: "number",
      required: true,
      aliases: ["headcount_delta", "HeadcountDelta", "delta"],
      description: "Headcount adjustment (positive = extra staff, negative = reduced staff)",
      validate: (value) => {
        const n = Number(value);
        if (isNaN(n)) return "Headcount delta must be a number";
        return null;
      },
    },
    {
      name: "reason",
      label: "Reason",
      type: "string",
      required: false,
      aliases: ["Reason", "note", "description"],
      description: "Reason for the exception (e.g., Holiday, Training, Overtime)",
    },
    {
      name: "station",
      label: "Station",
      type: "string",
      required: false,
      defaultValue: "CVG",
      aliases: ["Station"],
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["shiftCode", "exceptionDate"],
  maxSizeMB: 5,

  help: {
    description:
      "Headcount exceptions are date-specific adjustments applied on top of base headcount plans. " +
      "Use positive deltas for overtime/extra staff and negative deltas for holidays/reduced staffing. " +
      "The effective headcount is: base + sum(deltas), floored at 0.",
    expectedFormat: 'JSON array or CSV with "shiftCode", "exceptionDate", "headcountDelta" columns',
    sampleSnippet: `[
  { "shiftCode": "DAY", "exceptionDate": "2025-12-25", "headcountDelta": -4, "reason": "Christmas Day" },
  { "shiftCode": "NIGHT", "exceptionDate": "2025-12-25", "headcountDelta": -2, "reason": "Christmas Day" },
  { "shiftCode": "DAY", "exceptionDate": "2025-12-26", "headcountDelta": 2, "reason": "Post-holiday surge" }
]`,
    notes: [
      "shiftCode must match an existing capacity shift",
      "Each (shiftCode, exceptionDate) pair must be unique — duplicates are upserted",
      "Negative deltas can reduce headcount to 0 (system floors at 0, never goes negative)",
      "Use for holidays, training days, overtime shifts, or any date-specific staffing changes",
    ],
    troubleshooting: [
      {
        error: "Duplicate (shift, date) pair",
        fix: "Each combination of shiftCode and exceptionDate must be unique. Later records overwrite earlier ones.",
      },
    ],
  },

  export: {
    query: async () => {
      const rows = await db
        .select()
        .from(headcountExceptions)
        .orderBy(headcountExceptions.exceptionDate);
      const shiftMap = buildShiftLookup();
      const idToCode = new Map<number, string>();
      for (const [code, id] of shiftMap) idToCode.set(id, code);

      return rows.map((r) => ({
        shiftCode: idToCode.get(r.shiftId) ?? `shift_${r.shiftId}`,
        exceptionDate: r.exceptionDate,
        headcountDelta: r.headcountDelta,
        reason: r.reason,
        station: r.station,
      }));
    },
  },

  templateRecords: [
    { shiftCode: "DAY", exceptionDate: "2025-12-25", headcountDelta: -4, reason: "Christmas Day" },
    {
      shiftCode: "NIGHT",
      exceptionDate: "2025-12-25",
      headcountDelta: -2,
      reason: "Christmas Day",
    },
    {
      shiftCode: "DAY",
      exceptionDate: "2025-12-26",
      headcountDelta: 2,
      reason: "Post-holiday surge",
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
        dataType: "headcount-exceptions",
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
      const shiftLookup = buildShiftLookup();

      // Fetch existing exceptions for dedup
      const existing = await db.select().from(headcountExceptions);
      const existingMap = new Map(existing.map((e) => [`${e.shiftId}:${e.exceptionDate}`, e]));

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

        const exceptionDate = String(record.exceptionDate ?? "").trim();

        if (!exceptionDate) {
          warnings.push(`Missing exceptionDate for shift ${shiftCode} — skipping`);
          skipped++;
          continue;
        }

        const headcountDelta = Number(record.headcountDelta ?? 0);
        const reason = record.reason ? String(record.reason).trim() : null;
        const station = record.station ? String(record.station).trim() : "CVG";

        const key = `${shiftId}:${exceptionDate}`;
        const ex = existingMap.get(key);

        if (!ex) {
          db.insert(headcountExceptions)
            .values({
              station,
              shiftId,
              exceptionDate,
              headcountDelta,
              reason,
              createdAt: now,
              createdBy: ctx.userId,
            })
            .run();
          inserted++;
        } else {
          db.update(headcountExceptions)
            .set({
              headcountDelta,
              reason: reason ?? ex.reason,
            })
            .where(eq(headcountExceptions.id, ex.id))
            .run();
          updated++;
        }
      }

      db.update(importLog)
        .set({
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          status: errors.length > 0 ? "partial" : "success",
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
        })
        .where(eq(importLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "Headcount exceptions import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      log.error({ err, logId }, "Headcount exceptions import failed");
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

registerSchema(headcountExceptionsSchema);
