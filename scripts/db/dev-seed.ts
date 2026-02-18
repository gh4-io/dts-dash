#!/usr/bin/env npx tsx
/**
 * db:dev-seed — Seed database for local development.
 *
 * Default: Seeds users, system user, aircraft type mappings, and app config.
 * --full:  Seeds ALL data (equivalent to db:seed).
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage: npm run db:dev-seed              (minimal dev data)
 *        npm run db:dev-seed -- --full    (all data including customers, work packages, etc.)
 */

import { banner, log, success, error, hasFlag, c } from "./_cli-utils";
import { devSeed } from "../../src/lib/db/seed";

const full = hasFlag("--full");

async function main() {
  banner("Dev Seed");

  if (full) {
    log(
      `  ${c.yellow}--full${c.reset} mode: seeding ALL data (users, customers, work packages, etc.)`,
    );
  } else {
    log("  Minimal mode: seeding users + aircraft type mappings + app config");
    log(
      `  Use ${c.yellow}--full${c.reset} to seed all data (customers, work packages, reference tables).`,
    );
  }
  log("");

  try {
    await devSeed(full);
    log("");
    success(
      full ? "Dev seed (full) completed successfully" : "Dev seed (minimal) completed successfully",
    );

    if (!full) {
      log("");
      log("Seeded:", "blue");
      log("  - Test users (admin@local, user@local)");
      log("  - System user (API ingestion)");
      log("  - Aircraft type mappings (31 patterns)");
      log("  - App config (shift definitions, defaults)");
      log("");
      log("Not seeded (use --full):", "dim");
      log("  - Customers, manufacturers, aircraft models, engine types");
      log("  - Work packages (361 records)");
    }
  } catch (err) {
    error(`Dev seed failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
