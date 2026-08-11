/**
 * MH Overrides Import Schema (OI-104)
 *
 * Bulk create/update/clear of manual man-hour overrides, keyed by
 * `workpackage_no` (e.g. `AALA/L-201125-2`) — the work package identifier.
 * There is no `title` column; `workpackage_no` carries the identifier. It is
 * also optional in the source data, so `spId` and `guid` are accepted as
 * fallbacks (see `matchRow`).
 *
 * This rides the Universal Import Hub rather than shipping a parallel CSV path,
 * so it inherits the 6-step wizard, the mapping UI, the pre-commit preview and
 * the `import_log` audit row for free.
 *
 * Preview reporting (the counts the wizard shows before commit) comes from
 * `summarize()`, which reads the database: matched, unmatched, duplicated,
 * ambiguous, invalid and unchanged rows are all resolved up front so nothing
 * about the commit is a surprise.
 */

import { db, sqlite } from "@/lib/db/client";
import { importLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { registerSchema } from "../registry";
import type { ImportSchema, ImportContext, CommitResult, ImportSummaryBadge } from "../types";
import {
  applyOverride,
  buildWorkpackageNoLookup,
  getImportedMH,
  getOverrideValue,
  invalidateMHOverrideCaches,
  listOverrides,
  resolveWorkPackageByGuid,
  resolveWorkPackageBySpId,
} from "@/lib/mh-overrides/data";
import { parseMHValue, resolveSave, MAX_OVERRIDE_MH } from "@/lib/mh-overrides/rules";

const log = createChildLogger("import/mh-overrides");

/** Outcome of classifying one CSV row against the database. */
type RowOutcome =
  | "matched"
  | "unmatched"
  | "duplicate"
  | "ambiguous"
  | "invalid"
  | "unchanged"
  | "redundant";

interface ClassifiedRow {
  index: number;
  /** Whatever identifier the row supplied, for reporting. */
  identifier: string;
  outcome: RowOutcome;
  workPackageId: number | null;
  suppliedMH: number | null;
  minHours: number | null;
  note: string | null;
  detail: string;
}

/** Read a record field, tolerating null/blank. */
function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** Outcome of resolving one row's identifier to a work package. */
type Match =
  | { id: number; identifier: string }
  | { error: RowOutcome; identifier: string; detail: string };

/**
 * Resolve a row to a work package.
 *
 * `workpackageNo` is the documented identifier, but it is not populated on
 * every source — the SharePoint export that fills it is optional, and a
 * database can hold ten thousand work packages without a single one. So `spId`
 * and `guid` are accepted as fallbacks, in that order, rather than leaving the
 * bulk path unusable against such data.
 */
function matchRow(record: Record<string, unknown>, noLookup: Map<string, number | null>): Match {
  const workpackageNo = str(record.workpackageNo);
  if (workpackageNo) {
    const key = workpackageNo.toLowerCase();
    if (!noLookup.has(key)) {
      return {
        error: "unmatched",
        identifier: workpackageNo,
        detail: "No work package with this number",
      };
    }
    const id = noLookup.get(key) ?? null;
    return id === null
      ? {
          error: "ambiguous",
          identifier: workpackageNo,
          detail: "Work package number matches more than one record",
        }
      : { id, identifier: workpackageNo };
  }

  const spId = str(record.spId);
  if (spId) {
    const parsed = Number(spId);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { error: "invalid", identifier: spId, detail: "spId must be a positive integer" };
    }
    const id = resolveWorkPackageBySpId(parsed);
    return id === null
      ? { error: "unmatched", identifier: spId, detail: "No work package with this SharePoint ID" }
      : { id, identifier: spId };
  }

  const guid = str(record.guid);
  if (guid) {
    const id = resolveWorkPackageByGuid(guid);
    return id === null
      ? { error: "unmatched", identifier: guid, detail: "No work package with this GUID" }
      : { id, identifier: guid };
  }

  return {
    error: "invalid",
    identifier: "",
    detail: "No identifier — supply workpackageNo, spId or guid",
  };
}

/**
 * Classify every row against the current database state.
 *
 * Runs identically in the preview and at commit time, so the counts the user
 * approved are the counts that get applied.
 */
