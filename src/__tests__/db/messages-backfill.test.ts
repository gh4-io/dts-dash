// @vitest-environment node
/**
 * Tests for the OI-099 messages backfill.
 *
 * These run against a real temp SQLite file with the legacy tables recreated by
 * hand — they cannot come from `createTables()`, which no longer declares them.
 * That is the point of the exercise: the backfill has to work on a database shape
 * that the current schema can no longer produce.
 *
 * The cases that matter most are the ones where a wrong implementation produces
 * no error at all:
 *
 *   - ID collision across sources. All four legacy tables used independent
 *     AUTOINCREMENT sequences, so id 3 means four different rows. A generic
 *     self-join would build wrong trees and violate no constraint.
 *   - Notification metadata.commentId, which holds a flight_comments.id and
 *     silently points at an unrelated row after remapping.
 *   - Reconciliation, because an empty table is indistinguishable from a
 *     successful migration.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { backfillMessages, assertMessagesReconciled } from "@/lib/db/backfill/messages-backfill";

let db: Database.Database;
let tmpDir: string;

/** The v1.0.0 target schema, copied from createTables(). */
const NEW_SCHEMA = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL
  );

  CREATE TABLE work_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aircraft_reg TEXT NOT NULL
  );

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL
      CHECK (kind IN ('flight_comment', 'notification', 'feedback_post', 'feedback_comment')),
    parent_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    root_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    subject_type TEXT,
    subject_id INTEGER,
    author_id INTEGER REFERENCES users(id),
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    body TEXT,
    msg_type TEXT,
    category TEXT,
    read_at TEXT,
    action_url TEXT,
    expires_at TEXT,
    status TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    legacy_source TEXT,
    legacy_id INTEGER,
    legacy_parent_id INTEGER,
    CHECK (kind <> 'notification' OR recipient_id IS NOT NULL),
    CHECK (kind = 'notification' OR (author_id IS NOT NULL AND body IS NOT NULL)),
    CHECK (kind <> 'flight_comment'
           OR (subject_type = 'work_package' AND subject_id IS NOT NULL)),
    CHECK (kind <> 'feedback_comment' OR root_id IS NOT NULL)
  );

  CREATE UNIQUE INDEX idx_messages_legacy
    ON messages(legacy_source, legacy_id) WHERE legacy_source IS NOT NULL;

  CREATE TABLE labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    legacy_source TEXT,
    legacy_id INTEGER
  );

  CREATE TABLE message_labels (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, label_id)
  );
`;

/** The pre-v1.0.0 messaging tables, which createTables() no longer declares. */
const LEGACY_SCHEMA = `
  CREATE TABLE flight_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_package_id INTEGER NOT NULL,
    parent_id INTEGER,
    author_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    category TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    message TEXT,
    metadata TEXT,
    read_at TEXT,
    action_url TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE feedback_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE feedback_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    parent_id INTEGER,
    author_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE feedback_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE feedback_post_labels (
    post_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, label_id)
  );
