#!/usr/bin/env tsx
/**
 * db:upgrade-v1 — Bring a pre-v1.0.0 database forward to the v1.0.0 schema.
 *
 * Usage: npm run db:upgrade-v1 [-- --dry-run] [-- --yes]
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * v1.0.0 collapsed the migration ladder. `createTables()` is now the single
 * canonical declaration of the schema and `runMigrations()` returns an empty
 * array, so `npm run db:migrate` no longer carries an old database forward.
 *
 * That is deliberate: declaring a schema and moving existing data are different
 * jobs. A CREATE TABLE cannot rename a column, close an overlapping date window
 * or re-point a foreign key. Those need a script that runs once, deliberately,
 * with a backup taken first — this one.
 *
 * ── Version-agnostic by construction ────────────────────────────────────────
 *
 * This script does NOT ask what version the database is. Asking would mean
 * trusting a stamp that older builds never wrote, and would break the moment
 * someone ran a half-upgrade by hand.
 *
 * Instead it builds a throwaway reference database from the current
 * `createTables()`, introspects it, and diffs the live database against it.
 * Whatever is missing gets added. That works identically for a 0.1.x database,
 * a 0.2.0-rc1 database, a partially-migrated one, or one already at v1.0.0
 * (where it finds nothing to do). There is no manifest to drift out of sync
 * with the schema, because the schema is the manifest.
 *
 * ── Safety ──────────────────────────────────────────────────────────────────
 *
 * - Step 0 takes a full file-level backup and refuses to continue without one.
 *   NOTE: `npm run db:export` is NOT a substitute — it enumerates a subset of
 *   tables and misses several entirely.
 * - Every mutating step is idempotent. Running twice is a no-op.
 * - Data steps run inside a single transaction.
 * - `--dry-run` reports what would change and writes nothing.
 */

import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import {
  backfillMessages,
  assertMessagesReconciled,
} from "../../src/lib/db/backfill/messages-backfill";
import {
  banner,
  log,
  success,
  warn,
  error,
  c,
  confirm,
  hasFlag,
  formatBytes,
  timestamp,
} from "./_cli-utils";

const PROJECT_ROOT = process.cwd();
const DB_PATH = process.env.DATABASE_PATH || path.join(PROJECT_ROOT, "data", "dashboard.db");
const DRY_RUN = hasFlag("--dry-run");

/** app_config keys orphaned by D-064 when the legacy capacity engine was deleted. */
const ORPHANED_CONFIG_KEYS = ["theoreticalCapacityPerPerson", "realCapacityPerPerson", "shifts"];

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface Change {
  step: string;
  detail: string;
}

const changes: Change[] = [];
function record(step: string, detail: string): void {
  changes.push({ step, detail });
  log(`  ${c.green}+${c.reset} ${detail}`);
}

// ─── Schema probes ───────────────────────────────────────────────────────────
//
// Step 3 runs against whatever the operator actually has, which may be any
// released schema back to v0.1.0 — where entire capacity tables do not exist
// yet. Step 2 normally creates them first, so in a real run every table is
// present by the time Step 3 starts. Under --dry-run it does NOT: Step 2 only
// reports what it would add. Every correction below therefore has to ask before
// it touches anything, or --dry-run dies on the databases it exists to preview.

