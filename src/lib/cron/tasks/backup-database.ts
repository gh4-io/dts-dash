import { sqlite, dbPath } from "@/lib/db/client";
import { createChildLogger } from "@/lib/logger";
import type { CronTaskResult } from "@/lib/cron/index";
import fs from "fs";
import path from "path";

const log = createChildLogger("cron:backup-database");

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Create a timestamped backup of dashboard.db.
 * Optionally prunes old backups beyond `maxBackups`.
 *
 * Conforms to the CronTaskResult interface for the cron orchestrator.
 */
export async function backupDatabase(options: Record<string, unknown>): Promise<CronTaskResult> {
  const maxBackups = typeof options.maxBackups === "number" ? options.maxBackups : 7;

  if (!fs.existsSync(dbPath)) {
    log.warn("dashboard.db does not exist, skipping backup");
    return { message: "No database file to back up" };
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupsRoot = path.join(process.cwd(), "data", "backups");
  const backupDir = path.join(backupsRoot, ts);
  fs.mkdirSync(backupDir, { recursive: true });

  // Flush WAL for consistent snapshot
  try {
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    log.warn("Could not checkpoint WAL (non-critical)");
  }

  // Copy database file
  const destPath = path.join(backupDir, "dashboard.db");
  fs.copyFileSync(dbPath, destPath);
  const size = fs.statSync(destPath).size;

  log.info(
    { backupDir: `data/backups/${ts}/`, size: formatBytes(size) },
    "Database backup created",
  );

  // Prune old backups if maxBackups > 0
  let pruned = 0;
  if (maxBackups > 0 && fs.existsSync(backupsRoot)) {
    const dirs = fs
      .readdirSync(backupsRoot)
      .filter((d) => fs.statSync(path.join(backupsRoot, d)).isDirectory())
      .sort(); // ISO-based names sort chronologically

    while (dirs.length > maxBackups) {
      const oldest = dirs.shift()!;
      const oldPath = path.join(backupsRoot, oldest);
      fs.rmSync(oldPath, { recursive: true, force: true });
      pruned++;
    }
  }

  const parts = [`Backup created: ${formatBytes(size)}`];
  if (pruned > 0) parts.push(`pruned ${pruned} old backup(s)`);

  const message = parts.join(", ");
  log.info({ pruned, maxBackups }, message);

  return { message };
}
