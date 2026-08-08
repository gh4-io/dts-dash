/**
 * Backup freshness for the admin UI (server-only).
 *
 * The snapshots on disk are the ground truth, not `cron_job_runs` — that table
 * only keeps the *last* run, so one failure erases the record of the last
 * success. `data/backups/<ISO timestamp>/` directories are what an operator
 * would actually restore from, so they are what we report.
 */

import fs from "fs";
import path from "path";
import { getEffectiveJobs, getSchedulerState } from "./index";
import { evaluateBackupHealth, isJobScheduled, type BackupHealth } from "./scheduler-status";
import { cronIntervalMs } from "@/lib/utils/cron-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("cron:backup-health");

/** Key of the built-in database backup job */
export const BACKUP_JOB_KEY = "backup-database";

/** Directory names are `2026-08-07T03-00-00` — reverse the substitutions to get an ISO instant. */
function dirNameToIso(name: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})$/.exec(name);
  if (!match) return null;
  const [, date, hh, mm, ss] = match;
  return `${date}T${hh}:${mm}:${ss}.000Z`;
}

/** Scan data/backups for completed snapshots, newest first. */
function readBackupSnapshots(): string[] {
  const backupsRoot = path.join(process.cwd(), "data", "backups");
  if (!fs.existsSync(backupsRoot)) return [];

  try {
    return fs
      .readdirSync(backupsRoot)
      .filter((name) => {
        if (dirNameToIso(name) === null) return false;
        // A directory without dashboard.db is a partial/failed backup
        return fs.existsSync(path.join(backupsRoot, name, "dashboard.db"));
      })
      .sort()
      .reverse();
  } catch (err) {
    log.warn({ err }, "Could not read data/backups");
    return [];
  }
}

/**
 * Report on the database backup job: when it last succeeded, how many
 * snapshots are retained, and whether it is overdue.
 */
export function getBackupHealth(now: number = Date.now()): BackupHealth {
  const job = getEffectiveJobs().find((j) => j.key === BACKUP_JOB_KEY);
  const { status } = getSchedulerState();

  const snapshots = readBackupSnapshots();
  const lastBackupAt = snapshots.length > 0 ? dirNameToIso(snapshots[0]) : null;

  const retention = typeof job?.options.maxBackups === "number" ? job.options.maxBackups : 0;

  return evaluateBackupHealth({
    lastBackupAt,
    backupCount: snapshots.length,
    retention,
    expectedIntervalMs: job ? cronIntervalMs(job.schedule) : null,
    scheduled: job ? isJobScheduled(status, job.enabled) : false,
    now,
  });
}
