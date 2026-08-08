// @vitest-environment node
/**
 * Scheduler registration under the gate × runtime-state matrix (OI-105).
 *
 * Acceptance criteria exercised here:
 *   - nothing registers while the deployment gate is off;
 *   - a GUI pause stops execution in-process, without a restart and without
 *     touching server.config.yml;
 *   - resume re-registers enabled jobs with no duplicate schedules;
 *   - a config edit (restartCron) does not silently resume a paused scheduler;
 *   - `nextRunAt` is reported only for jobs that will genuinely fire.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  features: { cronEnabled: true, enableSeedEndpoint: false },
  runtime: { paused: false, changedAt: null as string | null, changedBy: null as string | null },
  scheduled: [] as string[],
  stopped: [] as string[],
  /** Callbacks node-cron would fire, keyed by the expression they were registered with */
  handlers: [] as (() => void)[],
}));

const backupHandler = vi.hoisted(() => vi.fn(async () => ({ message: "backed up" })));
const cleanupHandler = vi.hoisted(() => vi.fn(async () => ({ message: "cleaned up" })));

vi.mock("@/lib/cron/tasks/backup-database", () => ({ backupDatabase: backupHandler }));
vi.mock("@/lib/cron/tasks/cleanup-canceled", () => ({ cleanupCanceledWPs: cleanupHandler }));

vi.mock("@/lib/config/loader", () => ({
  getFeatures: () => state.features,
  getFlightSettings: () => ({ hideCanceled: false, cleanupGraceHours: 6 }),
  getCronJobOverrides: () => ({}),
}));

vi.mock("@/lib/logger", () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// The DB is irrelevant here — `getRunStates()` already tolerates an unavailable
// table, so a throwing stub keeps better-sqlite3 out of this test entirely.
vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => {
      throw new Error("no database in this test");
    },
  },
  sqlite: {},
  dbPath: "/tmp/does-not-exist.db",
}));

vi.mock("@/lib/cron/scheduler-state", () => ({
  SCHEDULER_STATE_KEY: "cronSchedulerState",
  getSchedulerRuntimeState: () => state.runtime,
  isSchedulerPaused: () => state.runtime.paused,
  setSchedulerRuntimeState: (paused: boolean, changedBy: string) => {
    state.runtime = { paused, changedAt: new Date().toISOString(), changedBy };
    return state.runtime;
  },
}));

vi.mock("node-cron", () => ({
  validate: () => true,
  schedule: (expression: string, handler: () => void) => {
    state.scheduled.push(expression);
    state.handlers.push(handler);
    return {
      stop: () => {
        state.stopped.push(expression);
      },
    };
  },
}));

import {
  getActiveJobKeys,
  getActiveTaskCount,
  getCronStatus,
  getSchedulerState,
  pauseScheduler,
  restartCron,
  resumeScheduler,
  startCron,
  stopCron,
} from "@/lib/cron/index";

beforeEach(() => {
  stopCron();
  state.features = { cronEnabled: true, enableSeedEndpoint: false };
  state.runtime = { paused: false, changedAt: null, changedBy: null };
  state.scheduled = [];
  state.stopped = [];
  state.handlers = [];
  backupHandler.mockClear();
  cleanupHandler.mockClear();
});

describe("startCron — deployment gate", () => {
  it("registers nothing while features.cronEnabled is off", () => {
    state.features.cronEnabled = false;
    startCron();

    expect(getActiveTaskCount()).toBe(0);
    expect(state.scheduled).toEqual([]);
  });

  it("registers the built-in jobs when the gate is on and the scheduler is running", () => {
    startCron();

    expect(getActiveJobKeys()).toEqual(["cleanup-canceled", "backup-database"]);
    expect(state.scheduled).toHaveLength(2);
  });
});

