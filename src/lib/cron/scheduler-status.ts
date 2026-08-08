/**
 * Scheduler status vocabulary — pure, client-safe (no DB, no node-cron).
 *
 * Two independent things can stop the scheduler and they are NOT the same:
 *
 *   1. `features.cronEnabled` in server.config.yml — the deployment-level hard
 *      gate. Never writable from the web app. When it is off the scheduler was
 *      never registered, nothing can be edited or executed, and only someone
 *      with server access can change it (config edit + restart).
 *   2. The DB-backed runtime switch — an administrator pausing the scheduler
 *      from the admin UI. Reversible in the browser, no restart, and job
 *      configuration stays editable.
 *
 * The UI has to make that distinction obvious: an admin who sees "paused" and
 * an admin who sees "disabled by server configuration" have completely
 * different next actions.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SchedulerStatus = "disabled-by-config" | "paused" | "running";

/** The DB-backed half of the state (who paused it, and when) */
export interface SchedulerRuntimeState {
  paused: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

/** Deployment gate + runtime switch, resolved into one shape for the UI */
export interface SchedulerState extends SchedulerRuntimeState {
  /** features.cronEnabled from server.config.yml */
  gateEnabled: boolean;
  status: SchedulerStatus;
  /** Number of cron tasks currently registered in this process */
  activeTaskCount: number;
}

// ─── Resolution ──────────────────────────────────────────────────────────────

/** The gate wins: a paused flag is meaningless while the deployment gate is off. */
export function resolveSchedulerStatus(gateEnabled: boolean, paused: boolean): SchedulerStatus {
  if (!gateEnabled) return "disabled-by-config";
  return paused ? "paused" : "running";
}

/**
 * Whether cron configuration may be changed or executed at all.
 * Pausing only suspends the schedule — it deliberately leaves job config
 * editable — so only the deployment gate locks the controls.
 */
export function isSchedulerMutable(gateEnabled: boolean): boolean {
  return gateEnabled;
}

/** Whether a given job is actually registered and will fire on its schedule. */
export function isJobScheduled(status: SchedulerStatus, jobEnabled: boolean): boolean {
  return status === "running" && jobEnabled;
}

/** Refusal message used by both the API and the UI, so they never disagree. */
export const SCHEDULER_DISABLED_ERROR =
  "The cron scheduler is disabled by server configuration (features.cronEnabled). " +
  "No job can be changed or executed until a server administrator enables it and restarts the app.";

// ─── Backup Freshness ────────────────────────────────────────────────────────

export type BackupSeverity = "ok" | "warning" | "critical";

export interface BackupHealthInput {
  /** ISO timestamp of the most recent backup that actually exists on disk */
  lastBackupAt: string | null;
  /** How many backup snapshots are currently retained */
  backupCount: number;
  /** Configured retention (the backup job's maxBackups option) */
  retention: number;
  /** Expected gap between runs, derived from the job's cron schedule */
  expectedIntervalMs: number | null;
  /** Whether the backup job is currently registered and will fire */
  scheduled: boolean;
  now: number;
}

export interface BackupHealth {
  lastBackupAt: string | null;
  backupCount: number;
  retention: number;
  expectedIntervalMs: number | null;
  ageMs: number | null;
  severity: BackupSeverity;
  /** True when no successful backup exists within the expected interval */
  stale: boolean;
  reason: string;
}

/**
 * Judge whether backups are actually happening.
 *
 * This is the reason OI-105 exists: with the scheduler gated off the admin UI
 * still showed a happy, editable backup job, so an administrator could believe
 * the database was being backed up nightly when nothing had ever run.
 *
 * A backup is considered overdue once it is older than twice its schedule
 * interval — one missed run is tolerated (a restart or a long-running job),
 * two is a real failure.
 */
export function evaluateBackupHealth(input: BackupHealthInput): BackupHealth {
  const { lastBackupAt, backupCount, retention, expectedIntervalMs, scheduled, now } = input;

  const ageMs = lastBackupAt ? now - new Date(lastBackupAt).getTime() : null;
  const overdue = ageMs !== null && expectedIntervalMs !== null && ageMs > expectedIntervalMs * 2;

  const base = {
    lastBackupAt,
    backupCount,
    retention,
    expectedIntervalMs,
    ageMs,
  };

  if (lastBackupAt === null) {
    return {
      ...base,
      severity: "critical",
      stale: true,
      reason: scheduled
        ? "No database backup has ever completed. The job is scheduled but has not produced a snapshot yet."
        : "No database backup has ever completed, and the backup job is not scheduled to run.",
    };
  }

  if (overdue) {
    return {
      ...base,
      severity: "critical",
      stale: true,
      reason: scheduled
        ? "The most recent database backup is older than two scheduled intervals — backups are failing."
        : "The most recent database backup is stale and the backup job is not scheduled to run.",
    };
  }

  if (!scheduled) {
    return {
      ...base,
      severity: "warning",
      stale: false,
      reason:
        "Backups are up to date, but the backup job is not scheduled — no further backups will be taken.",
    };
  }

  return {
    ...base,
    severity: "ok",
    stale: false,
    reason: "Backups are up to date.",
  };
}
