#!/usr/bin/env npx tsx
/**
 * db:backup — Snapshot dashboard.db + input.json to timestamped backup.
 *
 * Usage: npm run db:backup
 */

import fs from "fs";
import path from "path";
import { sqlite } from "../../src/lib/db/client";
import { banner, log, success, warn, formatBytes, timestamp } from "./_cli-utils";

const PROJECT_ROOT = process.cwd();
const DB_PATH = path.join(PROJECT_ROOT, "data", "dashboard.db");
const INPUT_PATH = path.join(PROJECT_ROOT, "data", "input.json");

function dirSize(dirPath: string): number {
  let total = 0;
  for (const f of fs.readdirSync(dirPath)) {
    const fp = path.join(dirPath, f);
    const stat = fs.statSync(fp);
    total += stat.isDirectory() ? dirSize(fp) : stat.size;
  }
  return total;
}

function main() {
  banner("Database Backup");

  if (!fs.existsSync(DB_PATH)) {
    warn("dashboard.db does not exist. Nothing to backup.");
    process.exit(0);
  }

  const ts = timestamp();
  const backupDir = path.join(PROJECT_ROOT, "data", "backups", ts);
  fs.mkdirSync(backupDir, { recursive: true });

  // Flush WAL for consistent snapshot
  try {
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    warn("Could not checkpoint WAL (non-critical)");
  }

  // Copy dashboard.db
  fs.copyFileSync(DB_PATH, path.join(backupDir, "dashboard.db"));
  success(`Backed up dashboard.db (${formatBytes(fs.statSync(DB_PATH).size)})`);

  // Copy input.json if it exists
  if (fs.existsSync(INPUT_PATH)) {
    fs.copyFileSync(INPUT_PATH, path.join(backupDir, "input.json"));
    success(`Backed up input.json (${formatBytes(fs.statSync(INPUT_PATH).size)})`);
  } else {
    log("  input.json not found — skipped.", "dim");
  }

  log("");
  success(`Backup location: data/backups/${ts}/`);
  log(`  Total size: ${formatBytes(dirSize(backupDir))}`);
  log("");
  log("To restore:", "blue");
  log(`  cp data/backups/${ts}/dashboard.db data/dashboard.db`);
  log(`  cp data/backups/${ts}/input.json data/input.json`);
  log("");
}

main();