function hasTable(live: Database.Database, table: string): boolean {
  return (
    live.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?`).get(table) !==
    undefined
  );
}

function hasColumn(live: Database.Database, table: string, column: string): boolean {
  if (!hasTable(live, table)) return false;
  const cols = live.prepare(`PRAGMA table_info("${table}")`).all() as ColumnInfo[];
  return cols.some((col) => col.name === column);
}

/**
 * True when the correction cannot run yet because the schema it needs is only
 * scheduled, not applied. Under --dry-run that is expected and silent; in a real
 * run it means Step 2 failed to add something it claimed to, which is a bug
 * worth surfacing rather than skipping quietly.
 */
function skipUnavailable(what: string): boolean {
  if (!DRY_RUN) warn(`${what} — skipped (Step 2 did not provide it)`);
  return true;
}

// ─── Step 0: Backup ──────────────────────────────────────────────────────────

function backupDatabase(live: Database.Database): string {
  const ts = timestamp();
  // Sit the backup beside the database being upgraded, not always under the
  // project root — DATABASE_PATH may point anywhere, and a rollback instruction
  // that names the wrong directory is worse than none.
  const backupDir = path.join(path.dirname(DB_PATH), "backups", `pre-v1-${ts}`);
  fs.mkdirSync(backupDir, { recursive: true });

  // Fold the WAL back into the main file so the copy is a complete snapshot.
  // Without this the backup can be missing the most recent commits.
  try {
    live.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    warn("Could not checkpoint WAL before backup (non-critical)");
  }

  const dest = path.join(backupDir, "dashboard.db");
  fs.copyFileSync(DB_PATH, dest);

  const srcSize = fs.statSync(DB_PATH).size;
  const dstSize = fs.statSync(dest).size;
  if (dstSize !== srcSize) {
    throw new Error(
      `Backup size mismatch (source ${srcSize}, copy ${dstSize}). Refusing to continue.`,
    );
  }

  success(`Backup written: ${dest} (${formatBytes(dstSize)})`);
  return dest;
}

// ─── Step 1: Build the reference schema ──────────────────────────────────────

/**
 * Create a throwaway database from the current createTables() and introspect it.
 * This is the target shape — whatever the live database lacks, it needs.
 */
async function buildReference(): Promise<{
  tables: Map<string, ColumnInfo[]>;
  tableDDL: Map<string, string>;
  indexDDL: Map<string, string>;
  indexes: Set<string>;
  cleanup: () => void;
}> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dtsd-v1-reference-"));
  const refPath = path.join(dir, "reference.db");

  // schema-init resolves the DB singleton from DATABASE_PATH at module load, so
  // the env var must be set before the dynamic import.
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = refPath;

  const init = await import("../../src/lib/db/schema-init");
  init.createTables();

  const ref = new Database(refPath, { readonly: true });
  const tables = new Map<string, ColumnInfo[]>();
  const tableDDL = new Map<string, string>();
  const indexDDL = new Map<string, string>();
  const indexes = new Set<string>();

  const objects = ref
    .prepare(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'`)
    .all() as { type: string; name: string; sql: string | null }[];

  for (const o of objects) {
    if (o.type === "table") {
      tables.set(o.name, ref.prepare(`PRAGMA table_info("${o.name}")`).all() as ColumnInfo[]);
      if (o.sql) tableDDL.set(o.name, o.sql);
    } else if (o.type === "index") {
      indexes.add(o.name);
      // Auto-indexes backing UNIQUE/PK constraints have a null sql and come
      // along with their table — only explicit CREATE INDEX statements matter.
      if (o.sql) indexDDL.set(o.name, o.sql);
    }
  }

  ref.close();
  if (previous === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previous;

  return {
    tables,
    tableDDL,
    indexDDL,
    indexes,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

// ─── Step 2: Additive catch-up ───────────────────────────────────────────────

/**
 * Add whatever the live database is missing: tables, columns, indexes.
 *
 * Columns are the reason this step exists at all — CREATE TABLE IF NOT EXISTS
 * handles missing tables and indexes on its own, but silently does nothing for a
 * table that exists with an older column set.
 */
function applyAdditiveCatchUp(
  live: Database.Database,
  ref: {
    tables: Map<string, ColumnInfo[]>;
    tableDDL: Map<string, string>;
    indexDDL: Map<string, string>;
  },
): void {
  const liveTables = new Set(
    (
      live.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]
    ).map((r) => r.name),
  );

  for (const [table, refCols] of ref.tables) {
    if (!liveTables.has(table)) {
      // Replay the reference database's own CREATE TABLE against the live
      // handle. Do NOT call createTables() here: schema-init binds its sqlite
      // handle at module load, and buildReference() already imported it with
      // DATABASE_PATH pointed at the reference file. Node caches the module, so
      // a second import returns that same handle and every statement would land
      // on the wrong database — silently, since it succeeds.
      const ddl = ref.tableDDL.get(table);
      if (!ddl) {
        warn(`No DDL captured for missing table "${table}" — skipping`);
        continue;
      }
      if (!DRY_RUN) live.exec(ddl);
      record("schema", `${table} table created (${refCols.length} columns)`);
      continue;
    }

    const liveCols = live.prepare(`PRAGMA table_info("${table}")`).all() as ColumnInfo[];
    const liveNames = new Set(liveCols.map((col) => col.name));

    for (const col of refCols) {
      if (liveNames.has(col.name)) continue;

      // SQLite cannot ALTER TABLE ADD a NOT NULL column without a default —
      // there is no value to give the existing rows. Add it nullable and say so
      // rather than failing the whole upgrade.
      let clause = `"${col.name}" ${col.type}`;
      if (col.dflt_value !== null) {
        clause += ` DEFAULT ${col.dflt_value}`;
        if (col.notnull) clause += " NOT NULL";
      } else if (col.notnull) {
        warn(
          `${table}.${col.name} is NOT NULL with no default — adding as nullable ` +
            `(SQLite cannot backfill it). Populate it before relying on the constraint.`,
        );
      }

      if (!DRY_RUN) live.exec(`ALTER TABLE "${table}" ADD COLUMN ${clause}`);
      record("schema", `${table}.${col.name} added`);
    }
  }

  // Indexes last: a CREATE INDEX can reference a column only just added above.
  const liveIndexes = new Set(
    (
      live.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all() as { name: string }[]
    ).map((r) => r.name),
  );

  for (const [name, ddl] of ref.indexDDL) {
    if (liveIndexes.has(name)) continue;
    try {
      if (!DRY_RUN) live.exec(ddl);
      record("schema", `index ${name} created`);
    } catch (err) {
      // A UNIQUE index fails if the live data already violates it. Report it and
      // keep going: aborting the whole upgrade over one index would strand the
      // database mid-way, and the operator needs to see WHICH constraint the
      // data breaks — not a stack trace from step 2 of 3.
      warn(
        `Could not create index ${name}: ${err instanceof Error ? err.message : String(err)}. ` +
          `Existing data violates it — resolve the duplicates and re-run.`,
      );
    }
  }

  // Objects the live database has and the v1.0.0 schema does not. These are
  // leftovers from migrations consolidated away in earlier releases — e.g.
  // idx_customers_guid, made redundant by the UNIQUE constraint on that column.
  //
  // Reported, never dropped. They are harmless, and an upgrade script that
  // deletes structures it did not create is a far worse failure mode than one
  // that leaves a stale index behind. Drop them by hand if you want the schema
  // to match a fresh install exactly.
  const extras = [...liveIndexes].filter(
    (name) => !ref.indexDDL.has(name) && !name.startsWith("sqlite_"),
  );
  if (extras.length > 0) {
    log(`  ${c.dim}Not in the v1.0.0 schema (left as-is): ${extras.join(", ")}${c.reset}`);
  }
}

// ─── Step 3: Data corrections ────────────────────────────────────────────────

/**
 * M026 backfill (OI-101). The columns come from createTables(), but rows that
 * predate versioning have a NULL group_id and would resolve to no pattern.
 * Each existing row becomes its own lineage.
 */
function backfillPatternGroups(live: Database.Database): void {
  // Absent entirely before v0.2.0, and without group_id before M026.
  if (!hasColumn(live, "rotation_patterns", "group_id")) {
    return void skipUnavailable("rotation_patterns.group_id");
  }

  const pending = live
    .prepare(`SELECT COUNT(*) AS n FROM rotation_patterns WHERE group_id IS NULL`)
    .get() as { n: number };
  if (pending.n === 0) return;

  if (!DRY_RUN) live.exec(`UPDATE rotation_patterns SET group_id = id WHERE group_id IS NULL`);
  record("data", `rotation_patterns: ${pending.n} row(s) given their own group_id`);
}

/**
 * OI-108. Two versions of one shift effective on the same date are summed by the
 * engine, silently doubling that shift's roster — this was found in live
 * production data (13SMD as both id=3 and id=7, 20 AMTs for one shift).
 *
 * `versionStaffingShift` closes the predecessor the day before the successor
 * opens, but a version created any other way — Add Shift, a direct PUT, an
 * import — leaves the predecessor open-ended. This applies that same closing
 * rule retroactively.
 *
 * Lineage is matched on (config_id, name), which is all `staffing_shifts`
 * carries; it has no group_id (OI-111).
 */
/**
 * OI-111. `staffing_shifts` gained a `group_id` giving versions of one shift a
 * stable identity, as `rotation_patterns` got in M026.
 *
 * The DDL is additive, but this backfill is not repeatable later, which is why
 * it belongs in the v1.0.0 upgrade rather than a future release. Lineage is
 * currently reconstructible because every version of a shift still shares a
 * name within its config. The first rename after this point destroys that
 * evidence permanently — nothing would distinguish "10WKD renamed to 10WKD-A"
 * from two unrelated shifts, and no later migration could recover it.
 *
 * Each row defaults to its own lineage; rows sharing (config_id, name) then
 * collapse onto the lowest id among them.
 */
/**
 * Drop the foreign key from `mh_override_history.work_package_id`.
 *
 * The table shipped with `REFERENCES work_packages(id)` and no ON DELETE, which
 * made the cleanup-canceled cron throw "FOREIGN KEY constraint failed" and roll
 * back its entire transaction the first time a canceled work package had
 * override history — that job deletes `mh_overrides` explicitly but never these
 * rows. The audit trail is meant to outlive its work package, so the reference
 * becomes logical, matching flight_events / time_bookings / billing_entries.
 *
 * SQLite cannot ALTER a constraint away, so this rebuilds the table. Only
 * databases created by the original OI-104 schema need it; anything built from
 * the current createTables() already has the right shape and is skipped.
 */
function dropOverrideHistoryFk(live: Database.Database): void {
  const exists = live
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='mh_override_history'`)
    .get();
  if (!exists) return;

  const fks = live.prepare(`PRAGMA foreign_key_list("mh_override_history")`).all() as {
    table: string;
    from: string;
  }[];
  if (!fks.some((f) => f.table === "work_packages" && f.from === "work_package_id")) return;

  const rows = live.prepare(`SELECT COUNT(*) AS n FROM mh_override_history`).get() as { n: number };
  if (DRY_RUN) {
    record(
      "data",
      `mh_override_history: would rebuild without the work_packages FK (${rows.n} row(s) preserved)`,
    );
    return;
  }

  // Foreign keys must be off for the rename, and the pragma is a no-op inside a
  // transaction — so this runs outside the caller's transaction, immediately
  // before it. Idempotent either way: the FK probe above short-circuits.
  live.exec(`
    CREATE TABLE mh_override_history_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_package_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      previous_mh REAL,
      new_mh REAL,
      imported_mh REAL,
      supplied_mh REAL,
      min_hours REAL,
      source TEXT NOT NULL DEFAULT 'api',
      note TEXT,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      changed_at TEXT NOT NULL
    );
    INSERT INTO mh_override_history_new
      SELECT id, work_package_id, action, previous_mh, new_mh, imported_mh,
             supplied_mh, min_hours, source, note, changed_by, changed_at
      FROM mh_override_history;
    DROP TABLE mh_override_history;
    ALTER TABLE mh_override_history_new RENAME TO mh_override_history;
    CREATE INDEX IF NOT EXISTS idx_mh_override_history_wp ON mh_override_history(work_package_id);
    CREATE INDEX IF NOT EXISTS idx_mh_override_history_changed ON mh_override_history(changed_at);
  `);

  record(
    "data",
    `mh_override_history: rebuilt without the work_packages FK (${rows.n} row(s) preserved)`,
  );
}

function backfillShiftGroups(live: Database.Database): void {
  // pre-OI-111 schema, or pre-v0.2.0 where the table itself does not exist yet
  if (!hasColumn(live, "staffing_shifts", "group_id")) {
    return void skipUnavailable("staffing_shifts.group_id");
  }

  const pending = live
    .prepare(`SELECT COUNT(*) AS n FROM staffing_shifts WHERE group_id IS NULL`)
    .get() as { n: number };
  if (pending.n === 0) return;

  if (!DRY_RUN) {
    live.exec(`UPDATE staffing_shifts SET group_id = id WHERE group_id IS NULL`);
    live.exec(
      `UPDATE staffing_shifts SET group_id = (
         SELECT MIN(s2.id) FROM staffing_shifts s2
         WHERE s2.config_id = staffing_shifts.config_id AND s2.name = staffing_shifts.name
       )`,
    );
  }

  const lineages = live
    .prepare(`SELECT COUNT(DISTINCT config_id || '/' || name) AS n FROM staffing_shifts`)
    .get() as { n: number };
  record(
    "data",
    `staffing_shifts: ${pending.n} row(s) assigned to ${lineages.n} version lineage(s)`,
  );
}

function closeOverlappingShiftVersions(live: Database.Database): void {
  // Both columns arrived after the table did: rotation_end_date in M022,
  // group_id in OI-111. Upgrading from v0.2.0 or earlier reaches here with
  // neither, and from v0.1.x without the table at all.
  if (
    !hasColumn(live, "staffing_shifts", "group_id") ||
    !hasColumn(live, "staffing_shifts", "rotation_end_date")
  ) {
    return void skipUnavailable("staffing_shifts version columns");
  }

  const rows = live
    .prepare(
      `SELECT id, config_id, group_id, name, rotation_start_date, rotation_end_date, headcount
       FROM staffing_shifts
       ORDER BY config_id, name, rotation_start_date, id`,
    )
    .all() as {
    id: number;
    config_id: number;
    group_id: number | null;
    name: string;
    rotation_start_date: string;
    rotation_end_date: string | null;
    headcount: number;
  }[];

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    // Group by lineage once group_id exists (OI-111); fall back to the name,
    // which is all a pre-v1.0.0 row carries.
    const key =
      r.group_id != null ? `g\u0000${r.group_id}` : `n\u0000${r.config_id}\u0000${r.name}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Sorted by start date, so each row's successor is the next one along.
    for (let i = 0; i < group.length - 1; i++) {
      const predecessor = group[i];
      const successor = group[i + 1];

      // Windows intersect when the predecessor is still open on the day the
      // successor begins.
      const stillOpen =
        predecessor.rotation_end_date === null ||
        predecessor.rotation_end_date >= successor.rotation_start_date;
      if (!stillOpen) continue;
      if (predecessor.rotation_start_date >= successor.rotation_start_date) continue;

      const closeOn = previousDay(successor.rotation_start_date);
      if (!DRY_RUN) {
        live
          .prepare(`UPDATE staffing_shifts SET rotation_end_date = ?, updated_at = ? WHERE id = ?`)
          .run(closeOn, new Date().toISOString(), predecessor.id);
      }
      record(
        "data",
        `${predecessor.name}: version id=${predecessor.id} closed ${closeOn} ` +
          `(overlapped id=${successor.id} from ${successor.rotation_start_date}; ` +
          `combined headcount was ${predecessor.headcount + successor.headcount})`,
      );
    }
  }
}