function classifyRows(records: Record<string, unknown>[]): ClassifiedRow[] {
  const noLookup = buildWorkpackageNoLookup();
  const seen = new Map<number, number>();
  const rows: ClassifiedRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const match = matchRow(record, noLookup);

    const base = {
      index: i + 1,
      identifier: match.identifier,
      workPackageId: null as number | null,
      suppliedMH: null as number | null,
      minHours: null as number | null,
      note: str(record.note) || null,
    };

    if ("error" in match) {
      rows.push({ ...base, outcome: match.error, detail: match.detail });
      continue;
    }

    const workPackageId = match.id;

    // Two rows targeting the same work package — the later value would silently
    // win, which is never what a reviewer of the preview expects.
    if (seen.has(workPackageId)) {
      rows.push({
        ...base,
        outcome: "duplicate",
        detail: `Duplicate of row ${seen.get(workPackageId)} — later value would overwrite the earlier one`,
      });
      continue;
    }
    seen.set(workPackageId, i + 1);

    const parsed = parseMHValue(record.overrideMH);
    if ("error" in parsed) {
      rows.push({ ...base, workPackageId, outcome: "invalid", detail: parsed.error });
      continue;
    }

    let minHours: number | null = null;
    if (record.minHours !== null && record.minHours !== undefined && str(record.minHours) !== "") {
      const parsedMin = parseMHValue(record.minHours);
      if ("error" in parsedMin) {
        rows.push({
          ...base,
          workPackageId,
          outcome: "invalid",
          detail: `minHours: ${parsedMin.error}`,
        });
        continue;
      }
      minHours = parsedMin.value;
    }

    const decision = resolveSave({
      suppliedMH: parsed.value,
      importedMH: getImportedMH(workPackageId),
      existingMH: getOverrideValue(workPackageId),
      minHours,
    });

    const outcome: RowOutcome =
      decision.action === "unchanged"
        ? "unchanged"
        : decision.action === "noop"
          ? "redundant"
          : decision.redundant
            ? "redundant"
            : "matched";

    rows.push({
      ...base,
      workPackageId,
      suppliedMH: parsed.value,
      minHours,
      outcome,
      detail: decision.reason,
    });
  }

  return rows;
}

/** Count rows by outcome. */
function tally(rows: ClassifiedRow[]): Record<RowOutcome, number> {
  const counts: Record<RowOutcome, number> = {
    matched: 0,
    unmatched: 0,
    duplicate: 0,
    ambiguous: 0,
    invalid: 0,
    unchanged: 0,
    redundant: 0,
  };
  for (const row of rows) counts[row.outcome]++;
  return counts;
}