`;

const T = "2026-01-01T00:00:00.000Z";

function openDb(): Database.Database {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtsd-messages-backfill-"));
  const handle = new Database(path.join(tmpDir, "test.db"));
  handle.pragma("foreign_keys = ON");
  handle.exec(NEW_SCHEMA);
  return handle;
}

function seedUsersAndWps(): void {
  db.exec(`
    INSERT INTO users (id, display_name) VALUES (1, 'Alice'), (2, 'Bob');
    INSERT INTO work_packages (id, aircraft_reg) VALUES (10, 'C-FOIJ'), (11, 'N123AB');
  `);
}

beforeEach(() => {
  db = openDb();
});

afterEach(() => {
  db?.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("backfillMessages — fresh database", () => {
  it("is a no-op when no legacy table exists, and does not throw", () => {
    seedUsersAndWps();

    const result = backfillMessages({ db });

    // This is the common case for every new deployment: the legacy tables were
    // never created, so there is nothing to move and nothing to complain about.
    expect(result.ran).toBe(false);
    expect(result.inserted).toBe(0);
    expect(result.balanced).toBe(true);
    expect(() => assertMessagesReconciled(result)).not.toThrow();
  });
});

describe("backfillMessages — ID collision across sources", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);

    // Every legacy table gets a row with id 1 AND id 2. All four sequences are
    // independent, so these are eight completely unrelated rows that a naive
    // "join on matching legacy id" would confuse for each other.
    db.exec(`
      INSERT INTO flight_comments (id, work_package_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 10, NULL, 1, 'fc one', '${T}', '${T}'),
             (2, 11, NULL, 2, 'fc two', '${T}', '${T}');

      INSERT INTO notifications (id, user_id, type, category, title, message, created_at)
      VALUES (1, 1, 'system', 'general', 'notif one', 'n1', '${T}'),
             (2, 2, 'comment', 'flight', 'notif two', 'n2', '${T}');

      INSERT INTO feedback_posts (id, author_id, title, body, status, is_pinned, created_at, updated_at)
      VALUES (1, 1, 'post one', 'p1', 'open', 0, '${T}', '${T}'),
             (2, 2, 'post two', 'p2', 'done', 1, '${T}', '${T}');

      INSERT INTO feedback_comments (id, post_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 1, NULL, 2, 'fbc one', '${T}', '${T}'),
             (2, 2, NULL, 1, 'fbc two', '${T}', '${T}');
    `);
  });

  it("keeps every source's rows distinct and correctly typed", () => {
    const result = backfillMessages({ db });

    expect(result.ran).toBe(true);
    expect(result.balanced).toBe(true);
    expect(result.inserted).toBe(8);

    const byKind = db
      .prepare(`SELECT kind, COUNT(*) AS n FROM messages GROUP BY kind ORDER BY kind`)
      .all() as { kind: string; n: number }[];

    expect(byKind).toEqual([
      { kind: "feedback_comment", n: 2 },
      { kind: "feedback_post", n: 2 },
      { kind: "flight_comment", n: 2 },
      { kind: "notification", n: 2 },
    ]);
  });

  it("gives colliding legacy ids different new ids, and preserves provenance", () => {
    backfillMessages({ db });

    const legacyId1 = db
      .prepare(`SELECT legacy_source, id FROM messages WHERE legacy_id = 1 ORDER BY legacy_source`)
      .all() as { legacy_source: string; id: number }[];

    expect(legacyId1).toHaveLength(4);
    // Four rows shared legacy id 1; they must now hold four distinct new ids.
    expect(new Set(legacyId1.map((r) => r.id)).size).toBe(4);
  });

  it("routes each legacy column to the right new column", () => {
    backfillMessages({ db });

    const fc = db
      .prepare(`SELECT * FROM messages WHERE legacy_source = 'flight_comments' AND legacy_id = 1`)
      .get() as Record<string, unknown>;

    expect(fc.kind).toBe("flight_comment");
    expect(fc.subject_type).toBe("work_package");
    expect(fc.subject_id).toBe(10);
    expect(fc.author_id).toBe(1);
    expect(fc.body).toBe("fc one");
    expect(fc.recipient_id).toBeNull();

    const notif = db
      .prepare(`SELECT * FROM messages WHERE legacy_source = 'notifications' AND legacy_id = 2`)
      .get() as Record<string, unknown>;

    // The notification taxonomy moved to msg_type; `message` became `body`; the
    // user became the recipient, not the author.
    expect(notif.kind).toBe("notification");
    expect(notif.recipient_id).toBe(2);
    expect(notif.author_id).toBeNull();
    expect(notif.msg_type).toBe("comment");
    expect(notif.category).toBe("flight");
    expect(notif.title).toBe("notif two");
    expect(notif.body).toBe("n2");

    const post = db
      .prepare(`SELECT * FROM messages WHERE legacy_source = 'feedback_posts' AND legacy_id = 2`)
      .get() as Record<string, unknown>;

    expect(post.kind).toBe("feedback_post");
    expect(post.status).toBe("done");
    expect(post.is_pinned).toBe(1);
    // A post is its own thread root.
    expect(post.root_id).toBe(post.id);
  });
});

describe("backfillMessages — idempotency", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);
    db.exec(`
      INSERT INTO feedback_posts (id, author_id, title, body, status, is_pinned, created_at, updated_at)
      VALUES (1, 1, 'post', 'body', 'open', 0, '${T}', '${T}');
      INSERT INTO feedback_comments (id, post_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 1, NULL, 2, 'c1', '${T}', '${T}'),
             (2, 1, 1, 1, 'c2', '${T}', '${T}');
      INSERT INTO notifications (id, user_id, title, created_at)
      VALUES (1, 1, 'n', '${T}');
    `);
  });

  it("inserts nothing on a second run and reports everything already present", () => {
    const first = backfillMessages({ db });
    expect(first.inserted).toBe(4);

    const before = db.prepare(`SELECT * FROM messages ORDER BY id`).all();

    const second = backfillMessages({ db });

    expect(second.ran).toBe(true);
    expect(second.inserted).toBe(0);
    expect(second.alreadyPresent).toBe(4);
    expect(second.balanced).toBe(true);

    // Byte-for-byte identical: a re-run must not perturb ids, parents or roots.
    expect(db.prepare(`SELECT * FROM messages ORDER BY id`).all()).toEqual(before);
  });

  it("survives a third run", () => {
    backfillMessages({ db });
    backfillMessages({ db });
    const third = backfillMessages({ db });

    expect(third.inserted).toBe(0);
    expect(third.balanced).toBe(true);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM messages`).get()).toEqual({ n: 4 });
  });
});

