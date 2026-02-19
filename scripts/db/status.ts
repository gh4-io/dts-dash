#!/usr/bin/env tsx
/**
 * db:status — Show database health: table row counts, file sizes, last import.
 * Read-only, no modifications.
 *
 * Usage: npm run db:status
 */

import fs from "fs";
import path from "path";
import { db, sqlite } from "../../src/lib/db/client";
import * as schema from "../../src/lib/db/schema";
import { desc } from "drizzle-orm";
import { banner, log, formatBytes, padRight, c } from "./_cli-utils";

const PROJECT_ROOT = process.cwd();

function main() {
  banner("Database Status");

  const dbPath = path.join(PROJECT_ROOT, "data", "dashboard.db");

  // ─── DB File Info ──────────────────────────────────────────────────────────

  if (!fs.existsSync(dbPath)) {
    log("  dashboard.db does not exist.", "yellow");
    log("  Run 'npm run db:seed' to initialize.", "dim");
    process.exit(0);
  }

  const dbStats = fs.statSync(dbPath);
  log("Database File:", "blue");
  log(`  Path:     data/dashboard.db`);
  log(`  Size:     ${formatBytes(dbStats.size)}`);
  log(`  Modified: ${dbStats.mtime.toISOString()}`);

  const walPath = dbPath + "-wal";
  if (fs.existsSync(walPath)) {
    log(`  WAL:      ${formatBytes(fs.statSync(walPath).size)}`);
  }

  // ─── Table Row Counts ──────────────────────────────────────────────────────

  log("");
  log("Table Row Counts:", "blue");

  const tables: Record<string, unknown> = {
    users: schema.users,
    sessions: schema.sessions,
    customers: schema.customers,
    user_preferences: schema.userPreferences,
    work_packages: schema.workPackages,
    mh_overrides: schema.mhOverrides,
    aircraft_type_mappings: schema.aircraftTypeMappings,
    manufacturers: schema.manufacturers,
    aircraft_models: schema.aircraftModels,
    engine_types: schema.engineTypes,
    aircraft: schema.aircraft,
    import_log: schema.importLog,
    master_data_import_log: schema.masterDataImportLog,
    analytics_events: schema.analyticsEvents,
    app_config: schema.appConfig,
    cron_job_runs: schema.cronJobRuns,
  };

  let totalRows = 0;
  for (const [name, table] of Object.entries(tables)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = table as any;
    const count = db.select().from(tbl).all().length;
    totalRows += count;
    const countStr = count > 0 ? `${c.yellow}${count}${c.reset}` : `${c.dim}0${c.reset}`;
    log(`  ${padRight(name, 26)} ${countStr}`);
  }
  log(`  ${"─".repeat(26)} ──`);
  log(`  ${padRight("total", 26)} ${totalRows}`);

  // ─── Last Import ───────────────────────────────────────────────────────────

  log("");
  log("Last Import:", "blue");
  const lastImport = db
    .select()
    .from(schema.importLog)
    .orderBy(desc(schema.importLog.importedAt))
    .limit(1)
    .get();

  if (lastImport) {
    log(`  Time:     ${lastImport.importedAt}`);
    log(`  Records:  ${lastImport.recordCount}`);
    log(
      `  Source:   ${lastImport.source}${lastImport.fileName ? ` (${lastImport.fileName})` : ""}`,
    );
    log(`  Status:   ${lastImport.status}`);
  } else {
    log("  No imports recorded.", "dim");
  }

  // ─── Work Packages ─────────────────────────────────────────────────────────

  log("");
  log("Work Packages:", "blue");
  const wpCount = db.select().from(schema.workPackages).all().length;
  if (wpCount > 0) {
    log(`  Records:  ${wpCount}`);

    // Check for canceled WPs
    const canceledResult = sqlite
      .prepare("SELECT count(*) as count FROM work_packages WHERE status LIKE 'Cancel%'")
      .get() as { count: number } | undefined;
    const canceledCount = canceledResult?.count ?? 0;
    if (canceledCount > 0) {
      log(
        `  Canceled: ${c.yellow}${canceledCount}${c.reset} (run ${c.cyan}npm run db:cleanup-canceled${c.reset} to purge)`,
      );
    }
  } else {
    log("  No work packages imported yet.", "dim");
    log("  Run 'npm run db:import -- --file <path>' to import data.", "dim");
  }

  // ─── Backups ───────────────────────────────────────────────────────────────

  const backupDir = path.join(PROJECT_ROOT, "data", "backups");
  if (fs.existsSync(backupDir)) {
    const backups = fs.readdirSync(backupDir);
    if (backups.length > 0) {
      log("");
      log("Backups:", "blue");
      log(`  Count:    ${backups.length}`);
    }
  }

  // ─── Seed Files ────────────────────────────────────────────────────────────

  log("");
  log("Seed Files:", "blue");
  const seedDir = path.join(PROJECT_ROOT, "data", "seed");
  if (fs.existsSync(seedDir)) {
    const seedFiles = fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"));
    for (const f of seedFiles) {
      const size = fs.statSync(path.join(seedDir, f)).size;
      log(`  ${padRight(f, 30)} ${formatBytes(size)}`);
    }
  } else {
    log("  data/seed/ directory missing!", "red");
  }

  log("");
}

main();