/** YYYY-MM-DD one day earlier. */
function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * D-064 removed the legacy capacity engine and its settings, but left the rows
 * in place as harmless orphans. They are no longer read or seeded, and leaving
 * live-looking config that drives nothing is exactly what made OI-115 possible.
 */
function purgeOrphanedConfig(live: Database.Database): void {
  const placeholders = ORPHANED_CONFIG_KEYS.map(() => "?").join(", ");
  const found = live
    .prepare(`SELECT key FROM app_config WHERE key IN (${placeholders})`)
    .all(...ORPHANED_CONFIG_KEYS) as { key: string }[];
  if (found.length === 0) return;

  if (!DRY_RUN) {
    live
      .prepare(`DELETE FROM app_config WHERE key IN (${placeholders})`)
      .run(...ORPHANED_CONFIG_KEYS);
  }
  record("data", `app_config: removed ${found.map((f) => f.key).join(", ")} (D-064 orphans)`);
}

/**
 * OI-086. Since v0.1.1 the inbound SharePoint `Title` — which carries the work
 * package number, not a display label — was written to `work_packages.title`,
 * while the column actually meant for it, `workpackage_no`, was fed from an
 * inbound `WorkpackageNo` that no export ever sends. Result: `title` holds
 * every identifier (`AALA/L-201125-2`, `782CK-DAILY-TS-11-20-2025`) and
 * `workpackage_no` is NULL on every row. v1.0.0 collapses the two.
 *
 * Copy-then-drop rather than ALTER TABLE ... RENAME COLUMN:
 *
 * - A rename would fail outright. Both columns have existed side by side since
 *   v0.1.1, and SQLite refuses to rename onto a name already in use.
 * - Copying lets the move be conditional. Any row that somehow *did* receive a
 *   real `workpackage_no` keeps it; only NULL/blank targets are filled. A
 *   rename cannot express that.
 * - Idempotence falls out of the column probe: once `title` is dropped there is
 *   nothing to detect, so a second run is a no-op. Step 2 does not put it back,
 *   because it only ever adds what the reference schema declares and the
 *   reference schema no longer has a `title`.
 *
 * Ordering is safe: Step 2 runs first and adds nothing here (`workpackage_no`
 * already exists on every affected database), so the copy always has a target.
 * `title` carries no index, so DROP COLUMN is unobstructed.
 */
