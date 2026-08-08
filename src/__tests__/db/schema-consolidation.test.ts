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
 *
 * Updated for OI-099: `notifications` and `flight_comments` no longer exist as
 * tables. What M023 and M024 used to provide now has to be provided by `messages`
 * instead, so the assertions moved rather than being deleted — the effect those
 * migrations delivered still has to be reachable on a fresh install.
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

    // M023 — flight comments + ground event markers (OI-092, OI-093).
    // flight_comments is now messages(kind = 'flight_comment') — OI-099.
    expect(objectExists("table", "messages")).toBe(true);
    expect(columnsOf("work_packages")).toContain("ground_event_types");

    // M024 — notifications (OI-094). This table was missing from createTables()
    // entirely and existed only in the migration; since OI-099 its columns live
    // on `messages`, so the same delivery still has to be there.
    expect(columnsOf("messages")).toEqual(
      expect.arrayContaining([
        "kind",
        "recipient_id",
        "msg_type",
        "category",
        "title",
        "body",
        "metadata",
        "read_at",
        "action_url",
        "expires_at",
        "created_at",
        "updated_at",
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

    // The notification indexes are now partial and per-kind (OI-099). These are
    // what keep the merge performance-neutral; without them every notification
    // lookup scans comment and feedback rows too.
    expect(objectExists("index", "idx_messages_notif_unread")).toBe(true);
    expect(objectExists("index", "idx_messages_notif_created")).toBe(true);
    expect(objectExists("index", "idx_messages_legacy")).toBe(true);
  });

  describe("OI-099 — the unified messaging schema", () => {
    it("declares messages, labels and message_labels", () => {
      expect(objectExists("table", "messages")).toBe(true);
      expect(objectExists("table", "labels")).toBe(true);
      expect(objectExists("table", "message_labels")).toBe(true);
    });

    it("does NOT declare the six legacy tables — fresh installs must not have them", () => {
      // Their absence here is what makes them unreachable on a new install; their
      // absence from schema.ts is what turns a stale reference into a compile
      // error. Existing databases keep theirs read-only until v1.1.0.
      for (const t of [
        "flight_comments",
        "notifications",
        "feedback_posts",
        "feedback_comments",
        "feedback_labels",
        "feedback_post_labels",
      ]) {
        expect(objectExists("table", t)).toBe(false);
      }
    });

    it("keeps labels out of messages, with name NOT NULL UNIQUE intact", () => {
      // One of the three reasons labels were not folded in: inside `messages` this
      // constraint would degrade from a declaration into a convention.
      const ddl = sqlite
        .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'labels'`)
        .get() as { sql: string };

      expect(ddl.sql).toMatch(/name TEXT NOT NULL UNIQUE/);
      expect(columnsOf("messages")).not.toContain("name");
    });

    it("states the per-kind invariants as CHECK constraints", () => {
      const ddl = sqlite
        .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'`)
        .get() as { sql: string };

      // A notification must have a recipient; anything else must have an author
      // and a body; flight comments need their subject; feedback comments a root.
      expect(ddl.sql).toContain("CHECK (kind <> 'notification' OR recipient_id IS NOT NULL)");
      expect(ddl.sql).toContain(
        "CHECK (kind = 'notification' OR (author_id IS NOT NULL AND body IS NOT NULL))",
      );
      expect(ddl.sql).toContain("subject_type = 'work_package'");
      expect(ddl.sql).toContain("CHECK (kind <> 'feedback_comment' OR root_id IS NOT NULL)");
    });

    it("cascades recipient_id but NOT author_id", () => {
      // ⚠️ The single most destructive change anyone could make to this schema is
      // adding ON DELETE CASCADE to author_id: it would erase every comment and
      // post a user ever wrote, the first time an account is deleted, silently.
      const ddl = sqlite
        .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'`)
        .get() as { sql: string };

      const authorLine = ddl.sql
        .split("\n")
        .find((l) => l.includes("author_id INTEGER REFERENCES users(id)"));
      expect(authorLine).toBeDefined();
      expect(authorLine!.toUpperCase()).not.toContain("CASCADE");

      const recipientLine = ddl.sql.split("\n").find((l) => l.includes("recipient_id INTEGER"));
      expect(recipientLine!.toUpperCase()).toContain("ON DELETE CASCADE");
    });

    it("indexes the unread-count query as a PARTIAL index on kind = notification", () => {
      const ddl = sqlite
        .prepare(`SELECT sql FROM sqlite_master WHERE name = 'idx_messages_notif_unread'`)
        .get() as { sql: string };

      expect(ddl.sql).toContain("messages(recipient_id, read_at)");
      expect(ddl.sql).toContain("WHERE kind = 'notification'");
    });

    it("uses the partial index for the polled unread-count query", () => {
      // /api/notifications/unread-count is polled on an interval by the
      // notification bell for every logged-in client. If this stops using the
      // index the whole merge stops being performance-neutral.
      const plan = sqlite
        .prepare(
          `EXPLAIN QUERY PLAN
           SELECT count(*) FROM messages
           WHERE kind = 'notification' AND recipient_id = 1 AND read_at IS NULL
             AND (expires_at IS NULL OR expires_at > '2026-01-01')`,
        )
        .all() as { detail: string }[];

      const detail = plan.map((r) => r.detail).join(" | ");
      expect(detail).toContain("idx_messages_notif_unread");
      expect(detail).not.toContain("SCAN messages");
    });

    it("makes (legacy_source, legacy_id) unique — the backfill idempotency key", () => {
      const ddl = sqlite
        .prepare(`SELECT sql FROM sqlite_master WHERE name = 'idx_messages_legacy'`)
        .get() as { sql: string };

      expect(ddl.sql).toContain("UNIQUE");
      expect(ddl.sql).toContain("legacy_source, legacy_id");
    });
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
