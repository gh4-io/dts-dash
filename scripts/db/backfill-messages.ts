#!/usr/bin/env tsx
/**
 * db:backfill-messages — Move the six pre-v1.0.0 messaging tables into
 * messages / labels / message_labels (OI-099).
 *
 * Usage: npm run db:backfill-messages [-- --dry-run] [-- --strict]
 *
 * ── When you need this ──────────────────────────────────────────────────────
 *
 * Usually never. The backfill is wired into `bootstrapDatabase()` and runs on
 * every server start, because a migration that someone can forget to run is a
 * migration that leaves the app showing zero comments, zero notifications and
 * zero feedback with no error of any kind.
 *
 * This CLI exists for the cases where you want to see the reconciliation before
 * the app touches the database:
 *
 *   - `--dry-run` reports exactly what would move, and writes nothing.
 *   - `--strict` fails on the first orphan instead of skipping and counting it.
 *   - Running it against a copy of production before upgrading for real.
 *
 * It is idempotent, so running it when there is nothing to do is free.
 */

import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { banner, log, success, warn, error, c, hasFlag, padRight } from "./_cli-utils";
import {
  backfillMessages,
  assertMessagesReconciled,
} from "../../src/lib/db/backfill/messages-backfill";

const PROJECT_ROOT = process.cwd();
const DB_PATH = process.env.DATABASE_PATH || path.join(PROJECT_ROOT, "data", "dashboard.db");
const DRY_RUN = hasFlag("--dry-run");
const STRICT = hasFlag("--strict");

function main() {
  banner("Backfill Messages (OI-099)");

  if (!fs.existsSync(DB_PATH)) {
    error(`No database at ${DB_PATH}. Nothing to backfill.`);
    process.exit(1);
  }

  log(`Database: ${DB_PATH}`, "dim");
  if (DRY_RUN) warn("DRY RUN — no changes will be written");
  if (STRICT) log("Strict mode — orphaned rows will abort the run", "dim");
  log("");

  const db = new Database(DB_PATH);
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  try {
    const result = backfillMessages({
      db,
      dryRun: DRY_RUN,
      onOrphan: STRICT ? "throw" : "skip",
    });

    if (!result.ran) {
      success("No legacy messaging tables present — nothing to do (fresh install).");
      log("");
      return;
    }

    log("Per-source reconciliation:", "blue");
    log(
      `  ${padRight("source", 24)} ${padRight("legacy", 8)} ${padRight("new", 8)} ` +
        `${padRight("present", 8)} ${padRight("orphan", 8)} balanced`,
      "dim",
    );

    for (const [source, s] of Object.entries(result.sourceCounts)) {
      const mark = s.balanced ? `${c.green}yes${c.reset}` : `${c.red}NO${c.reset}`;
      log(
        `  ${padRight(source, 24)} ${padRight(String(s.legacy), 8)} ` +
          `${padRight(String(s.inserted), 8)} ${padRight(String(s.alreadyPresent), 8)} ` +
          `${padRight(String(s.orphansSkipped), 8)} ${mark}`,
      );
    }

    log("");
    log(`  Inserted:          ${result.inserted}`);
    log(`  Already present:   ${result.alreadyPresent}`);
    log(`  Orphans skipped:   ${result.orphansSkipped}`);
    log(`  Parents remapped:  ${result.parentsRemapped}`);
    log(`  Metadata remapped: ${result.metadataRemapped}`);

    if (result.warnings.length > 0) {
      log("");
      for (const w of result.warnings) warn(w);
    }

    log("");
    // Same guard the server applies at boot — a mismatch here is the difference
    // between a migrated database and one that will silently show empty threads.
    assertMessagesReconciled(result);

    if (DRY_RUN) {
      success("Reconciled. Re-run without --dry-run to apply.");
    } else {
      success("Backfill complete and reconciled.");
      log("");
      log("The legacy tables are retained read-only as the rollback path;", "dim");
      log("they are dropped in v1.1.0.", "dim");
    }
    log("");
  } catch (err) {
    log("");
    error(`Backfill failed: ${err instanceof Error ? err.message : String(err)}`);
    log("");
    warn("Nothing was written — the backfill runs in a single transaction.");
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
