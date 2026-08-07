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
    if (!DRY_RUN) live.exec(ddl);
    record("schema", `index ${name} created`);
  }
}

// ─── Step 3: Data corrections ────────────────────────────────────────────────

/**
 * M026 backfill (OI-101). The columns come from createTables(), but rows that
 * predate versioning have a NULL group_id and would resolve to no pattern.
 * Each existing row becomes its own lineage.
 */
function backfillPatternGroups(live: Database.Database): void {
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
function closeOverlappingShiftVersions(live: Database.Database): void {
  const rows = live
    .prepare(
      `SELECT id, config_id, name, rotation_start_date, rotation_end_date, headcount
       FROM staffing_shifts
       ORDER BY config_id, name, rotation_start_date, id`,
    )
    .all() as {
    id: number;
    config_id: number;
    name: string;
    rotation_start_date: string;
    rotation_end_date: string | null;
    headcount: number;
  }[];

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.config_id} ${r.name}`;
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
    const applyDataSteps = live.transaction(() => {
      backfillPatternGroups(live);
      closeOverlappingShiftVersions(live);
      purgeOrphanedConfig(live);
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
