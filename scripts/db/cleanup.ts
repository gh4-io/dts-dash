#!/usr/bin/env tsx
/**
 * db:cleanup — Remove orphaned/inferred rows that provide no data value.
 * Safe to run on a live database. Idempotent — can be re-run freely.
 *
 * Removes:
 *   1. Inferred aircraft with no type and no model FK
 *   2. Inferred customers not referenced by any work package (and no sp_id)
 *   3. Expired sessions
 *   4. Import log entries whose creator user no longer exists
 *
 * Usage: npm run db:cleanup [--yes]
 */

import { banner, log, warn, success, error, confirm } from "./_cli-utils";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "data/dashboard.db");

async function main() {
  banner("Database Cleanup");

  const db = new Database(DB_PATH);

  // ─── 1. Inferred aircraft with no type and no model ─────────────────────────

  const orphanAircraft = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM aircraft
       WHERE source = 'inferred'
         AND aircraft_type IS NULL
         AND aircraft_model_id IS NULL`,
    )
    .get() as { cnt: number };

  log(`Inferred aircraft with no type/model: ${orphanAircraft.cnt}`);

  // ─── 2. Inferred customers not referenced by any WP ─────────────────────────

  const orphanCustomers = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM customers
       WHERE source = 'inferred'
         AND sp_id IS NULL
         AND name NOT IN (SELECT DISTINCT customer FROM work_packages)`,
    )
    .get() as { cnt: number };

  log(`Inferred customers not in any work package: ${orphanCustomers.cnt}`);

  // ─── 3. Expired sessions ─────────────────────────────────────────────────────

  const expiredSessions = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM sessions
       WHERE expires_at < datetime('now')`,
    )
    .get() as { cnt: number };

  log(`Expired sessions: ${expiredSessions.cnt}`);

  // ─── 4. Orphaned import log entries ─────────────────────────────────────────

  const orphanLogs = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM master_data_import_log
       WHERE imported_by IS NOT NULL
         AND imported_by NOT IN (SELECT id FROM users)`,
    )
    .get() as { cnt: number };

  log(`Import log entries with deleted users: ${orphanLogs.cnt}`);

  log("");

  const total = orphanAircraft.cnt + orphanCustomers.cnt + expiredSessions.cnt + orphanLogs.cnt;

  if (total === 0) {
    success("Nothing to clean up — database is already tidy.");
    db.close();
    return;
  }

  warn(`Total rows to remove: ${total}`);
  log("");

  const proceed = await confirm("Proceed with cleanup? (y/N)");
  if (!proceed) {
    log("Aborted — no changes made.", "yellow");
    db.close();
    return;
  }

  // ─── Execute deletions ───────────────────────────────────────────────────────

  let deleted = 0;

  if (orphanAircraft.cnt > 0) {
    const result = db
      .prepare(
        `DELETE FROM aircraft
         WHERE source = 'inferred'
           AND aircraft_type IS NULL
           AND aircraft_model_id IS NULL`,
      )
      .run();
    log(`  Removed ${result.changes} inferred aircraft`, "green");
    deleted += result.changes;
  }

  if (orphanCustomers.cnt > 0) {
    const result = db
      .prepare(
        `DELETE FROM customers
         WHERE source = 'inferred'
           AND sp_id IS NULL
           AND name NOT IN (SELECT DISTINCT customer FROM work_packages)`,
      )
      .run();
    log(`  Removed ${result.changes} inferred customers`, "green");
    deleted += result.changes;
  }

  if (expiredSessions.cnt > 0) {
    const result = db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    log(`  Removed ${result.changes} expired sessions`, "green");
    deleted += result.changes;
  }

  if (orphanLogs.cnt > 0) {
    const result = db
      .prepare(
        `DELETE FROM master_data_import_log
         WHERE imported_by IS NOT NULL
           AND imported_by NOT IN (SELECT id FROM users)`,
      )
      .run();
    log(`  Removed ${result.changes} orphaned import log entries`, "green");
    deleted += result.changes;
  }

  log("");
  success(`Cleanup complete — ${deleted} rows removed.`);

  db.close();
}

main().catch((err) => {
  error(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
