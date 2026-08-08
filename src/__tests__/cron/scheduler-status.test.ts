/**
 * OI-105 — the gate × runtime-state matrix, and backup freshness.
 *
 * The defect this guards: with `features.cronEnabled` off, the Cron Jobs page
 * rendered fully live. Schedules were editable, jobs could be toggled and
 * Run Now was clickable — all silently no-ops, because `startCron()` had
 * returned before registering anything. The built-in database backup was one
 * of those jobs, so an administrator could believe the database was being
 * backed up nightly while nothing had ever run.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateBackupHealth,
  isJobScheduled,
  isSchedulerMutable,
  resolveSchedulerStatus,
} from "@/lib/cron/scheduler-status";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-08-07T12:00:00.000Z");

describe("resolveSchedulerStatus — gate × runtime state", () => {
  it("reports disabled-by-config when the deployment gate is off, whatever the runtime switch says", () => {
    expect(resolveSchedulerStatus(false, false)).toBe("disabled-by-config");
    expect(resolveSchedulerStatus(false, true)).toBe("disabled-by-config");
  });

  it("distinguishes an administrator pause from the deployment gate", () => {
    expect(resolveSchedulerStatus(true, true)).toBe("paused");
    expect(resolveSchedulerStatus(true, false)).toBe("running");
  });
});

describe("isSchedulerMutable — what locks the controls", () => {
  it("locks every control when the deployment gate is off", () => {
    expect(isSchedulerMutable(false)).toBe(false);
  });

  it("leaves job configuration editable while merely paused — pausing suspends the schedule, not editing", () => {
    expect(isSchedulerMutable(true)).toBe(true);
  });
});

describe("isJobScheduled — a job only counts as scheduled if it will actually fire", () => {
  it.each([
    ["disabled-by-config", true, false],
    ["disabled-by-config", false, false],
    ["paused", true, false],
    ["paused", false, false],
    ["running", false, false],
    ["running", true, true],
  ] as const)("status=%s enabled=%s → scheduled=%s", (status, enabled, expected) => {
    expect(isJobScheduled(status, enabled)).toBe(expected);
  });
});

describe("evaluateBackupHealth", () => {
  const base = {
    backupCount: 3,
    retention: 7,
    expectedIntervalMs: DAY,
    scheduled: true,
    now: NOW,
  };

  it("is critical when no backup has ever completed", () => {
    const health = evaluateBackupHealth({ ...base, lastBackupAt: null, backupCount: 0 });
    expect(health.severity).toBe("critical");
    expect(health.stale).toBe(true);
    expect(health.ageMs).toBeNull();
  });

  it("is ok for a backup inside the expected interval", () => {
    const health = evaluateBackupHealth({
      ...base,
      lastBackupAt: new Date(NOW - 6 * HOUR).toISOString(),
    });
    expect(health.severity).toBe("ok");
    expect(health.stale).toBe(false);
  });

  it("tolerates one missed run but flags two as failing backups", () => {
    const oneMissed = evaluateBackupHealth({
      ...base,
      lastBackupAt: new Date(NOW - 1.5 * DAY).toISOString(),
    });
    expect(oneMissed.stale).toBe(false);

    const twoMissed = evaluateBackupHealth({
      ...base,
      lastBackupAt: new Date(NOW - 3 * DAY).toISOString(),
    });
    expect(twoMissed.severity).toBe("critical");
    expect(twoMissed.stale).toBe(true);
  });

  it("warns when backups are current but nothing is scheduled to take the next one", () => {
    const health = evaluateBackupHealth({
      ...base,
      lastBackupAt: new Date(NOW - HOUR).toISOString(),
      scheduled: false,
    });
    expect(health.severity).toBe("warning");
    expect(health.reason).toMatch(/not scheduled/i);
  });

  it("carries the configured retention through so the UI never has to guess", () => {
    const health = evaluateBackupHealth({
      ...base,
      retention: 14,
      lastBackupAt: new Date(NOW - HOUR).toISOString(),
    });
    expect(health.retention).toBe(14);
    expect(health.backupCount).toBe(3);
  });
});