function remapTitleToWorkpackageNo(live: Database.Database): void {
  const cols = live.prepare(`PRAGMA table_info("work_packages")`).all() as ColumnInfo[];
  const names = new Set(cols.map((col) => col.name));
  if (!names.has("title")) return; // already remapped
  if (!names.has("workpackage_no")) {
    warn("work_packages.workpackage_no is missing — skipping the OI-086 remap");
    return;
  }

  const pending = live
    .prepare(
      `SELECT COUNT(*) AS n FROM work_packages
       WHERE title IS NOT NULL AND TRIM(title) <> ''
         AND (workpackage_no IS NULL OR TRIM(workpackage_no) = '')`,
    )
    .get() as { n: number };

  // Values that would be lost — a row holding two different identifiers. None
  // exist in any observed database, but say so rather than discard silently.
  const conflicts = live
    .prepare(
      `SELECT COUNT(*) AS n FROM work_packages
       WHERE title IS NOT NULL AND TRIM(title) <> ''
         AND workpackage_no IS NOT NULL AND TRIM(workpackage_no) <> ''
         AND title <> workpackage_no`,
    )
    .get() as { n: number };
  if (conflicts.n > 0) {
    warn(
      `${conflicts.n} work package(s) have a title differing from their existing ` +
        `workpackage_no — keeping workpackage_no, discarding title.`,
    );
  }

  if (!DRY_RUN) {
    live.exec(
      `UPDATE work_packages SET workpackage_no = TRIM(title)
       WHERE title IS NOT NULL AND TRIM(title) <> ''
         AND (workpackage_no IS NULL OR TRIM(workpackage_no) = '')`,
    );
    live.exec(`ALTER TABLE work_packages DROP COLUMN title`);
  }
  record("data", `work_packages: ${pending.n} title(s) copied to workpackage_no, title dropped`);
}