describe("backfillMessages — feedback thread integrity", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);

    // A post with a chain four levels deep. Comment ids deliberately overlap the
    // post id range so a root/parent mix-up would be silently plausible.
    db.exec(`
      INSERT INTO feedback_posts (id, author_id, title, body, status, is_pinned, created_at, updated_at)
      VALUES (1, 1, 'p1', 'b1', 'open', 0, '${T}', '${T}'),
             (2, 1, 'p2', 'b2', 'open', 0, '${T}', '${T}');

      INSERT INTO feedback_comments (id, post_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 1, NULL, 1, 'level 1', '${T}', '${T}'),
             (2, 1, 1,    2, 'level 2', '${T}', '${T}'),
             (3, 1, 2,    1, 'level 3', '${T}', '${T}'),
             (4, 1, 3,    2, 'level 4', '${T}', '${T}'),
             (5, 2, NULL, 1, 'other post', '${T}', '${T}');
    `);
  });

  it("rebuilds a 4-deep chain with the right parents", () => {
    const result = backfillMessages({ db });
    expect(result.balanced).toBe(true);

    const newId = (legacyId: number) =>
      (
        db
          .prepare(
            `SELECT id FROM messages WHERE legacy_source = 'feedback_comments' AND legacy_id = ?`,
          )
          .get(legacyId) as { id: number }
      ).id;

    const rowOf = (legacyId: number) =>
      db
        .prepare(
          `SELECT id, parent_id, root_id, body FROM messages
           WHERE legacy_source = 'feedback_comments' AND legacy_id = ?`,
        )
        .get(legacyId) as { id: number; parent_id: number | null; root_id: number; body: string };

    expect(rowOf(1).parent_id).toBeNull();
    expect(rowOf(2).parent_id).toBe(newId(1));
    expect(rowOf(3).parent_id).toBe(newId(2));
    expect(rowOf(4).parent_id).toBe(newId(3));

    expect(result.parentsRemapped).toBe(3);
  });

  it("points every comment's root at the POST, not at another comment", () => {
    // ⚠️ This is the ordering trap. parent_id resolves against feedback_comments
    // and root_id against feedback_posts — two different tables whose ids collide.
    // A single generic self-join passes every constraint and gets this wrong.
    backfillMessages({ db });

    const post1 = (
      db
        .prepare(`SELECT id FROM messages WHERE legacy_source = 'feedback_posts' AND legacy_id = 1`)
        .get() as { id: number }
    ).id;
    const post2 = (
      db
        .prepare(`SELECT id FROM messages WHERE legacy_source = 'feedback_posts' AND legacy_id = 2`)
        .get() as { id: number }
    ).id;

    const roots = db
      .prepare(
        `SELECT legacy_id, root_id FROM messages
         WHERE legacy_source = 'feedback_comments' ORDER BY legacy_id`,
      )
      .all() as { legacy_id: number; root_id: number }[];

    expect(roots).toEqual([
      { legacy_id: 1, root_id: post1 },
      { legacy_id: 2, root_id: post1 },
      { legacy_id: 3, root_id: post1 },
      { legacy_id: 4, root_id: post1 },
      { legacy_id: 5, root_id: post2 },
    ]);
  });

  it("makes the whole thread reachable with one WHERE root_id = ?", () => {
    backfillMessages({ db });

    const post1 = (
      db
        .prepare(`SELECT id FROM messages WHERE legacy_source = 'feedback_posts' AND legacy_id = 1`)
        .get() as { id: number }
    ).id;

    // The post itself plus its four comments.
    const thread = db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE root_id = ?`).get(post1);
    expect(thread).toEqual({ n: 5 });
  });
});

describe("backfillMessages — flight comment thread integrity", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);
    db.exec(`
      INSERT INTO flight_comments (id, work_package_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 10, NULL, 1, 'top', '${T}', '${T}'),
             (2, 10, 1,    2, 'reply', '${T}', '${T}'),
             (3, 10, 2,    1, 'nested reply', '${T}', '${T}'),
             (4, 11, NULL, 2, 'other wp', '${T}', '${T}');
    `);
  });

  it("remaps parents and derives the thread root from the topmost ancestor", () => {
    const result = backfillMessages({ db });
    expect(result.balanced).toBe(true);

    const rowOf = (legacyId: number) =>
      db
        .prepare(
          `SELECT id, parent_id, root_id, subject_id FROM messages
           WHERE legacy_source = 'flight_comments' AND legacy_id = ?`,
        )
        .get(legacyId) as {
        id: number;
        parent_id: number | null;
        root_id: number;
        subject_id: number;
      };

    const top = rowOf(1);
    expect(top.parent_id).toBeNull();
    expect(top.root_id).toBe(top.id);

    // Flight comments have no container row — the container is the work package,
    // which is not a message — so the root is the topmost ancestor comment.
    expect(rowOf(2).parent_id).toBe(top.id);
    expect(rowOf(2).root_id).toBe(top.id);
    expect(rowOf(3).parent_id).toBe(rowOf(2).id);
    expect(rowOf(3).root_id).toBe(top.id);

    const other = rowOf(4);
    expect(other.root_id).toBe(other.id);
    expect(other.subject_id).toBe(11);
  });

  it("deletes the full subtree via the parent cascade", () => {
    // The v0.3.0 route ran two flat DELETEs and orphaned anything deeper than one
    // level. Deleting the top comment must now take the whole chain.
    backfillMessages({ db });

    const top = (
      db
        .prepare(
          `SELECT id FROM messages WHERE legacy_source = 'flight_comments' AND legacy_id = 1`,
        )
        .get() as { id: number }
    ).id;

    db.prepare(`DELETE FROM messages WHERE id = ?`).run(top);

    const remaining = db
      .prepare(`SELECT COUNT(*) AS n FROM messages WHERE kind = 'flight_comment'`)
      .get();
    expect(remaining).toEqual({ n: 1 }); // only the other work package's comment
  });
});

describe("backfillMessages — labels many-to-many", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);
    db.exec(`
      INSERT INTO feedback_posts (id, author_id, title, body, status, is_pinned, created_at, updated_at)
      VALUES (1, 1, 'p1', 'b1', 'open', 0, '${T}', '${T}'),
             (2, 1, 'p2', 'b2', 'open', 0, '${T}', '${T}');

      INSERT INTO feedback_labels (id, name, color, sort_order, created_at)
      VALUES (1, 'bug', '#ff0000', 0, '${T}'),
             (2, 'feature', '#00ff00', 1, '${T}'),
             (3, 'docs', '#0000ff', 2, '${T}');

      -- Both directions of the many-to-many: one post with two labels, one label
      -- on two posts.
      INSERT INTO feedback_post_labels (post_id, label_id)
      VALUES (1, 1), (1, 2), (2, 1);
    `);
  });

  it("moves labels into their own table, keeping name UNIQUE", () => {
    const result = backfillMessages({ db });

    expect(result.sourceCounts.feedback_labels).toMatchObject({
      legacy: 3,
      inserted: 3,
      balanced: true,
    });

    const rows = db.prepare(`SELECT name, color, sort_order FROM labels ORDER BY id`).all();
    expect(rows).toEqual([
      { name: "bug", color: "#ff0000", sort_order: 0 },
      { name: "feature", color: "#00ff00", sort_order: 1 },
      { name: "docs", color: "#0000ff", sort_order: 2 },
    ]);

    // Labels are NOT messages — that separation is the decision under test.
    expect(db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE kind = 'label'`).get()).toEqual({
      n: 0,
    });
  });

  it("rewires the join table onto the new message and label ids", () => {
    const result = backfillMessages({ db });

    expect(result.sourceCounts.feedback_post_labels).toMatchObject({
      legacy: 3,
      inserted: 3,
      balanced: true,
    });

    const pairs = db
      .prepare(
        `SELECT m.legacy_id AS postLegacyId, l.name AS labelName
         FROM message_labels ml
         JOIN messages m ON m.id = ml.message_id
         JOIN labels l ON l.id = ml.label_id
         ORDER BY m.legacy_id, l.name`,
      )
      .all();

    expect(pairs).toEqual([
      { postLegacyId: 1, labelName: "bug" },
      { postLegacyId: 1, labelName: "feature" },
      { postLegacyId: 2, labelName: "bug" },
    ]);
  });

  it("is idempotent on the join table via its composite primary key", () => {
    backfillMessages({ db });
    const second = backfillMessages({ db });

    expect(second.sourceCounts.feedback_post_labels).toMatchObject({
      inserted: 0,
      alreadyPresent: 3,
      balanced: true,
    });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM message_labels`).get()).toEqual({ n: 3 });
  });

  it("adopts a pre-existing label with the same name instead of failing on UNIQUE", () => {
    db.prepare(
      `INSERT INTO labels (name, color, sort_order, created_at) VALUES ('bug', '#111111', 0, ?)`,
    ).run(T);

    const result = backfillMessages({ db });

    expect(result.sourceCounts.feedback_labels.balanced).toBe(true);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM labels WHERE name = 'bug'`).get()).toEqual({
      n: 1,
    });
    expect(result.warnings.join(" ")).toContain("adopted existing label");
  });
});

