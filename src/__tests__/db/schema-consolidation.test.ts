// @vitest-environment node
/**
 * Guard for the v1.0.0 migration-ladder collapse.
 *
 * Through v0.3.0 the schema arrived in two parts: `createTables()` declared most
 * of it, and `runMigrations()` added the rest incrementally (M022–M026). v1.0.0
 * deletes that ladder — `createTables()` is now the single canonical declaration
 * and `runMigrations()` returns an empty array.
 *
 * That collapse is only safe while every effect the deleted migrations used to
 * apply is present in `createTables()`. If someone removes one, fresh installs
 * silently come up with a column missing and the failure surfaces far from the
 * cause. These tests are the tripwire.
 *
 * Two of these were genuinely absent when the ladder was collapsed and had to be
 * folded in: the entire `notifications` table (it lived only in M024, the sole
 * one of 39 tables missing from `createTables()`) and `idx_rp_group` (M026
 * created the columns in `createTables()` but the index only in the migration).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type Database from "better-sqlite3";

let sqlite: Database.Database;
let tmpDir: string;

/** Column names on a table, as SQLite reports them. */
function columnsOf(table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

function objectExists(type: "table" | "index", name: string): boolean {
  const row = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = ? AND name = ?`)
    .get(type, name);
  return row !== undefined;
}

beforeAll(async () => {
  // Point the DB singleton at a throwaway file *before* importing it — client.ts
  // resolves DATABASE_PATH at module load, so the import must be dynamic.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtsd-schema-consolidation-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");

  const client = await import("@/lib/db/client");
  const init = await import("@/lib/db/schema-init");

  init.createTables();
  sqlite = client.sqlite;
});

afterAll(() => {
  sqlite?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("createTables() is the complete v1.0.0 schema", () => {
  it("declares every effect the deleted migrations used to apply", () => {
    // M022 — staffing shift versioning (OI-080)
    expect(columnsOf("staffing_shifts")).toContain("rotation_end_date");

    // M023 — flight comments + ground event markers (OI-092, OI-093)
    expect(objectExists("table", "flight_comments")).toBe(true);
    expect(columnsOf("work_packages")).toContain("ground_event_types");

    // M024 — notifications (OI-094). This table was missing from createTables()
    // entirely and existed only in the migration.
    expect(objectExists("table", "notifications")).toBe(true);
    expect(columnsOf("notifications")).toEqual(
      expect.arrayContaining([
        "user_id",
        "type",
        "category",
        "title",
        "message",
        "metadata",
        "read_at",
        "action_url",
        "expires_at",
        "created_at",
      ]),
    );

    // M025 — pattern anchor split from effective date (OI-102)
    expect(columnsOf("staffing_shifts")).toContain("pattern_anchor_date");

    // M026 — rotation pattern versioning (OI-101)
    expect(columnsOf("rotation_patterns")).toEqual(
      expect.arrayContaining(["group_id", "effective_from", "effective_to"]),
    );
  });

  it("creates the indexes the migrations created, not just the columns", () => {
    // idx_rp_group was the one M026 flagged in its own comment as reachable only
    // through the migration, because createTables() runs before runMigrations().
    expect(objectExists("index", "idx_rp_group")).toBe(true);
    expect(objectExists("index", "idx_notifications_user")).toBe(true);
    expect(objectExists("index", "idx_notifications_user_unread")).toBe(true);
    expect(objectExists("index", "idx_notifications_created")).toBe(true);
  });

  it("leaves runMigrations() with nothing to do on a fresh database", async () => {
    const { runMigrations } = await import("@/lib/db/schema-init");
    expect(runMigrations()).toEqual([]);
  });

  it("is idempotent — running it twice changes nothing", async () => {
    const before = sqlite
      .prepare(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'`)
      .all();

    const { createTables } = await import("@/lib/db/schema-init");
    createTables();

    const after = sqlite
      .prepare(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'`)
      .all();

    expect(after).toEqual(before);
  });
});