const mhOverridesSchema: ImportSchema = {
  id: "mh-overrides",
  display: {
    name: "MH Overrides",
    description: "Bulk manual man-hour overrides, keyed by work package number, SP ID or GUID",
    icon: "fa-solid fa-pen-to-square",
    category: "Operations",
  },
  fields: [
    {
      name: "workpackageNo",
      label: "Work Package Number",
      type: "string",
      required: false,
      isKey: true,
      aliases: ["workpackage_no", "WorkpackageNo", "wpNo", "WP Number", "workPackageNo"],
      description:
        "Preferred identifier, e.g. AALA/L-201125-2. Leave blank and supply spId or guid when the source never filled it in.",
    },
    {
      name: "spId",
      label: "SharePoint ID",
      type: "number",
      required: false,
      aliases: ["sp_id", "SpId", "ID", "sharepointId"],
      description:
        "Fallback identifier — the SharePoint ID shown as the work package ID in the app",
    },
    {
      name: "guid",
      label: "GUID",
      type: "string",
      required: false,
      aliases: ["GUID", "Guid", "workPackageGuid"],
      description: "Last-resort identifier. Present on every imported work package.",
    },
    {
      name: "overrideMH",
      label: "Override MH",
      type: "number",
      required: true,
      aliases: ["override_mh", "OverrideMH", "mh", "manHours", "MH"],
      description:
        "Man-hours to force. A value equal to the imported WP MH clears the override instead of storing it.",
      validate: (value) => {
        const parsed = parseMHValue(value);
        return "error" in parsed ? parsed.error : null;
      },
    },
    {
      name: "minHours",
      label: "Minimum Hours",
      type: "number",
      required: false,
      aliases: ["min_hours", "MinHours", "floor"],
      description:
        "Optional floor. Values below it are raised; the value you supplied is still kept in the audit trail.",
      validate: (value) => {
        if (value === null || value === undefined || str(value) === "") return null;
        const parsed = parseMHValue(value);
        return "error" in parsed ? parsed.error : null;
      },
    },
    {
      name: "note",
      label: "Note",
      type: "string",
      required: false,
      aliases: ["Note", "reason", "comment"],
      description: "Recorded against each history row instead of the generated reason",
    },
  ],
  formats: ["json", "csv"],
  commitStrategy: "upsert",
  dedupKey: ["workpackageNo"],
  maxSizeMB: 5,

  help: {
    description:
      "Set manual man-hour overrides in bulk. An override is the top rung of the effectiveMH chain " +
      "(override > WP MH > contract PER_EVENT > default), so every row here takes a work package off " +
      "its imported value until the override is cleared.",
    expectedFormat:
      'JSON array or CSV with "overrideMH" plus one identifier column — "workpackageNo", "spId" or "guid"',
    sampleSnippet: `workpackageNo,spId,overrideMH,minHours,note
AALA/L-201125-2,,8.5,,Extra borescope
,14430,2,4,Contract minimum applies`,
    notes: [
      "Each row needs exactly one identifier: workpackageNo, else spId, else guid — resolved in that order",
      "workpackage_no is matched case-insensitively and ignoring surrounding whitespace",
      "workpackage_no is not populated by every source; export the current overrides first to get a file with working identifiers",
      "An overrideMH equal to the imported WP MH is redundant — the row clears any existing override rather than storing a duplicate of the source value",
      "minHours raises a value below the floor; the original supplied value is retained in the override history export",
      "Duplicated, unmatched, ambiguous and invalid rows are reported in the preview and skipped at commit — they never abort the batch",
      "The whole batch commits in one transaction; nothing is written if it fails",
      `Values must be between 0 and ${MAX_OVERRIDE_MH} man-hours`,
    ],
    requirements: [
      "Work packages must already be imported — this schema never creates them",
      "Each work package may be targeted at most once per file",
    ],
    troubleshooting: [
      {
        error: "No identifier — supply workpackageNo, spId or guid",
        fix: "The row has no identifier column filled in. Export the current overrides to see the identifiers this database actually carries.",
      },
      {
        error: "No work package with this number",
        fix: "Check the identifier against the work package shown in the flight board drawer. Import the work packages first, or key on spId instead.",
      },
      {
        error: "Work package number matches more than one record",
        fix: "The number is not unique in work_packages. Resolve the duplicate rows before overriding.",
      },
      {
        error: "Matches imported MH — redundant override cleared",
        fix: "Not an error. Storing an override equal to the source value masks later data changes, so it is cleared instead.",
      },
    ],
  },

  export: {
    query: async () => {
      // Exported with both identifiers so the file can be edited and re-imported
      // against a database whose workpackage_no column is empty.
      return listOverrides().map((row) => ({
        workpackageNo: row.workpackageNo,
        spId: row.spId,
        overrideMH: row.overrideMH,
        minHours: null,
        note: null,
        aircraftReg: row.aircraftReg,
        importedMH: row.importedMH,
        updatedBy: row.updatedByName,
        updatedAt: row.updatedAt,
      }));
    },
  },

  templateRecords: [
    {
      workpackageNo: "AALA/L-201125-2",
      spId: "",
      overrideMH: 8.5,
      minHours: "",
      note: "Extra borescope",
    },
    { workpackageNo: "", spId: 14430, overrideMH: 2, minHours: 4, note: "Contract minimum" },
  ],

  // ─── Preview ────────────────────────────────────────────────────────────

  async postMapValidate(records) {
    const rows = classifyRows(records as Record<string, unknown>[]);
    const warnings: string[] = [];

    // Every row that will not be applied is surfaced by name before commit.
    for (const row of rows) {
      if (row.outcome === "matched" || row.outcome === "unchanged") continue;
      warnings.push(
        `Row ${row.index} (${row.identifier || "no identifier"}): ${row.outcome} — ${row.detail}`,
      );
    }

    const counts = tally(rows);
    if (counts.matched === 0 && rows.length > 0) {
      warnings.push("No row would change anything — nothing will be written.");
    }

    return { errors: [], warnings };
  },

  summarize(records): ImportSummaryBadge[] {
    const counts = tally(classifyRows(records as Record<string, unknown>[]));

    return [
      { label: "Matched", value: counts.matched, icon: "fa-solid fa-circle-check" },
      {
        label: "Unchanged",
        value: counts.unchanged,
        icon: "fa-solid fa-equals",
        variant: "default",
      },
      {
        label: "Redundant",
        value: counts.redundant,
        icon: "fa-solid fa-eraser",
        variant: counts.redundant > 0 ? "warning" : "default",
      },
      {
        label: "Unmatched",
        value: counts.unmatched + counts.ambiguous,
        icon: "fa-solid fa-link-slash",
        variant: counts.unmatched + counts.ambiguous > 0 ? "warning" : "default",
      },
      {
        label: "Duplicates",
        value: counts.duplicate,
        icon: "fa-solid fa-clone",
        variant: counts.duplicate > 0 ? "warning" : "default",
      },
      {
        label: "Invalid",
        value: counts.invalid,
        icon: "fa-solid fa-triangle-exclamation",
        variant: counts.invalid > 0 ? "destructive" : "default",
      },
    ];
  },

  // ─── Commit ─────────────────────────────────────────────────────────────

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
        dataType: "mh-overrides",
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
      const rows = classifyRows(records as Record<string, unknown>[]);

      // One transaction for the whole batch — a failure part-way through must
      // not leave half the file applied. Each applyOverride() opens a savepoint
      // inside this, and defers cache invalidation to a single call after.
      const applyAll = sqlite.transaction(() => {
        for (const row of rows) {
          if (row.workPackageId === null || row.suppliedMH === null) {
            warnings.push(
              `Row ${row.index} (${row.identifier || "no identifier"}): ${row.outcome} — ${row.detail}`,
            );
            skipped++;
            continue;
          }

          if (row.outcome === "unchanged") {
            skipped++;
            continue;
          }

          const result = applyOverride({
            workPackageId: row.workPackageId,
            suppliedMH: row.suppliedMH,
            minHours: row.minHours,
            userId: ctx.userId,
            source: "import",
            note: row.note,
            deferInvalidation: true,
          });

          switch (result.decision.action) {
            case "create":
              inserted++;
              break;
            case "update":
              updated++;
              break;
            case "clear":
              updated++;
              warnings.push(`Row ${row.index} (${row.identifier}): ${result.decision.reason}`);
              break;
            default:
              skipped++;
              warnings.push(`Row ${row.index} (${row.identifier}): ${result.decision.reason}`);
          }

          // Minimum-hours transform is audited even on success — the stored
          // value is not the value the operator typed.
          if (result.decision.minHoursApplied) {
            warnings.push(
              `Row ${row.index} (${row.identifier}): supplied ${result.decision.suppliedMH} raised to the ${result.decision.minHours} MH minimum`,
            );
          }
        }
      });

      applyAll();

      db.update(importLog)
        .set({
          recordsInserted: inserted,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          status: "success",
          warnings: warnings.length > 0 ? JSON.stringify(warnings) : null,
        })
        .where(eq(importLog.id, logId))
        .run();

      log.info({ logId, inserted, updated, skipped }, "MH overrides import committed");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(errMsg);
      // The transaction rolled back — report zero applied, not the running count.
      inserted = 0;
      updated = 0;
      skipped = records.length;
      log.error({ err, logId }, "MH overrides import failed — batch rolled back");
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

  async postCommit() {
    // One invalidation for the batch — every applyOverride() above deferred it.
    invalidateMHOverrideCaches();
  },
};

registerSchema(mhOverridesSchema);
