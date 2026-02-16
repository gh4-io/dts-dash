#!/usr/bin/env npx tsx
/**
 * db:migrate — Run pending schema migrations.
 * Idempotent: safe to run multiple times.
 * Creates tables if they don't exist, then applies ALTER TABLE migrations.
 *
 * Usage: npm run db:migrate
 */

import { createTables, runMigrations } from "../../src/lib/db/seed";
import { banner, log, success, c } from "./_cli-utils";

function main() {
  banner("Database Migration");

  // Ensure tables exist
  log("Checking tables...", "blue");
  createTables();
  success("Tables verified");
  log("");

  // Run migrations
  log("Running migrations...", "blue");
  const results = runMigrations();

  let applied = 0;
  for (const r of results) {
    if (r.applied) {
      success(`  Applied: ${r.name}`);
      applied++;
    } else {
      log(`  ${c.dim}Skipped: ${r.name} (already applied)${c.reset}`);
    }
  }

  log("");
  success(
    `Migrations complete: ${applied} applied, ${results.length - applied} already present`
  );
  log("");
}

main();
