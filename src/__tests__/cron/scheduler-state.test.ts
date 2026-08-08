// @vitest-environment node
/**
 * Persistence of the runtime Running/Paused switch (OI-105).
 *
 * The switch lives in the existing `app_config` key/value table — no new table
 * and nothing declared outside `createTables()`, so `runMigrations()` stays
 * empty. These tests pin that storage choice and the fail-safe defaults: an
 * absent or corrupt row must read as *running*, never as silently paused.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;
let mod: typeof import("@/lib/cron/scheduler-state");
let sqlite: import("better-sqlite3").Database;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-scheduler-state-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "dashboard.db");

  const client = await import("@/lib/db/client");
  sqlite = client.sqlite;
  const { createTables } = await import("@/lib/db/schema-init");
  createTables();

  mod = await import("@/lib/cron/scheduler-state");
});

afterAll(() => {
  try {
    sqlite.close();
  } catch {
    // already closed
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATABASE_PATH;
});

describe("scheduler runtime state", () => {
  it("defaults to running when no row exists", () => {
    expect(mod.getSchedulerRuntimeState()).toEqual({
      paused: false,
      changedAt: null,
      changedBy: null,
    });
    expect(mod.isSchedulerPaused()).toBe(false);
  });

  it("persists a pause with the acting user and a timestamp", () => {
    const written = mod.setSchedulerRuntimeState(true, "jason@gh4.io");

    expect(written.paused).toBe(true);
    expect(written.changedBy).toBe("jason@gh4.io");
    expect(written.changedAt).not.toBeNull();

    const read = mod.getSchedulerRuntimeState();
    expect(read).toEqual(written);
    expect(mod.isSchedulerPaused()).toBe(true);
  });

  it("stores exactly one app_config row, not a new table", () => {
    mod.setSchedulerRuntimeState(false, "admin@example.com");

    const rows = sqlite
      .prepare("SELECT key, value FROM app_config WHERE key = ?")
      .all(mod.SCHEDULER_STATE_KEY) as { key: string; value: string }[];

    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].value).paused).toBe(false);
  });

  it("updates the existing row rather than inserting a second one", () => {
    mod.setSchedulerRuntimeState(true, "a@example.com");
    mod.setSchedulerRuntimeState(false, "b@example.com");

    const count = sqlite
      .prepare("SELECT COUNT(*) AS n FROM app_config WHERE key = ?")
      .get(mod.SCHEDULER_STATE_KEY) as { n: number };

    expect(count.n).toBe(1);
    expect(mod.getSchedulerRuntimeState().changedBy).toBe("b@example.com");
  });

  it("treats a corrupt row as running rather than leaving the scheduler stopped", () => {
    sqlite
      .prepare("UPDATE app_config SET value = ? WHERE key = ?")
      .run("{not json", mod.SCHEDULER_STATE_KEY);

    expect(mod.getSchedulerRuntimeState().paused).toBe(false);
  });
});
