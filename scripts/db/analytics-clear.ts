#!/usr/bin/env tsx
/**
 * db:analytics-clear — Purge all analytics events from the database.
 * Keeps all other data intact (users, customers, config, etc.).
 *
 * Usage: npm run db:analytics-clear
 *        npm run db:analytics-clear -- --yes   (skip confirmation)
 */

import { db } from "../../src/lib/db/client";
import { analyticsEvents } from "../../src/lib/db/schema";
import { banner, log, success, confirm } from "./_cli-utils";

async function main() {
  banner("Clear Analytics Events");

  const count = db.select().from(analyticsEvents).all().length;
  log(`  Current analytics events: ${count}`);
  log("");

  if (count === 0) {
    log("  No events to clear.");
    process.exit(0);
  }

  if (!(await confirm(`Delete ${count} analytics events? [y/N]:`))) {
    log("Cancelled.", "blue");
    process.exit(0);
  }

  db.delete(analyticsEvents).run();

  log("");
  success(`Cleared ${count} analytics events`);
  log("");
}

main();
