#!/usr/bin/env npx tsx
/**
 * db:reset — Delete dashboard.db entirely and re-seed from scratch.
 * DESTRUCTIVE: All users, customers, settings, analytics will be lost.
 *
 * Usage: npm run db:reset
 *        npm run db:reset -- --yes   (skip confirmation)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { banner, log, success, warn, error, confirm, c } from "./_cli-utils";

const PROJECT_ROOT = process.cwd();
const DB_PATH = path.join(PROJECT_ROOT, "data", "dashboard.db");

async function main() {
  banner("Database Reset");

  warn("This will DELETE dashboard.db and re-create from scratch.");
  log("  All users, customers, settings, analytics will be LOST.");
  log("  Event data (input.json) will NOT be affected.");
  log("");

  if (!fs.existsSync(DB_PATH)) {
    log("  dashboard.db does not exist. Running fresh seed...");
    log("");
  }

  if (!(await confirm("Delete database and re-seed? [y/N]:"))) {
    log("Cancelled.", "blue");
    process.exit(0);
  }

  log("");

  // Delete DB files
  for (const ext of ["", "-shm", "-wal"]) {
    const file = DB_PATH + ext;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
  success("Deleted dashboard.db");

  // Re-seed via child process (clean module cache = fresh DB connection)
  log("Re-seeding database...", "blue");
  try {
    execSync("npx tsx scripts/db/seed.ts", {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
  } catch {
    error("Re-seed failed. Run 'npm run db:seed' manually.");
    process.exit(1);
  }

  log("");
  log("═══════════════════════════════════════════════════════════", "green");
  success("Database reset complete");
  log("═══════════════════════════════════════════════════════════", "green");
  log("");
  log("Default credentials:", "blue");
  log(`  Admin: ${c.yellow}admin@cvg.local${c.reset} / ${c.yellow}admin123${c.reset} (superadmin)`);
  log(`  User:  ${c.yellow}user@cvg.local${c.reset} / ${c.yellow}user123${c.reset}`);
  log("");
}

main();
