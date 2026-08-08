"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BackupHealth, SchedulerState } from "@/lib/cron/scheduler-status";

/*
 * Scheduler state panel for Admin → Cron Jobs.
 *
 * Three states, deliberately styled so they can never be mistaken for one
 * another (OI-105):
 *
 *   disabled-by-config — destructive/red, lock icon, "Read-only" badge. The
 *       deployment gate is off; nothing on this page can be changed or run and
 *       only a server administrator can reverse it.
 *   paused            — amber, pause icon, names the admin who paused it and
 *       when, with a Resume button right there. Reversible in the browser.
 *   running           — quiet emerald status line with a Pause button.
 *
 * Imports only the pure `scheduler-status` module — never `@/lib/cron` itself,
 * which pulls in node-cron and better-sqlite3 (D-047).
 */

interface CronSchedulerPanelProps {
  scheduler: SchedulerState;
  backup: BackupHealth;
  /**
   * How many jobs will actually fire. Derived from the job list rather than
   * the scheduler's in-process task count, which reports 0 under a dev server
   * that registers cron in a separate module instance.
   */
  scheduledJobCount: number;
  /** True while a pause/resume request is in flight */
  busy: boolean;
  onSetPaused: (paused: boolean) => void;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "unknown";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} minutes`;
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}

// ─── Backup Health ───────────────────────────────────────────────────────────

const BACKUP_TONE: Record<BackupHealth["severity"], string> = {
  ok: "border-border bg-card",
  warning: "border-amber-500/40 bg-amber-500/5",
  critical: "border-destructive/40 bg-destructive/5",
};

const BACKUP_ICON: Record<BackupHealth["severity"], string> = {
  ok: "fa-shield-halved text-emerald-500",
  warning: "fa-triangle-exclamation text-amber-500",
  critical: "fa-circle-exclamation text-destructive",
};

function BackupHealthCard({ backup }: { backup: BackupHealth }) {
  return (
    <div className={`rounded-lg border p-4 ${BACKUP_TONE[backup.severity]}`}>
      <div className="flex items-start gap-3">
        <i className={`fa-solid ${BACKUP_ICON[backup.severity]} mt-0.5`} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">Database Backups</p>
          <p className="text-xs text-muted-foreground">{backup.reason}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Last successful</dt>
              <dd className="font-medium">
                {backup.lastBackupAt ? formatTimestamp(backup.lastBackupAt) : "Never"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Snapshots retained</dt>
              <dd className="font-medium">
                {backup.backupCount} of {backup.retention}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expected interval</dt>
              <dd className="font-medium">{formatDuration(backup.expectedIntervalMs)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function CronSchedulerPanel({
  scheduler,
  backup,
  scheduledJobCount,
  busy,
  onSetPaused,
}: CronSchedulerPanelProps) {
  const { status, changedAt, changedBy } = scheduler;

  return (
    <div className="space-y-3">
      {status === "disabled-by-config" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <i className="fa-solid fa-lock mt-0.5 text-destructive" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-destructive">
                  Cron scheduler disabled by server configuration
                </p>
                <Badge variant="outline" className="border-destructive/50 text-destructive">
                  Read-only
                </Badge>
              </div>
              <p className="text-xs text-destructive/90">
                No cron job is registered and nothing below will run — including the database
                backup. Schedules, options, enable/disable and Run Now are locked, and the server
                refuses these requests even if they are issued directly.
              </p>
              <p className="text-xs text-muted-foreground">
                This is <strong>not</strong> an administrator pause and cannot be undone from this
                page. A server administrator must set{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">features.cronEnabled</code>{" "}
                to <code className="rounded bg-muted px-1 py-0.5 font-mono">true</code> in{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">server.config.yml</code>{" "}
                and restart the application.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "paused" && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-start gap-3">
            <i className="fa-solid fa-circle-pause mt-0.5 text-amber-500" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-amber-500">
                Scheduler paused by an administrator
              </p>
              <p className="text-xs text-muted-foreground">
                Scheduled runs are suspended, but job configuration stays editable and Run Now still
                works. Paused by <strong>{changedBy ?? "an administrator"}</strong> on{" "}
                {formatTimestamp(changedAt)}. Resuming takes effect immediately — no restart, and
                the server configuration is untouched.
              </p>
            </div>
            <Button size="sm" disabled={busy} onClick={() => onSetPaused(false)}>
              {busy ? (
                <i className="fa-solid fa-spinner fa-spin mr-2" />
              ) : (
                <i className="fa-solid fa-play mr-2" />
              )}
              Resume Scheduler
            </Button>
          </div>
        </div>
      )}

      {status === "running" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Scheduler running
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {scheduledJobCount} job{scheduledJobCount === 1 ? "" : "s"} scheduled
              </span>
            </p>
            {changedAt && (
              <p className="text-xs text-muted-foreground">
                Resumed by {changedBy ?? "an administrator"} on {formatTimestamp(changedAt)}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onSetPaused(true)}>
            {busy ? (
              <i className="fa-solid fa-spinner fa-spin mr-2" />
            ) : (
              <i className="fa-solid fa-pause mr-2" />
            )}
            Pause Scheduler
          </Button>
        </div>
      )}

      <BackupHealthCard backup={backup} />
    </div>
  );
}
