#!/usr/bin/env tsx
/**
 * db:prune-import-history — Delete import history entries older than a retention window.
 *
 * CLI twin of the `prune-import-history` cron job; both call the same function.
 * Work packages are never touched beyond clearing their write-only
 * `import_log_id` provenance pointer, which the delete requires.
 *
 * Usage: npm run db:prune-import-history
 *        npm run db:prune-import-history -- --days=30
 *        npm run db:prune-import-history -- --yes      (skip confirmation)
 */

import { sqlite } from "../../src/lib/db/client";
import {
  pruneImportHistory,
  DEFAULT_RETENTION_DAYS,
} from "../../src/lib/cron/tasks/prune-import-history";
import { banner, log, success, warn, confirm } from "./_cli-utils";

function parseDays(): number {
  const arg = process.argv.find((a) => a.startsWith("--days="));
  if (!arg) return DEFAULT_RETENTION_DAYS;

  const value = Number(arg.slice("--days=".length));
  if (!Number.isFinite(value) || value < 0) {
    warn(`Invalid --days value "${arg}" — falling back to ${DEFAULT_RETENTION_DAYS}`);
    return DEFAULT_RETENTION_DAYS;
  }
  return value;
}

async function main() {
  banner("Prune Import History");

  const retentionDays = parseDays();

  if (retentionDays === 0) {
    log("  Retention is 0 — pruning is disabled. Nothing to do.");
    log("");
    process.exit(0);
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const total = (sqlite.prepare("SELECT COUNT(*) AS n FROM import_log").get() as { n: number }).n;
  const expiring = (
    sqlite.prepare("SELECT COUNT(*) AS n FROM import_log WHERE imported_at < ?").get(cutoff) as {
      n: number;
    }
  ).n;

  log(`  Retention window: ${retentionDays} day(s)`);
  log(`  Cutoff:           ${cutoff}`);
  log(`  Total entries:    ${total}`);
  log(`  Expiring:         ${expiring}`);
  log(`  Remaining after:  ${total - expiring}`);
  log("");

  if (expiring === 0) {
    log("  Nothing to prune.");
    log("");
    process.exit(0);
  }

  if (!(await confirm(`Delete ${expiring} import history entries? [y/N]:`))) {
    log("Cancelled.", "blue");
    process.exit(0);
  }

  const { pruned, dereferenced } = pruneImportHistory(retentionDays);

  log("");
  success(`Pruned ${pruned} import history entries older than ${retentionDays} day(s)`);
  if (dereferenced > 0) {
    log(`  Cleared import_log_id on ${dereferenced} work package(s) — no records were deleted.`);
  }
  log("");
}

main();
