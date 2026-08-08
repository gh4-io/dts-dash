/**
 * MH Override Data Access (OI-104)
 *
 * All database access for `mh_overrides` and its audit trail lives here; the
 * decision logic lives in `./rules` and stays pure. Every mutating call writes
 * an `mh_override_history` row and invalidates the transformer cache, because
 * overrides are resolved inside `transformWorkPackages()` — without that
 * invalidation a saved override is invisible until the server restarts.
 *
 * Server-only: imports better-sqlite3 through the DB client.
 */

import { db, sqlite } from "@/lib/db/client";
import { mhOverrides, mhOverrideHistory, workPackages, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { createChildLogger } from "@/lib/logger";
import { isWrite, resolveClear, resolveSave, type MHOverrideDecision } from "./rules";

const log = createChildLogger("mh-overrides");

/** Where a change came from — recorded on every history row. */
export type MHOverrideSource = "drawer" | "import" | "api";

/** A work package plus its current override state. */
export interface MHOverrideDetail {
  /** Internal `work_packages.id`. */
  workPackageId: number;
  /** SharePoint id — what the flight board and its APIs use as `wp.id`. */
  spId: number | null;
  workpackageNo: string | null;
  aircraftReg: string;
  customer: string;
  arrival: string;
  /** `work_packages.total_mh` — the imported value the chain would use. */
  importedMH: number | null;
  /** Current override, or null when the priority chain is in force. */
  overrideMH: number | null;
  updatedBy: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface MHOverrideHistoryEntry {
  id: number;
  workPackageId: number;
  spId: number | null;
  workpackageNo: string | null;
  aircraftReg: string | null;
  action: string;
  previousMH: number | null;
  newMH: number | null;
  importedMH: number | null;
  suppliedMH: number | null;
  minHours: number | null;
  source: string;
  note: string | null;
  changedBy: number;
  changedByName: string | null;
  changedAt: string;
}

// ─── Lookups ────────────────────────────────────────────────────────────────

/** Resolve a SharePoint id to the internal work package id. */
export function resolveWorkPackageBySpId(spId: number): number | null {
  const row = db
    .select({ id: workPackages.id })
    .from(workPackages)
    .where(eq(workPackages.spId, spId))
    .get();
  return row?.id ?? null;
}

/**
 * Build a `workpackage_no` → internal id lookup for bulk matching.
 *
 * The identifier is `workpackage_no` (e.g. `AALA/L-201125-2`); there is no
 * `title` column any more. Values are keyed case-insensitively and trimmed
 * because CSV exports routinely differ in both.
 *
 * Numbers that appear on more than one work package map to `null` — an
 * ambiguous identifier must not silently pick a row.
 */
export function buildWorkpackageNoLookup(): Map<string, number | null> {
  const rows = db
    .select({ id: workPackages.id, workpackageNo: workPackages.workpackageNo })
    .from(workPackages)
    .all();

  const lookup = new Map<string, number | null>();
  for (const row of rows) {
    if (!row.workpackageNo) continue;
    const key = row.workpackageNo.trim().toLowerCase();
    lookup.set(key, lookup.has(key) ? null : row.id);
  }
  return lookup;
}

/**
 * Resolve a GUID to the internal work package id.
 *
 * The GUID is the only identifier guaranteed to be present on every imported
 * work package, so it is the last-resort match for bulk files.
 */
export function resolveWorkPackageByGuid(guid: string): number | null {
  const row = db
    .select({ id: workPackages.id })
    .from(workPackages)
    .where(eq(workPackages.guid, guid))
    .get();
  return row?.id ?? null;
}

/** Current override value for a work package, or null when none is set. */
export function getOverrideValue(workPackageId: number): number | null {
  const row = db
    .select({ overrideMH: mhOverrides.overrideMH })
    .from(mhOverrides)
    .where(eq(mhOverrides.workPackageId, workPackageId))
    .get();
  return row?.overrideMH ?? null;
}

/** Imported MH (`work_packages.total_mh`) for a work package. */
export function getImportedMH(workPackageId: number): number | null {
  const row = db
    .select({ totalMH: workPackages.totalMH })
    .from(workPackages)
    .where(eq(workPackages.id, workPackageId))
    .get();
  return row?.totalMH ?? null;
}

/** Full detail row for one work package, or null when the WP does not exist. */
export function getOverrideDetail(workPackageId: number): MHOverrideDetail | null {
  const row = db
    .select({
      workPackageId: workPackages.id,
      spId: workPackages.spId,
      workpackageNo: workPackages.workpackageNo,
      aircraftReg: workPackages.aircraftReg,
      customer: workPackages.customer,
      arrival: workPackages.arrival,
      importedMH: workPackages.totalMH,
      overrideMH: mhOverrides.overrideMH,
      updatedBy: mhOverrides.updatedBy,
      updatedByName: users.displayName,
      updatedAt: mhOverrides.updatedAt,
    })
    .from(workPackages)
    .leftJoin(mhOverrides, eq(mhOverrides.workPackageId, workPackages.id))
    .leftJoin(users, eq(users.id, mhOverrides.updatedBy))
    .where(eq(workPackages.id, workPackageId))
    .get();

  return row ?? null;
}

/** Every work package that currently carries an override, newest first. */
export function listOverrides(): MHOverrideDetail[] {
  return db
    .select({
      workPackageId: workPackages.id,
      spId: workPackages.spId,
      workpackageNo: workPackages.workpackageNo,
      aircraftReg: workPackages.aircraftReg,
      customer: workPackages.customer,
      arrival: workPackages.arrival,
      importedMH: workPackages.totalMH,
      overrideMH: mhOverrides.overrideMH,
      updatedBy: mhOverrides.updatedBy,
      updatedByName: users.displayName,
      updatedAt: mhOverrides.updatedAt,
    })
    .from(mhOverrides)
    .innerJoin(workPackages, eq(workPackages.id, mhOverrides.workPackageId))
    .leftJoin(users, eq(users.id, mhOverrides.updatedBy))
    .orderBy(desc(mhOverrides.updatedAt))
    .all();
}

/** Audit trail, newest first. Optionally narrowed to one work package. */
export function listHistory(
  options: { workPackageId?: number; limit?: number } = {},
): MHOverrideHistoryEntry[] {
  const limit = options.limit ?? 500;

  const base = db
    .select({
      id: mhOverrideHistory.id,
      workPackageId: mhOverrideHistory.workPackageId,
      spId: workPackages.spId,
      workpackageNo: workPackages.workpackageNo,
      aircraftReg: workPackages.aircraftReg,
      action: mhOverrideHistory.action,
      previousMH: mhOverrideHistory.previousMH,
      newMH: mhOverrideHistory.newMH,
      importedMH: mhOverrideHistory.importedMH,
      suppliedMH: mhOverrideHistory.suppliedMH,
      minHours: mhOverrideHistory.minHours,
      source: mhOverrideHistory.source,
      note: mhOverrideHistory.note,
      changedBy: mhOverrideHistory.changedBy,
      changedByName: users.displayName,
      changedAt: mhOverrideHistory.changedAt,
    })
    .from(mhOverrideHistory)
    .leftJoin(workPackages, eq(workPackages.id, mhOverrideHistory.workPackageId))
    .leftJoin(users, eq(users.id, mhOverrideHistory.changedBy));

  const query = options.workPackageId
    ? base.where(eq(mhOverrideHistory.workPackageId, options.workPackageId))
    : base;

  return query
    .orderBy(desc(mhOverrideHistory.changedAt), desc(mhOverrideHistory.id))
    .limit(limit)
    .all();
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export interface ApplyOverrideInput {
  workPackageId: number;
  /** Value as supplied, before the minimum-hours transform. */
  suppliedMH: number;
  /** Optional floor. The original supplied value is still recorded. */
  minHours?: number | null;
  userId: number;
  source: MHOverrideSource;
  note?: string | null;
  /**
   * Skip cache invalidation — used by the bulk import, which invalidates once
   * after the whole batch instead of ~n times inside the transaction.
   */
  deferInvalidation?: boolean;
}

export interface OverrideWriteResult {
  decision: MHOverrideDecision;
  /** Override value before the change. */
  previousMH: number | null;
  importedMH: number | null;
  detail: MHOverrideDetail | null;
}

/**
 * Apply a save request. Writes the override (or removes a redundant one),
 * appends a history row, and refreshes the transformer cache.
 *
 * The override write and its history row go in one transaction — an audit trail
 * that can disagree with the value it describes is worse than none.
 */
export function applyOverride(input: ApplyOverrideInput): OverrideWriteResult {
  const previousMH = getOverrideValue(input.workPackageId);
  const importedMH = getImportedMH(input.workPackageId);

  const decision = resolveSave({
    suppliedMH: input.suppliedMH,
    importedMH,
    existingMH: previousMH,
    minHours: input.minHours ?? null,
  });

  writeDecision(decision, { ...input, previousMH, importedMH });

  return {
    decision,
    previousMH,
    importedMH,
    detail: getOverrideDetail(input.workPackageId),
  };
}

export interface ClearOverrideInput {
  workPackageId: number;
  userId: number;
  source: MHOverrideSource;
  note?: string | null;
  deferInvalidation?: boolean;
}

/** Remove an override, restoring the priority chain. No-op when none exists. */
export function clearOverride(input: ClearOverrideInput): OverrideWriteResult {
  const previousMH = getOverrideValue(input.workPackageId);
  const importedMH = getImportedMH(input.workPackageId);
  const decision = resolveClear(previousMH);

  writeDecision(decision, { ...input, previousMH, importedMH });

  return {
    decision,
    previousMH,
    importedMH,
    detail: getOverrideDetail(input.workPackageId),
  };
}

/** Persist a decision plus its audit row. Shared by save and clear. */
function writeDecision(
  decision: MHOverrideDecision,
  ctx: {
    workPackageId: number;
    userId: number;
    source: MHOverrideSource;
    note?: string | null;
    previousMH: number | null;
    importedMH: number | null;
    deferInvalidation?: boolean;
  },
): void {
  if (!isWrite(decision)) return;

  const now = new Date().toISOString();

  const run = sqlite.transaction(() => {
    if (decision.action === "clear") {
      db.delete(mhOverrides).where(eq(mhOverrides.workPackageId, ctx.workPackageId)).run();
    } else if (decision.action === "create") {
      db.insert(mhOverrides)
        .values({
          workPackageId: ctx.workPackageId,
          overrideMH: decision.overrideMH as number,
          updatedBy: ctx.userId,
          updatedAt: now,
        })
        .run();
    } else {
      db.update(mhOverrides)
        .set({
          overrideMH: decision.overrideMH as number,
          updatedBy: ctx.userId,
          updatedAt: now,
        })
        .where(eq(mhOverrides.workPackageId, ctx.workPackageId))
        .run();
    }

    db.insert(mhOverrideHistory)
      .values({
        workPackageId: ctx.workPackageId,
        action: decision.action as "create" | "update" | "clear",
        previousMH: ctx.previousMH,
        newMH: decision.overrideMH,
        importedMH: ctx.importedMH,
        suppliedMH: decision.suppliedMH,
        minHours: decision.minHours,
        source: ctx.source,
        note: ctx.note ?? decision.reason,
        changedBy: ctx.userId,
        changedAt: now,
      })
      .run();
  });

  run();

  if (!ctx.deferInvalidation) {
    invalidateMHOverrideCaches();
  }
}

/**
 * Refresh every cache that resolves `effectiveMH`.
 *
 * Only the transformer caches overrides (`cachedOverrides`, GUID → MH); the
 * reader caches raw `work_packages` rows, which an override never touches. So
 * one call is enough, and it is the call that makes the flight board and
 * `/capacity` reflect a change on the next request without a restart.
 */
export function invalidateMHOverrideCaches(): void {
  invalidateTransformerCache();
  log.debug("Transformer cache invalidated after MH override change");
}

// ─── CSV export ─────────────────────────────────────────────────────────────

/** Escape one CSV cell — quotes doubled, field quoted when it needs to be. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Render rows to CSV using the given ordered column keys. */
export function toCsv<T>(rows: T[], columns: (keyof T & string)[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => csvCell(row[col])).join(","));
  }
  return lines.join("\n");
}

/** Column order for the history export — before/after first, provenance after. */
export const HISTORY_CSV_COLUMNS: (keyof MHOverrideHistoryEntry & string)[] = [
  "changedAt",
  "workpackageNo",
  "spId",
  "aircraftReg",
  "action",
  "previousMH",
  "newMH",
  "importedMH",
  "suppliedMH",
  "minHours",
  "source",
  "changedByName",
  "note",
];

/** Column order for the current-overrides export. */
export const OVERRIDES_CSV_COLUMNS: (keyof MHOverrideDetail & string)[] = [
  "workpackageNo",
  "spId",
  "aircraftReg",
  "customer",
  "arrival",
  "importedMH",
  "overrideMH",
  "updatedByName",
  "updatedAt",
];
