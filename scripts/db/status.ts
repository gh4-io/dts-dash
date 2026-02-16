#!/usr/bin/env npx tsx
/**
 * db:status — Show database health: table row counts, file sizes, last import.
 * Read-only, no modifications.
 *
 * Usage: npm run db:status
 */

import fs from "fs";
import path from "path";
import { db } from "../../src/lib/db/client";
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
  };

  let totalRows = 0;
  for (const [name, table] of Object.entries(tables)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = db.select().from(table as any).all().length;
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
    log(`  Source:   ${lastImport.source}${lastImport.fileName ? ` (${lastImport.fileName})` : ""}`);
    log(`  Status:   ${lastImport.status}`);
  } else {
    log("  No imports recorded.", "dim");
  }

  // ─── Event Data ────────────────────────────────────────────────────────────

  log("");
  log("Event Data:", "blue");
  const inputPath = path.join(PROJECT_ROOT, "data", "input.json");

  if (fs.existsSync(inputPath)) {
    const inputStats = fs.statSync(inputPath);
    log(`  File:     ${formatBytes(inputStats.size)}`);
    try {
      const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
      const records = Array.isArray(data) ? data : data.value ?? [];
      log(`  Records:  ${records.length}`);
    } catch {
      log("  Records:  (parse error)", "yellow");
    }
  } else {
    log("  input.json does not exist.", "dim");
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
