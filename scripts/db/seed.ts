#!/usr/bin/env npx tsx
/**
 * db:seed — Run full database seed from JSON data files.
 * Idempotent: safe to run multiple times.
 *
 * Usage: npm run db:seed
 */

import { banner, log, success, error } from "./_cli-utils";
import { seed } from "../../src/lib/db/seed";

async function main() {
  banner("Database Seed");

  try {
    await seed();
    log("");
    success("Database seeded successfully");
  } catch (err) {
    error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