describe("backfillMessages — notification metadata rewrite", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);

    // Give flight_comments a high id so the new id is guaranteed to differ.
    db.exec(`
      INSERT INTO flight_comments (id, work_package_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (77, 10, NULL, 1, 'the comment', '${T}', '${T}');

      INSERT INTO notifications (id, user_id, type, category, title, message, metadata, created_at)
      VALUES (1, 2, 'comment', 'flight', 'New comment on C-FOIJ', 'the comment',
              '{"workPackageId":10,"spId":500,"commentId":77}', '${T}'),
             (2, 2, 'system', 'general', 'No metadata', NULL, NULL, '${T}'),
             (3, 2, 'system', 'general', 'Unrelated metadata', NULL,
              '{"foo":"bar"}', '${T}');
    `);
  });

  it("rewrites commentId to the new message id and keeps the original", () => {
    const result = backfillMessages({ db });

    expect(result.metadataRemapped).toBe(1);

    const newCommentId = (
      db
        .prepare(
          `SELECT id FROM messages WHERE legacy_source = 'flight_comments' AND legacy_id = 77`,
        )
        .get() as { id: number }
    ).id;

    const meta = JSON.parse(
      (
        db
          .prepare(
            `SELECT metadata FROM messages WHERE legacy_source = 'notifications' AND legacy_id = 1`,
          )
          .get() as { metadata: string }
      ).metadata,
    );

    expect(meta.commentId).toBe(newCommentId);
    expect(meta.legacyCommentId).toBe(77);
    // workPackageId and spId reference tables this migration does not touch.
    expect(meta.workPackageId).toBe(10);
    expect(meta.spId).toBe(500);
  });

  it("leaves metadata without a commentId untouched", () => {
    backfillMessages({ db });

    const rows = db
      .prepare(
        `SELECT legacy_id, metadata FROM messages
         WHERE legacy_source = 'notifications' AND legacy_id IN (2, 3) ORDER BY legacy_id`,
      )
      .all() as { legacy_id: number; metadata: string | null }[];

    expect(rows[0].metadata).toBeNull();
    expect(JSON.parse(rows[1].metadata!)).toEqual({ foo: "bar" });
  });

  it("does not double-remap on a second run", () => {
    // The guard that matters: after run 1 the field holds the NEW id, which could
    // itself be a valid legacy flight_comments id. legacyCommentId is the marker
    // that stops a second rewrite.
    backfillMessages({ db });
    const after1 = db
      .prepare(
        `SELECT metadata FROM messages WHERE legacy_source = 'notifications' AND legacy_id = 1`,
      )
      .get() as { metadata: string };

    const second = backfillMessages({ db });
    expect(second.metadataRemapped).toBe(0);

    const after2 = db
      .prepare(
        `SELECT metadata FROM messages WHERE legacy_source = 'notifications' AND legacy_id = 1`,
      )
      .get() as { metadata: string };

    expect(after2.metadata).toBe(after1.metadata);
  });
});

