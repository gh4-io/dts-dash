// @vitest-environment node
/**
 * `/feedback/[id]` link survival across the v1.0.0 id remap (OI-099).
 *
 * Four tables merged into `messages`, each with its own AUTOINCREMENT sequence,
 * so their ids collided and could not all be preserved. Every feedback link
 * saved before v1.0.0 therefore points at a different post or at nothing. The
 * original id survives on `messages.legacy_id`, and `resolveFeedbackPostId`
 * is what turns that into a working link instead of a dead one.
 *
 * The case worth protecting is the collision: a post that legitimately has id N
 * today, while some *other* post carries N as its legacy id. Whoever holds a
 * current link must win, or v1.0.0 would break live URLs in the act of fixing
 * old ones. The fixture below sets that trap deliberately.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type Database from "better-sqlite3";

let sqlite: Database.Database;
let repo: typeof import("@/lib/messages/repository");
let tmpDir: string;

const NOW = "2026-08-09T00:00:00.000Z";

function insertPost(opts: { id: number; title: string; legacyId?: number | null }): void {
  sqlite
    .prepare(
      `INSERT INTO messages
         (id, kind, author_id, title, body, status, created_at, updated_at,
          legacy_source, legacy_id)
       VALUES (?, 'feedback_post', 1, ?, 'body', 'open', ?, ?, ?, ?)`,
    )
    .run(
      opts.id,
      opts.title,
      NOW,
      NOW,
      opts.legacyId == null ? null : "feedback_posts",
      opts.legacyId ?? null,
    );
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtsd-legacy-ids-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "test.db");

  const client = await import("@/lib/db/client");
  const init = await import("@/lib/db/schema-init");
  sqlite = client.sqlite;
  init.createTables();

  sqlite
    .prepare(
      `INSERT INTO users (id, auth_id, email, display_name, password_hash, role, created_at, updated_at)
       VALUES (1, 'test-auth', 't@test.local', 'Tester', 'x', 'admin', ?, ?)`,
    )
    .run(NOW, NOW);

  // Production's actual outcome: posts renumbered 1-3, carrying legacy 4-6.
  insertPost({ id: 1, title: "Group by shift", legacyId: 4 });
  insertPost({ id: 2, title: "Feedback board display post", legacyId: 5 });
  insertPost({ id: 3, title: "Reset button resets date range", legacyId: 6 });

  // The trap: id 7 exists today, and post 8 claims 7 as its legacy id.
  insertPost({ id: 7, title: "Current post using a contested id", legacyId: 90 });
  insertPost({ id: 8, title: "Older post whose legacy id is 7", legacyId: 7 });

  repo = await import("@/lib/messages/repository");
});

afterAll(() => {
  sqlite?.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveFeedbackPostId", () => {
  it("resolves a current id without claiming it moved", () => {
    expect(repo.resolveFeedbackPostId(2)).toEqual({ id: 2, moved: false });
  });

  it("resolves a pre-v1.0.0 id to the post it became", () => {
    // The production remap: /feedback/5 was bookmarked, the post is now id 2.
    expect(repo.resolveFeedbackPostId(5)).toEqual({ id: 2, moved: true });
  });

  it("prefers the live post when an id is both current and someone's legacy id", () => {
    // id 7 is a real post AND post 8's legacy id. The live link must win —
    // otherwise fixing old URLs would silently hijack working ones.
    expect(repo.resolveFeedbackPostId(7)).toEqual({ id: 7, moved: false });
  });

  it("still reaches the shadowed post by its own current id", () => {
    expect(repo.resolveFeedbackPostId(8)).toEqual({ id: 8, moved: false });
  });

  it("returns null for an id that never existed", () => {
    expect(repo.resolveFeedbackPostId(4242)).toBeNull();
  });

  it("does not resolve ids belonging to another message kind", () => {
    // Notifications shared the id space before the merge. A notification's
    // legacy id must not resolve as a feedback post.
    sqlite
      .prepare(
        `INSERT INTO messages
           (id, kind, recipient_id, author_id, title, body, created_at, updated_at,
            legacy_source, legacy_id)
         VALUES (900, 'notification', 1, 1, 'n', 'b', ?, ?, 'notifications', 11)`,
      )
      .run(NOW, NOW);

    expect(repo.resolveFeedbackPostId(11)).toBeNull();
    expect(repo.resolveFeedbackPostId(900)).toBeNull();
  });
});
