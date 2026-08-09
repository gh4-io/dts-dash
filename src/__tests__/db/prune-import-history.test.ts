// @vitest-environment node
/**
 * Retention for `import_log`.
 *
 * The table is fed by a high-frequency API ingest (~70 runs/day in production),
 * so it grows without bound: 12,159 rows and 19% of the database inside six
 * months, every one of them status 'success'. `pruneImportHistory` deletes runs
 * past a configurable window.
 *
 * The subtle part is the foreign key. `work_packages.import_log_id` references
 * `import_log(id)` with the default NO ACTION, and the connection runs with
 * `foreign_keys = ON`, so deleting a referenced run raises a constraint error.
 * The prune clears those pointers first. If that step is ever dropped, the job
 * fails every night against real data — and never in a test that forgets to
 * reference a log row. Hence the explicit FK case below.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type Database from "better-sqlite3";

let sqlite: Database.Database;
let tmpDir: string;
let pruneImportHistory: (retentionDays: number) => {
  pruned: number;
  dereferenced: number;
  cutoff: string | null;
};

/** ISO timestamp `days` before now. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function insertLog(importedAt: string, status = "success"): number {
  const row = sqlite
    .prepare(
      `INSERT INTO import_log (imported_at, record_count, source, imported_by, status, data_type, format)
       VALUES (?, 1, 'api', 1, ?, 'work-packages', 'json') RETURNING id`,
    )
    .get(importedAt, status) as { id: number };
  return row.id;
}

function insertWorkPackage(guid: string, importLogId: number | null): void {
  sqlite
    .prepare(
      `INSERT INTO work_packages
         (guid, aircraft_reg, customer, arrival, departure, import_log_id, imported_at)
       VALUES (?, 'N123AB', 'ACME', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', ?, ?)`,
    )
    .run(guid, importLogId, new Date().toISOString());
}

function logCount(): number {
  return (sqlite.prepare("SELECT COUNT(*) AS n FROM import_log").get() as { n: number }).n;
}

beforeAll(async () => {
  // client.ts resolves DATABASE_PATH at module load, so point it at a throwaway
  // file before the dynamic import.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtsd-prune-import-history-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");

  const client = await import("@/lib/db/client");
  const init = await import("@/lib/db/schema-init");
  init.createTables();
  sqlite = client.sqlite;

  // The log rows reference a user; satisfy the FK once.
  sqlite
    .prepare(
      `INSERT INTO users
         (id, auth_id, email, display_name, password_hash, role,
          is_active, force_password_change, token_version, created_at, updated_at)
       VALUES (1, 'system', 'system@test', 'System', '', 'user',
               1, 0, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    )
    .run();

  ({ pruneImportHistory } = await import("@/lib/cron/tasks/prune-import-history"));
});

afterAll(() => {
  sqlite?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  sqlite.prepare("DELETE FROM work_packages").run();
  sqlite.prepare("DELETE FROM import_log").run();
});

describe("pruneImportHistory", () => {
  it("deletes runs older than the window and keeps the rest", () => {
    insertLog(daysAgo(40));
    insertLog(daysAgo(11));
    insertLog(daysAgo(9));
    insertLog(daysAgo(1));

    const result = pruneImportHistory(10);

    expect(result.pruned).toBe(2);
    expect(logCount()).toBe(2);
  });

  it("keeps a run sitting just inside the boundary", () => {
    insertLog(daysAgo(9.9));

    expect(pruneImportHistory(10).pruned).toBe(0);
    expect(logCount()).toBe(1);
  });

  it("prunes regardless of status — failures are not special-cased", () => {
    insertLog(daysAgo(30), "failed");
    insertLog(daysAgo(30), "partial");

    expect(pruneImportHistory(10).pruned).toBe(2);
    expect(logCount()).toBe(0);
  });

  it("does nothing when retention is 0, and reports no cutoff", () => {
    insertLog(daysAgo(400));

    const result = pruneImportHistory(0);

    expect(result.cutoff).toBeNull();
    expect(result.pruned).toBe(0);
    expect(logCount()).toBe(1);
  });

  it("is idempotent — a second run inside the window prunes nothing", () => {
    insertLog(daysAgo(40));
    insertLog(daysAgo(2));

    expect(pruneImportHistory(10).pruned).toBe(1);
    expect(pruneImportHistory(10).pruned).toBe(0);
    expect(logCount()).toBe(1);
  });

  it("clears work_packages.import_log_id instead of tripping the foreign key", () => {
    // Regression guard: with foreign_keys = ON this delete raises
    // "FOREIGN KEY constraint failed" unless the pointers are nulled first.
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);

    const oldLog = insertLog(daysAgo(40));
    const recentLog = insertLog(daysAgo(1));
    insertWorkPackage("wp-old", oldLog);
    insertWorkPackage("wp-recent", recentLog);

    const result = pruneImportHistory(10);

    expect(result.pruned).toBe(1);
    expect(result.dereferenced).toBe(1);

    // The work packages themselves must survive untouched.
    const wpCount = (
      sqlite.prepare("SELECT COUNT(*) AS n FROM work_packages").get() as { n: number }
    ).n;
    expect(wpCount).toBe(2);

    const rows = sqlite
      .prepare("SELECT guid, import_log_id FROM work_packages ORDER BY guid")
      .all() as { guid: string; import_log_id: number | null }[];
    expect(rows).toEqual([
      { guid: "wp-old", import_log_id: null },
      { guid: "wp-recent", import_log_id: recentLog },
    ]);

    // And the database is still referentially sound.
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });
});