describe("backfillMessages — orphan handling", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);
    db.exec(`
      -- work package 99 and user 99 do not exist
      INSERT INTO flight_comments (id, work_package_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 10, NULL, 1, 'good', '${T}', '${T}'),
             (2, 99, NULL, 1, 'orphan wp', '${T}', '${T}'),
             (3, 10, NULL, 99, 'orphan author', '${T}', '${T}');

      INSERT INTO notifications (id, user_id, title, created_at)
      VALUES (1, 1, 'good', '${T}'),
             (2, 99, 'orphan recipient', '${T}');
    `);
  });

  it("skips orphans by default, counts them, and still balances", () => {
    const result = backfillMessages({ db });

    expect(result.sourceCounts.flight_comments).toMatchObject({
      legacy: 3,
      inserted: 1,
      orphansSkipped: 2,
      balanced: true,
    });
    expect(result.sourceCounts.notifications).toMatchObject({
      legacy: 2,
      inserted: 1,
      orphansSkipped: 1,
      balanced: true,
    });

    // An orphan is expected loss, not silent loss — it reconciles and is reported.
    expect(result.balanced).toBe(true);
    expect(() => assertMessagesReconciled(result)).not.toThrow();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("aborts the whole transaction with onOrphan: throw", () => {
    expect(() => backfillMessages({ db, onOrphan: "throw" })).toThrow(/skipped/);

    // Atomic: the good rows must not have landed either.
    expect(db.prepare(`SELECT COUNT(*) AS n FROM messages`).get()).toEqual({ n: 0 });
  });
});

