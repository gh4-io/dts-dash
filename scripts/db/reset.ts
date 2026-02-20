#!/usr/bin/env tsx
/**
 * db:reset — Delete dashboard.db and recreate empty schema.
 * DESTRUCTIVE: All users, customers, settings, analytics will be lost.
 *
 * Usage: npm run db:reset              (schema only, no seed data)
 *        npm run db:reset -- --seed    (also seed demo data)
 *        npm run db:reset -- --yes     (skip confirmation)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { banner, log, success, warn, error, confirm, c } from "./_cli-utils";

const PROJECT_ROOT = process.cwd();
const DB_PATH = path.join(PROJECT_ROOT, "data", "dashboard.db");
const args = process.argv.slice(2);
const withSeed = args.includes("--seed");

async function main() {
  banner("Database Reset");

  warn("This will DELETE dashboard.db and recreate the schema.");
  log("  All users, customers, settings, analytics will be LOST.");
  log("  Work packages and all other data will be LOST.");
  if (withSeed) {
    log(`  ${c.yellow}--seed${c.reset} flag: demo data will be inserted after schema creation.`);
  } else {
    log("  No seed data will be inserted. Run 'npm run db:seed' separately if needed.");
  }
  log("");

  if (!fs.existsSync(DB_PATH)) {
    log("  dashboard.db does not exist. Will create fresh schema...");
    log("");
  }

  if (!(await confirm("Delete database and recreate? [y/N]:"))) {
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

  // Recreate schema (tables + migrations) via db:migrate
  log("Creating schema...", "blue");
  try {
    execSync("tsx scripts/db/migrate.ts", {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
  } catch {
    error("Schema creation failed. Run 'npm run db:migrate' manually.");
    process.exit(1);
  }

  // Optionally seed demo data
  if (withSeed) {
    log("");
    log("Seeding demo data...", "blue");
    try {
      execSync("tsx scripts/db/seed.ts", {
        cwd: PROJECT_ROOT,
        stdio: "inherit",
      });
    } catch {
      error("Seed failed. Run 'npm run db:seed' manually.");
      process.exit(1);
    }
  }

  log("");
  log("═══════════════════════════════════════════════════════════", "green");
  success("Database reset complete");
  log("═══════════════════════════════════════════════════════════", "green");
  log("");
  if (withSeed) {
    log("Default credentials:", "blue");
    log(`  Admin: ${c.yellow}admin@local${c.reset} / ${c.yellow}admin123${c.reset} (superadmin)`);
    log(`  User:  ${c.yellow}user@local${c.reset} / ${c.yellow}user123${c.reset}`);
  } else {
    log("Schema created with empty tables. Next steps:", "blue");
    log("  npm run db:seed        — insert demo/dev data");
    log("  npm run dev            — start the app (create your first user via admin)");
  }
  log("");
}

main();
