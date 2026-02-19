#!/usr/bin/env tsx
/**
 * db:cleanup-canceled — Remove canceled work packages from the database.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npm run db:cleanup-canceled                    # Interactive, purge all canceled
 *   npm run db:cleanup-canceled -- --grace-hours 6 # Only purge WPs canceled > 6h ago
 *   npm run db:cleanup-canceled -- --yes           # Skip confirmation prompt
 */

import { sqlite } from "../../src/lib/db/client";
import { cleanupCanceledWPs } from "../../src/lib/cron/tasks/cleanup-canceled";
import { banner, log, success, confirm, c } from "./_cli-utils";

function parseGraceHours(): number {
  const idx = process.argv.indexOf("--grace-hours");
  if (idx === -1) return 0; // Default: purge all canceled (no grace period for manual runs)
  const val = Number(process.argv[idx + 1]);
  if (isNaN(val) || val < 0) {
    log("Invalid --grace-hours value. Must be a non-negative number.", "red");
    process.exit(1);
  }
  return val;
}

async function main() {
  banner("Cleanup Canceled Work Packages");

  const graceHours = parseGraceHours();

  // Count canceled records
  const totalResult = sqlite
    .prepare("SELECT count(*) as count FROM work_packages WHERE status LIKE 'Cancel%'")
    .get() as { count: number };
  const totalCount = totalResult?.count ?? 0;

  if (totalCount === 0) {
    success("No canceled work packages found. Database is clean.");
    return;
  }

  log(`Found ${c.yellow}${totalCount}${c.reset} canceled work package(s) total.`);

  if (graceHours > 0) {
    const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString();
    const eligibleResult = sqlite
      .prepare(
        "SELECT count(*) as count FROM work_packages WHERE status LIKE 'Cancel%' AND imported_at < ?",
      )
      .get(cutoff) as { count: number };
    const eligibleCount = eligibleResult?.count ?? 0;

    log(
      `  Grace period: ${graceHours}h — ${c.yellow}${eligibleCount}${c.reset} eligible for deletion, ${totalCount - eligibleCount} within grace period.`,
    );

    if (eligibleCount === 0) {
      success("All canceled WPs are within the grace period. Nothing to delete.");
      return;
    }
  }

  log("");

  if (
    !(await confirm(
      `Delete canceled work packages${graceHours > 0 ? ` older than ${graceHours}h` : ""}? [y/N]:`,
    ))
  ) {
    log("Aborted.", "blue");
    return;
  }

  const result = await cleanupCanceledWPs({ graceHours });

  log("");
  success(result.message);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