/**
 * OI-099. v1.0.0 folds flight_comments, notifications and the four feedback_*
 * tables into messages / labels / message_labels.
 *
 * Step 2 above has already created the three new tables from the reference
 * schema — EMPTY, on a database where the six old tables still hold every row.
 * That window is the dangerous part of this whole migration: the app runs
 * perfectly and shows zero comments, zero notifications and zero feedback, with
 * no error, no exception and no log line. An empty thread is indistinguishable
 * from a migrated one.
 *
 * So the move happens here, and `assertMessagesReconciled` throws if the counts
 * do not add up — which aborts the enclosing transaction and rolls the whole
 * upgrade back. The same call runs at every server boot, so a database that
 * skipped this script still gets migrated rather than silently emptied.
 *
 * The legacy tables are left in place, read-only: they are the only rollback for
 * a bad remap. They are dropped in v1.1.0.
 */
function backfillMessagesStep(live: Database.Database): void {
  // On a --dry-run against a pre-v1.0.0 database, Step 2 did not actually create
  // `messages`, so there is nothing to migrate into. Report the intent instead of
  // failing: the point of a dry run is to describe the upgrade, not to perform
  // half of it.
  const hasMessages =
    live.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'messages'`).get() !==
    undefined;

  if (!hasMessages) {
    if (DRY_RUN) {
      const legacyPresent = [
        "flight_comments",
        "notifications",
        "feedback_posts",
        "feedback_comments",
        "feedback_labels",
        "feedback_post_labels",
      ].filter(
        (t) =>
          live.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(t) !==
          undefined,
      );
      if (legacyPresent.length > 0) {
        record(
          "data",
          `messages: would migrate ${legacyPresent.join(", ")} once the table exists (OI-099)`,
        );
      }
      return;
    }
    throw new Error("messages table was not created in Step 2 — cannot backfill (OI-099)");
  }

  // dryRun is handled by the module itself, which rolls its own work back.
  const result = backfillMessages({ db: live, dryRun: DRY_RUN, onOrphan: "skip" });
  if (!result.ran) return;

  for (const w of result.warnings) warn(w);

  assertMessagesReconciled(result);

  for (const [source, sc] of Object.entries(result.sourceCounts)) {
    if (sc.inserted === 0) continue;
    record("data", `${source}: ${sc.inserted} row(s) moved into messages/labels`);
  }
  if (result.parentsRemapped > 0) {
    record("data", `messages: ${result.parentsRemapped} parent pointer(s) remapped to new ids`);
  }
  if (result.metadataRemapped > 0) {
    record(
      "data",
      `messages: ${result.metadataRemapped} notification metadata.commentId value(s) remapped`,
    );
  }
}

/** Record that this database has been through the v1.0.0 upgrade. */
function stampSchemaVersion(live: Database.Database): void {
  if (DRY_RUN) return;
  live
    .prepare(
      `INSERT INTO app_config (key, value, updated_at) VALUES ('schemaVersion', '1.0.0', ?)
       ON CONFLICT(key) DO UPDATE SET value = '1.0.0', updated_at = excluded.updated_at`,
    )
    .run(new Date().toISOString());
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  banner("Upgrade Database to v1.0.0");

  if (!fs.existsSync(DB_PATH)) {
    error(`No database at ${DB_PATH}. Nothing to upgrade.`);
    process.exit(1);
  }

  log(`Database: ${DB_PATH}`, "dim");
  log(`Size:     ${formatBytes(fs.statSync(DB_PATH).size)}`, "dim");
  if (DRY_RUN) warn("DRY RUN — no changes will be written");
  log("");

  if (!DRY_RUN) {
    const ok = await confirm(
      "This will modify the database. A backup is taken first. Continue? (y/N)",
    );
    if (!ok) {
      log("Aborted.", "yellow");
      process.exit(0);
    }
    log("");
  }

  const live = new Database(DB_PATH);
  live.pragma("busy_timeout = 5000");
  live.pragma("foreign_keys = ON");

  let reference: Awaited<ReturnType<typeof buildReference>> | undefined;
  let backupPath = "";

  try {
    // Step 0 — backup before anything else touches the file.
    if (!DRY_RUN) {
      log("Step 0 — Backup", "blue");
      backupPath = backupDatabase(live);
      log("");
    }

    // Step 1 — derive the target schema from createTables().
    log("Step 1 — Deriving target schema", "blue");
    reference = await buildReference();
    success(`Reference schema: ${reference.tables.size} tables, ${reference.indexes.size} indexes`);
    log("");

    // Step 2 — create any missing tables/indexes, then add missing columns.
    log("Step 2 — Schema catch-up", "blue");
    applyAdditiveCatchUp(live, reference);
    if (changes.filter((ch) => ch.step === "schema").length === 0) {
      log(`  ${c.dim}Schema already current${c.reset}`);
    }
    log("");

    // Step 3 — data corrections, all inside one transaction.
    log("Step 3 — Data corrections", "blue");
    // Outside the transaction: rebuilding a table requires foreign_keys off,
    // and that pragma is ignored inside an open transaction.
    live.pragma("foreign_keys = OFF");
    dropOverrideHistoryFk(live);
    live.pragma("foreign_keys = ON");

    const applyDataSteps = live.transaction(() => {
      backfillPatternGroups(live);
      // Must precede the overlap check, which now keys on the lineage it sets.
      backfillShiftGroups(live);
      closeOverlappingShiftVersions(live);
      remapTitleToWorkpackageNo(live);
      purgeOrphanedConfig(live);
      backfillMessagesStep(live);
      stampSchemaVersion(live);
    });
    applyDataSteps();
    if (changes.filter((ch) => ch.step === "data").length === 0) {
      log(`  ${c.dim}No data corrections needed${c.reset}`);
    }
    log("");

    // ── Summary ──
    log("═══════════════════════════════════════════════════════════", "blue");
    if (changes.length === 0) {
      success("Database was already at the v1.0.0 schema — nothing to do.");
    } else if (DRY_RUN) {
      success(`${changes.length} change(s) would be applied. Re-run without --dry-run to apply.`);
    } else {
      success(`Upgrade complete — ${changes.length} change(s) applied.`);
      log("");
      log("To roll back, restore the backup written in Step 0:", "blue");
      log(`  cp "${backupPath}" "${DB_PATH}"`);
    }
    log("");
  } catch (err) {
    log("");
    error(`Upgrade failed: ${err instanceof Error ? err.message : String(err)}`);
    if (!DRY_RUN) {
      log("");
      warn("The database may be partially upgraded. Restore from the Step 0 backup:");
      log(backupPath ? `  cp "${backupPath}" "${DB_PATH}"` : "  (backup was not reached)");
    }
    process.exitCode = 1;
  } finally {
    reference?.cleanup();
    live.close();
  }
}

main();