describe("startCron — runtime pause", () => {
  it("registers nothing while an administrator has paused the scheduler", () => {
    state.runtime.paused = true;
    startCron();

    expect(getActiveTaskCount()).toBe(0);
  });

  it("does not silently resume a paused scheduler when a config edit restarts it", () => {
    startCron();
    expect(getActiveTaskCount()).toBe(2);

    // Admin pauses, then edits a job — the edit calls restartCron()
    pauseScheduler("admin@example.com");
    restartCron();

    expect(getActiveTaskCount()).toBe(0);
  });
});

describe("pause / resume", () => {
  it("pausing stops execution in-process, with no restart and no config change", () => {
    startCron();
    const before = { ...state.features };

    const paused = pauseScheduler("admin@example.com");

    expect(paused.status).toBe("paused");
    expect(getActiveTaskCount()).toBe(0);
    expect(state.stopped).toHaveLength(2);
    // The deployment gate is untouched — pausing is never a config edit
    expect(state.features).toEqual(before);
  });

  it("records the acting user and a timestamp", () => {
    startCron();
    const paused = pauseScheduler("jason@gh4.io");

    expect(paused.changedBy).toBe("jason@gh4.io");
    expect(paused.changedAt).not.toBeNull();
  });

  it("resume re-registers enabled jobs without duplicate schedules", () => {
    startCron();
    pauseScheduler("admin@example.com");
    state.scheduled = [];

    resumeScheduler("admin@example.com");

    expect(getActiveJobKeys()).toEqual(["cleanup-canceled", "backup-database"]);
    expect(state.scheduled).toHaveLength(2);
  });

  it("resuming twice cannot double-register a job", () => {
    startCron();
    pauseScheduler("admin@example.com");
    state.scheduled = [];

    resumeScheduler("admin@example.com");
    resumeScheduler("admin@example.com");

    expect(getActiveTaskCount()).toBe(2);
    expect(state.scheduled).toHaveLength(2);
  });

  it("a repeated startCron() is a no-op while tasks are already registered", () => {
    startCron();
    startCron();
    startCron();

    expect(getActiveTaskCount()).toBe(2);
    expect(state.scheduled).toHaveLength(2);
  });
});

describe("a paused scheduler cannot quietly still be running", () => {
  it("skips execution at fire time, even if a task somehow survived the stop", async () => {
    startCron();
    const fire = state.handlers[0];

    // Pause without going through stopCron() — the case where the tasks live in
    // a different process from the one that handled the pause request.
    state.runtime.paused = true;
    fire();
    await Promise.resolve();

    expect(cleanupHandler).not.toHaveBeenCalled();
  });

  it("runs normally when not paused", async () => {
    startCron();
    state.handlers[0]();
    await Promise.resolve();

    expect(cleanupHandler).toHaveBeenCalledTimes(1);
  });
});

describe("getSchedulerState", () => {
  it("reports disabled-by-config regardless of the stored runtime switch", () => {
    state.features.cronEnabled = false;
    state.runtime.paused = false;

    expect(getSchedulerState().status).toBe("disabled-by-config");
    expect(getSchedulerState().gateEnabled).toBe(false);
  });

  it("reports the live task count so the UI never has to infer it", () => {
    startCron();
    expect(getSchedulerState().activeTaskCount).toBe(2);
    expect(getSchedulerState().status).toBe("running");
  });
});

describe("getCronStatus — next run reporting", () => {
  it("reports a next run only when the job will genuinely fire", () => {
    startCron();
    for (const job of getCronStatus()) {
      expect(job.scheduled).toBe(true);
      expect(job.nextRunAt).not.toBeNull();
    }
  });

  it("reports no next run while the deployment gate is off", () => {
    state.features.cronEnabled = false;
    for (const job of getCronStatus()) {
      expect(job.scheduled).toBe(false);
      expect(job.nextRunAt).toBeNull();
    }
  });

  it("reports no next run while the scheduler is paused", () => {
    state.runtime.paused = true;
    for (const job of getCronStatus()) {
      expect(job.scheduled).toBe(false);
      expect(job.nextRunAt).toBeNull();
    }
  });
});