describe("backfillMessages — dryRun", () => {
  beforeEach(() => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);
    db.exec(`
      INSERT INTO feedback_posts (id, author_id, title, body, status, is_pinned, created_at, updated_at)
      VALUES (1, 1, 'p', 'b', 'open', 0, '${T}', '${T}');
      INSERT INTO feedback_labels (id, name, color, sort_order, created_at)
      VALUES (1, 'bug', '#ff0000', 0, '${T}');
      INSERT INTO feedback_post_labels (post_id, label_id) VALUES (1, 1);
      INSERT INTO notifications (id, user_id, title, created_at) VALUES (1, 1, 'n', '${T}');
    `);
  });

  it("reports what would move but writes nothing", () => {
    const result = backfillMessages({ db, dryRun: true });

    expect(result.ran).toBe(true);
    expect(result.dryRun).toBe(true);
    // 1 post + 1 notification + 1 label + 1 label link. `inserted` sums every
    // source, not just the messages ones.
    expect(result.inserted).toBe(4);
    expect(result.balanced).toBe(true);

    // Rolled back — the whole point.
    expect(db.prepare(`SELECT COUNT(*) AS n FROM messages`).get()).toEqual({ n: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM labels`).get()).toEqual({ n: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM message_labels`).get()).toEqual({ n: 0 });
  });

  it("leaves a real run afterwards free to do the work", () => {
    backfillMessages({ db, dryRun: true });
    const real = backfillMessages({ db });

    expect(real.inserted).toBe(4);
    expect(real.balanced).toBe(true);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM message_labels`).get()).toEqual({ n: 1 });
  });
});

describe("assertMessagesReconciled", () => {
  it("throws with detail when a source does not balance", () => {
    // Simulates the exact scenario the guard exists for: rows in the legacy table,
    // nothing in messages, and an application that would run perfectly while
    // showing empty threads.
    expect(() =>
      assertMessagesReconciled({
        ran: true,
        sourceCounts: {
          notifications: {
            legacy: 48,
            inserted: 0,
            alreadyPresent: 0,
            orphansSkipped: 0,
            balanced: false,
          },
        },
        inserted: 0,
        alreadyPresent: 0,
        orphansSkipped: 0,
        parentsRemapped: 0,
        balanced: false,
        metadataRemapped: 0,
        warnings: [],
        dryRun: false,
      }),
    ).toThrow(/did not reconcile/);
  });

  it("does not throw when the backfill never ran", () => {
    expect(() =>
      assertMessagesReconciled({
        ran: false,
        sourceCounts: {},
        inserted: 0,
        alreadyPresent: 0,
        orphansSkipped: 0,
        parentsRemapped: 0,
        balanced: true,
        metadataRemapped: 0,
        warnings: [],
        dryRun: false,
      }),
    ).not.toThrow();
  });
});

describe("backfillMessages — reconciliation against a full mixed database", () => {
  it("balances every source at once", () => {
    seedUsersAndWps();
    db.exec(LEGACY_SCHEMA);
    db.exec(`
      INSERT INTO flight_comments (id, work_package_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 10, NULL, 1, 'a', '${T}', '${T}'), (2, 10, 1, 2, 'b', '${T}', '${T}');

      INSERT INTO notifications (id, user_id, title, metadata, created_at)
      VALUES (1, 1, 'n1', '{"commentId":1}', '${T}'), (2, 2, 'n2', NULL, '${T}');

      INSERT INTO feedback_posts (id, author_id, title, body, status, is_pinned, created_at, updated_at)
      VALUES (1, 1, 'p1', 'b', 'open', 0, '${T}', '${T}');

      INSERT INTO feedback_comments (id, post_id, parent_id, author_id, body, created_at, updated_at)
      VALUES (1, 1, NULL, 2, 'c', '${T}', '${T}');

      INSERT INTO feedback_labels (id, name, color, sort_order, created_at)
      VALUES (1, 'bug', '#f00', 0, '${T}');

      INSERT INTO feedback_post_labels (post_id, label_id) VALUES (1, 1);
    `);

    const result = backfillMessages({ db });

    expect(result.balanced).toBe(true);
    for (const [source, sc] of Object.entries(result.sourceCounts)) {
      expect(sc.balanced, `${source} should balance`).toBe(true);
      expect(sc.inserted + sc.alreadyPresent + sc.orphansSkipped).toBe(sc.legacy);
    }

    // 2 flight comments + 2 notifications + 1 post + 1 comment
    expect(db.prepare(`SELECT COUNT(*) AS n FROM messages`).get()).toEqual({ n: 6 });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM labels`).get()).toEqual({ n: 1 });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM message_labels`).get()).toEqual({ n: 1 });
    expect(() => assertMessagesReconciled(result)).not.toThrow();
  });
});
