#!/usr/bin/env tsx
/**
 * db:export — Export all database tables to JSON files.
 * Creates a timestamped directory in data/exports/.
 *
 * Usage: npm run db:export
 */

import fs from "fs";
import path from "path";
import { db } from "../../src/lib/db/client";
import * as schema from "../../src/lib/db/schema";
import { banner, log, success, warn, formatBytes, padRight, timestamp } from "./_cli-utils";

const PROJECT_ROOT = process.cwd();

function main() {
  banner("Database Export");

  const ts = timestamp();
  const exportDir = path.join(PROJECT_ROOT, "data", "exports", ts);
  fs.mkdirSync(exportDir, { recursive: true });

  const tables: Record<string, unknown> = {
    users: schema.users,
    sessions: schema.sessions,
    customers: schema.customers,
    user_preferences: schema.userPreferences,
    work_packages: schema.workPackages,
    mh_overrides: schema.mhOverrides,
    mh_override_history: schema.mhOverrideHistory,
    aircraft_type_mappings: schema.aircraftTypeMappings,
    manufacturers: schema.manufacturers,
    aircraft_models: schema.aircraftModels,
    engine_types: schema.engineTypes,
    aircraft: schema.aircraft,
    import_log: schema.importLog,
    master_data_import_log: schema.masterDataImportLog,
    analytics_events: schema.analyticsEvents,
    app_config: schema.appConfig,
    // OI-099. Note the list above previously omitted flight_comments,
    // notifications and all four feedback_* tables, so `npm run db:export` was
    // never a backup of comments, notifications or feedback. Use `npm run
    // db:backup` (file-level) for anything you intend to restore from.
    messages: schema.messages,
    labels: schema.labels,
    message_labels: schema.messageLabels,
  };

  log("Exporting tables:", "blue");

  for (const [name, table] of Object.entries(tables)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = table as any;
    const rows = db.select().from(t).all();
    const filePath = path.join(exportDir, `${name}.json`);
    const content = JSON.stringify(rows, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");
    log(`  ${padRight(name + ".json", 30)} ${rows.length} rows (${formatBytes(content.length)})`);
  }

  log("");
  warn("Note: users.json contains password hashes. Do not share publicly.");
  log("");
  success(`Export complete: data/exports/${ts}/`);
  log("");
}

main();
