/**
 * Messages backfill — moves the six pre-v1.0.0 messaging tables into
 * `messages` / `labels` / `message_labels` (OI-099).
 *
 * ── THE FAILURE THIS EXISTS TO PREVENT ──────────────────────────────────────
 *
 * `createTables()` creates `messages` EMPTY on a database whose old tables still
 * hold every row. In that window the application is fully functional and shows
 * zero comments, zero notifications and zero feedback. No error. No exception.
 * No log line. An empty thread is indistinguishable from a successfully migrated
 * one.
 *
 * If this were a script someone had to remember to run, that would be the
 * permanent state of any database whose operator forgot. This exact failure
 * already happened once in this release: after OI-086 renamed a column, the dev
 * database was not upgraded and the app cheerfully displayed blank work-package
 * identifiers for weeks.
 *
 * So it is wired into `bootstrapDatabase()` and paired with a reconciliation
 * guard that THROWS on a count mismatch. Refusing to boot is the only way to make
 * a silent zero visible.
 *
 * ── Guarantees ──────────────────────────────────────────────────────────────
 *
 * - Idempotent. Keyed on (legacy_source, legacy_id), which carries a UNIQUE
 *   partial index. A second run inserts nothing and reports everything as
 *   alreadyPresent.
 * - Atomic. One transaction; a failure anywhere leaves the database untouched.
 * - Safe on a fresh database. Each legacy table is probed via sqlite_master;
 *   if none are present it returns `{ ran: false }` rather than erroring.
 * - Lossless or loud. `balanced` compares every legacy row against what landed.
 *
 * ── The ordering trap ───────────────────────────────────────────────────────
 *
 * A feedback comment's `parent_id` points at another `feedback_comments` row
 * while its `root_id` points at a `feedback_posts` row. Two different legacy
 * tables, and ids collide freely between them because all four tables use
 * independent AUTOINCREMENT sequences. A single generic self-join on "matching
 * legacy_source" would resolve the root to a comment and build silently wrong
 * trees that no constraint would reject.
 *
 * Hence explicit per-source remap statements, each guarded with
 * `AND parent_id IS NULL` so pass 2 is independently re-runnable.
 */

import type Database from "better-sqlite3";

/** The legacy tables, in the order they must be migrated. */
const LEGACY_SOURCES = [
  "flight_comments",
  "notifications",
  // feedback_posts must precede feedback_comments: a comment's root_id is
  // resolved from the already-inserted post row.
  "feedback_posts",
  "feedback_comments",
  "feedback_labels",
  "feedback_post_labels",
] as const;

export type LegacySource = (typeof LEGACY_SOURCES)[number];

export interface SourceCount {
  /** Rows in the legacy table. */
  legacy: number;
  /** Rows this run inserted. */
  inserted: number;
  /** Rows a previous run had already migrated. */
  alreadyPresent: number;
  /** Rows skipped because a referenced row no longer exists. */
  orphansSkipped: number;
  /** legacy === inserted + alreadyPresent + orphansSkipped */
  balanced: boolean;
}

export interface BackfillResult {
  /** False when no legacy table exists — a fresh install. Never an error. */
  ran: boolean;
  sourceCounts: Record<string, SourceCount>;
  inserted: number;
  alreadyPresent: number;
  orphansSkipped: number;
  /** Parent/root pointers rewritten from legacy ids to new ids. */
  parentsRemapped: number;
  /** True when every source balanced. */
  balanced: boolean;
  /** Notification metadata.commentId values rewritten. */
  metadataRemapped: number;
  /** Non-fatal notes worth surfacing (name collisions, orphans). */
  warnings: string[];
  dryRun: boolean;
}

export interface BackfillOptions {
  /**
   * Database handle to operate on. Injectable so tests can run against an
   * in-memory or temp database — this is what makes the module testable at all.
   * Defaults to the app singleton.
   */
  db?: Database.Database;
  /** Compute and report everything, then roll back. */
  dryRun?: boolean;
  /**
   * What to do about a legacy row whose referenced user, work package or post no
   * longer exists. "skip" leaves it behind and counts it; "throw" aborts the
   * whole transaction.
   */
  onOrphan?: "skip" | "throw";
}

/** Sentinel used to roll back a dry run — never escapes this module. */
const DRY_RUN_ROLLBACK = Symbol("dry-run-rollback");

function tableExists(db: Database.Database, name: string): boolean {
  return (
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name) !==
    undefined
  );
}

/** Late-bound app singleton, used only when no handle was injected. */
function resolveDefaultHandle(): Database.Database {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const client = require("@/lib/db/client") as { sqlite: Database.Database };
  return client.sqlite;
}

function count(db: Database.Database, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...(params as never[])) as { n: number } | undefined;
  return row?.n ?? 0;
}

export function backfillMessages(opts: BackfillOptions = {}): BackfillResult {
  const dryRun = opts.dryRun ?? false;
  const onOrphan = opts.onOrphan ?? "skip";

  // The handle is resolved lazily and never imported at module scope: this module
  // is pulled in by bootstrap, and a top-level `import { sqlite }` would open the
  // default database as an import side effect — wrong for the CLI, which points at
  // a path of its own, and wrong for tests, which inject a temp handle.
  //
  // Every real caller passes `db` explicitly, so the fallback is a safety net
  // rather than the normal path.
  const db: Database.Database = opts.db ?? resolveDefaultHandle();

  const empty: BackfillResult = {
    ran: false,
    sourceCounts: {},
    inserted: 0,
    alreadyPresent: 0,
    orphansSkipped: 0,
    parentsRemapped: 0,
    balanced: true,
    metadataRemapped: 0,
    warnings: [],
    dryRun,
  };

  // Fresh install: none of the legacy tables exist, so there is nothing to move.
  // Not an error — this is the common case for every new deployment.
  const present = LEGACY_SOURCES.filter((t) => tableExists(db, t));
  if (present.length === 0) return empty;

  // `messages` itself must exist. createTables() runs before this in bootstrap,
  // so its absence means a caller invoked the backfill out of order.
  if (!tableExists(db, "messages")) {
    throw new Error(
      "backfillMessages: `messages` table does not exist. Call createTables() first.",
    );
  }

  const result: BackfillResult = { ...empty, ran: true, sourceCounts: {}, warnings: [] };

  const run = db.transaction(() => {
    for (const source of present) {
      result.sourceCounts[source] = migrateSource(db, source, onOrphan, result);
    }

    result.parentsRemapped += remapParents(db, present);
    result.metadataRemapped += remapNotificationMetadata(db, present);

    // Roll up
    result.inserted = sum(result.sourceCounts, (s) => s.inserted);
    result.alreadyPresent = sum(result.sourceCounts, (s) => s.alreadyPresent);
    result.orphansSkipped = sum(result.sourceCounts, (s) => s.orphansSkipped);
    result.balanced = Object.values(result.sourceCounts).every((s) => s.balanced);

    if (dryRun) throw DRY_RUN_ROLLBACK;
  });

  try {
    run();
  } catch (err) {
    if (err !== DRY_RUN_ROLLBACK) throw err;
  }

  return result;
}

function sum(counts: Record<string, SourceCount>, pick: (s: SourceCount) => number): number {
  return Object.values(counts).reduce((acc, s) => acc + pick(s), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// Pass 1 — per-source row moves
// ═══════════════════════════════════════════════════════════════════════════

function migrateSource(
  db: Database.Database,
  source: LegacySource,
  onOrphan: "skip" | "throw",
  result: BackfillResult,
): SourceCount {
  switch (source) {
    case "flight_comments":
      return migrateFlightComments(db, onOrphan, result);
    case "notifications":
      return migrateNotifications(db, onOrphan, result);
    case "feedback_posts":
      return migrateFeedbackPosts(db, onOrphan, result);
    case "feedback_comments":
      return migrateFeedbackComments(db, onOrphan, result);
    case "feedback_labels":
      return migrateLabels(db, result);
    case "feedback_post_labels":
      return migratePostLabels(db, onOrphan, result);
  }
}

/** Shared idempotency predicate: this legacy row has not been migrated yet. */
const notYetMigrated = (source: string, alias: string) =>
  `NOT EXISTS (SELECT 1 FROM messages m WHERE m.legacy_source = '${source}' AND m.legacy_id = ${alias}.id)`;

function handleOrphans(
  source: string,
  n: number,
  detail: string,
  onOrphan: "skip" | "throw",
  result: BackfillResult,
): void {
  if (n === 0) return;
  const msg = `${source}: ${n} row(s) skipped — ${detail}`;
  if (onOrphan === "throw") {
    throw new Error(`backfillMessages: ${msg}`);
  }
  result.warnings.push(msg);
}

function migrateFlightComments(
  db: Database.Database,
  onOrphan: "skip" | "throw",
  result: BackfillResult,
): SourceCount {
  const legacy = count(db, `SELECT COUNT(*) AS n FROM flight_comments`);
  const alreadyPresent = count(
    db,
    `SELECT COUNT(*) AS n FROM flight_comments fc
     WHERE EXISTS (SELECT 1 FROM messages m
                   WHERE m.legacy_source = 'flight_comments' AND m.legacy_id = fc.id)`,
  );

  // A comment whose work package or author is gone cannot satisfy the
  // flight_comment CHECK constraints, and inventing a placeholder would be worse
  // than leaving it in the legacy table where it can still be inspected.
  const orphanWhere = `
    (NOT EXISTS (SELECT 1 FROM work_packages wp WHERE wp.id = fc.work_package_id)
     OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = fc.author_id))`;

  const orphansSkipped = count(
    db,
    `SELECT COUNT(*) AS n FROM flight_comments fc
     WHERE ${notYetMigrated("flight_comments", "fc")} AND ${orphanWhere}`,
  );
  handleOrphans(
    "flight_comments",
    orphansSkipped,
    "work package or author no longer exists",
    onOrphan,
    result,
  );

  // parent_id / root_id stay NULL here and are resolved in pass 2 — the new ids
  // do not exist yet. legacy_parent_id preserves the old pointer meanwhile.
  const inserted = db
    .prepare(
      `INSERT INTO messages (
         kind, parent_id, root_id, subject_type, subject_id,
         author_id, body, is_pinned, created_at, updated_at,
         legacy_source, legacy_id, legacy_parent_id
       )
       SELECT 'flight_comment', NULL, NULL, 'work_package', fc.work_package_id,
              fc.author_id, fc.body, 0, fc.created_at, fc.updated_at,
              'flight_comments', fc.id, fc.parent_id
       FROM flight_comments fc
       WHERE ${notYetMigrated("flight_comments", "fc")} AND NOT ${orphanWhere}`,
    )
    .run().changes;

  return balance(legacy, inserted, alreadyPresent, orphansSkipped);
}

function migrateNotifications(
  db: Database.Database,
  onOrphan: "skip" | "throw",
  result: BackfillResult,
): SourceCount {
  const legacy = count(db, `SELECT COUNT(*) AS n FROM notifications`);
  const alreadyPresent = count(
    db,
    `SELECT COUNT(*) AS n FROM notifications n
     WHERE EXISTS (SELECT 1 FROM messages m
                   WHERE m.legacy_source = 'notifications' AND m.legacy_id = n.id)`,
  );

  // recipient_id is NOT NULL by CHECK, and the column cascades from users — a
  // notification with no recipient has nobody to deliver it to.
  const orphanWhere = `NOT EXISTS (SELECT 1 FROM users u WHERE u.id = n.user_id)`;

  const orphansSkipped = count(
    db,
    `SELECT COUNT(*) AS n FROM notifications n
     WHERE ${notYetMigrated("notifications", "n")} AND ${orphanWhere}`,
  );
  handleOrphans("notifications", orphansSkipped, "recipient no longer exists", onOrphan, result);

  // notifications had no updated_at; created_at stands in so the column can stay
  // NOT NULL for every kind.
  const inserted = db
    .prepare(
      `INSERT INTO messages (
         kind, recipient_id, msg_type, category, title, body, metadata,
         read_at, action_url, expires_at, is_pinned, created_at, updated_at,
         legacy_source, legacy_id
       )
       SELECT 'notification', n.user_id, n.type, n.category, n.title, n.message, n.metadata,
              n.read_at, n.action_url, n.expires_at, 0, n.created_at, n.created_at,
              'notifications', n.id
       FROM notifications n
       WHERE ${notYetMigrated("notifications", "n")} AND NOT ${orphanWhere}`,
    )
    .run().changes;

  return balance(legacy, inserted, alreadyPresent, orphansSkipped);
}

function migrateFeedbackPosts(
  db: Database.Database,
  onOrphan: "skip" | "throw",
  result: BackfillResult,
): SourceCount {
  const legacy = count(db, `SELECT COUNT(*) AS n FROM feedback_posts`);
  const alreadyPresent = count(
    db,
    `SELECT COUNT(*) AS n FROM feedback_posts p
     WHERE EXISTS (SELECT 1 FROM messages m
                   WHERE m.legacy_source = 'feedback_posts' AND m.legacy_id = p.id)`,
  );

  const orphanWhere = `NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.author_id)`;

  const orphansSkipped = count(
    db,
    `SELECT COUNT(*) AS n FROM feedback_posts p
     WHERE ${notYetMigrated("feedback_posts", "p")} AND ${orphanWhere}`,
  );
  handleOrphans("feedback_posts", orphansSkipped, "author no longer exists", onOrphan, result);

  const inserted = db
    .prepare(
      `INSERT INTO messages (
         kind, title, body, status, is_pinned, author_id, created_at, updated_at,
         legacy_source, legacy_id
       )
       SELECT 'feedback_post', p.title, p.body, p.status, p.is_pinned, p.author_id,
              p.created_at, p.updated_at, 'feedback_posts', p.id
       FROM feedback_posts p
       WHERE ${notYetMigrated("feedback_posts", "p")} AND NOT ${orphanWhere}`,
    )
    .run().changes;

  // A post is its own thread root, so "every message in this thread" — the post
  // plus its whole comment tree at any depth — is one WHERE root_id = ?.
  // Cannot be done in the INSERT: the id does not exist until the row does.
  db.prepare(
    `UPDATE messages SET root_id = id
     WHERE kind = 'feedback_post' AND root_id IS NULL`,
  ).run();

  return balance(legacy, inserted, alreadyPresent, orphansSkipped);
}

function migrateFeedbackComments(
  db: Database.Database,
  onOrphan: "skip" | "throw",
  result: BackfillResult,
): SourceCount {
  const legacy = count(db, `SELECT COUNT(*) AS n FROM feedback_comments`);
  const alreadyPresent = count(
    db,
    `SELECT COUNT(*) AS n FROM feedback_comments c
     WHERE EXISTS (SELECT 1 FROM messages m
                   WHERE m.legacy_source = 'feedback_comments' AND m.legacy_id = c.id)`,
  );

  // root_id is required by CHECK for this kind, and it resolves through the
  // migrated post — which is why feedback_posts runs first. A comment whose post
  // was skipped as an orphan is itself an orphan.
  const rootLookup = `(SELECT m.id FROM messages m
                       WHERE m.legacy_source = 'feedback_posts' AND m.legacy_id = c.post_id)`;

  const orphanWhere = `
    (${rootLookup} IS NULL
     OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.author_id))`;

  const orphansSkipped = count(
    db,
    `SELECT COUNT(*) AS n FROM feedback_comments c
     WHERE ${notYetMigrated("feedback_comments", "c")} AND ${orphanWhere}`,
  );
  handleOrphans(
    "feedback_comments",
    orphansSkipped,
    "post was not migrated, or author no longer exists",
    onOrphan,
    result,
  );

  // root_id resolves NOW (against feedback_posts), parent_id in pass 2 (against
  // feedback_comments). Two different legacy tables whose ids collide — this
  // split is the ordering trap this module exists to get right.
  const inserted = db
    .prepare(
      `INSERT INTO messages (
         kind, parent_id, root_id, author_id, body, is_pinned, created_at, updated_at,
         legacy_source, legacy_id, legacy_parent_id
       )
       SELECT 'feedback_comment', NULL, ${rootLookup}, c.author_id, c.body, 0,
              c.created_at, c.updated_at, 'feedback_comments', c.id, c.parent_id
       FROM feedback_comments c
       WHERE ${notYetMigrated("feedback_comments", "c")} AND NOT ${orphanWhere}`,
    )
    .run().changes;

  return balance(legacy, inserted, alreadyPresent, orphansSkipped);
}

function migrateLabels(db: Database.Database, result: BackfillResult): SourceCount {
  const legacy = count(db, `SELECT COUNT(*) AS n FROM feedback_labels`);

  // labels.name is NOT NULL UNIQUE — one of the three reasons labels were kept
  // out of `messages`. A pre-existing row with the same name (hand-created
  // between runs) is adopted rather than duplicated, so the source still balances.
  const collisions = db
    .prepare(
      `SELECT fl.id AS legacyId, fl.name AS name
       FROM feedback_labels fl
       JOIN labels l ON l.name = fl.name
       WHERE l.legacy_source IS NULL
         AND NOT EXISTS (SELECT 1 FROM labels x
                         WHERE x.legacy_source = 'feedback_labels' AND x.legacy_id = fl.id)`,
    )
    .all() as { legacyId: number; name: string }[];

  for (const c of collisions) {
    db.prepare(
      `UPDATE labels SET legacy_source = 'feedback_labels', legacy_id = ? WHERE name = ?`,
    ).run(c.legacyId, c.name);
    result.warnings.push(
      `feedback_labels: adopted existing label "${c.name}" (name is UNIQUE) instead of duplicating it`,
    );
  }

  const alreadyPresent = count(
    db,
    `SELECT COUNT(*) AS n FROM feedback_labels fl
     WHERE EXISTS (SELECT 1 FROM labels l
                   WHERE l.legacy_source = 'feedback_labels' AND l.legacy_id = fl.id)`,
  );

  const inserted = db
    .prepare(
      `INSERT INTO labels (name, color, sort_order, created_at, legacy_source, legacy_id)
       SELECT fl.name, fl.color, fl.sort_order, fl.created_at, 'feedback_labels', fl.id
       FROM feedback_labels fl
       WHERE NOT EXISTS (SELECT 1 FROM labels l
                         WHERE l.legacy_source = 'feedback_labels' AND l.legacy_id = fl.id)`,
    )
    .run().changes;

  return balance(legacy, inserted, alreadyPresent, 0);
}

function migratePostLabels(
  db: Database.Database,
  onOrphan: "skip" | "throw",
  result: BackfillResult,
): SourceCount {
  const legacy = count(db, `SELECT COUNT(*) AS n FROM feedback_post_labels`);

  // This join table has no id of its own — the composite PK is its identity, so
  // idempotency comes from the PK rather than from a legacy key.
  const msgLookup = `(SELECT m.id FROM messages m
                      WHERE m.legacy_source = 'feedback_posts' AND m.legacy_id = pl.post_id)`;
  const labelLookup = `(SELECT l.id FROM labels l
                        WHERE l.legacy_source = 'feedback_labels' AND l.legacy_id = pl.label_id)`;

  const alreadyPresent = count(
    db,
    `SELECT COUNT(*) AS n FROM feedback_post_labels pl
     WHERE EXISTS (SELECT 1 FROM message_labels ml
                   WHERE ml.message_id = ${msgLookup} AND ml.label_id = ${labelLookup})`,
  );

  const orphansSkipped = count(
    db,
    `SELECT COUNT(*) AS n FROM feedback_post_labels pl
     WHERE (${msgLookup} IS NULL OR ${labelLookup} IS NULL)`,
  );
  handleOrphans(
    "feedback_post_labels",
    orphansSkipped,
    "post or label was not migrated",
    onOrphan,
    result,
  );

  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO message_labels (message_id, label_id)
       SELECT ${msgLookup}, ${labelLookup}
       FROM feedback_post_labels pl
       WHERE ${msgLookup} IS NOT NULL AND ${labelLookup} IS NOT NULL`,
    )
    .run().changes;

  return balance(legacy, inserted, alreadyPresent, orphansSkipped);
}

function balance(
  legacy: number,
  inserted: number,
  alreadyPresent: number,
  orphansSkipped: number,
): SourceCount {
  return {
    legacy,
    inserted,
    alreadyPresent,
    orphansSkipped,
    balanced: legacy === inserted + alreadyPresent + orphansSkipped,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Pass 2 — pointer remapping
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rewrite parent pointers from legacy ids to new ids.
 *
 * Deliberately NOT a single generic self-join. All four legacy tables used
 * independent AUTOINCREMENT sequences, so a `legacy_parent_id` of 3 means a
 * different row in each. Each statement below names exactly one source on both
 * sides of the join.
 *
 * Every statement is guarded with `AND parent_id IS NULL`, so pass 2 is
 * re-runnable on its own: rows already remapped are invisible to it. That also
 * makes it correct after a partial earlier run.
 */
function remapParents(db: Database.Database, present: readonly LegacySource[]): number {
  let remapped = 0;

  // flight_comments.parent_id → flight_comments (same source)
  if (present.includes("flight_comments")) {
    remapped += db
      .prepare(
        `UPDATE messages SET parent_id = (
           SELECT p.id FROM messages p
           WHERE p.legacy_source = 'flight_comments'
             AND p.legacy_id = messages.legacy_parent_id
         )
         WHERE kind = 'flight_comment'
           AND legacy_source = 'flight_comments'
           AND legacy_parent_id IS NOT NULL
           AND parent_id IS NULL
           AND EXISTS (SELECT 1 FROM messages p
                       WHERE p.legacy_source = 'flight_comments'
                         AND p.legacy_id = messages.legacy_parent_id)`,
      )
      .run().changes;

    // Thread roots for flight comments. There is no container row (the container
    // is the work package, which is not a message), so the root is the topmost
    // ancestor comment. Seed the roots, then walk down level by level — the depth
    // is data-dependent, so loop until nothing moves.
    db.prepare(
      `UPDATE messages SET root_id = id
       WHERE kind = 'flight_comment' AND parent_id IS NULL AND root_id IS NULL`,
    ).run();

    for (;;) {
      const moved = db
        .prepare(
          `UPDATE messages SET root_id = (
             SELECT p.root_id FROM messages p WHERE p.id = messages.parent_id
           )
           WHERE kind = 'flight_comment'
             AND root_id IS NULL
             AND parent_id IS NOT NULL
             AND (SELECT p.root_id FROM messages p WHERE p.id = messages.parent_id) IS NOT NULL`,
        )
        .run().changes;
      if (moved === 0) break;
    }
  }

  // feedback_comments.parent_id → feedback_comments.
  //
  // ⚠️ THE TRAP: root_id for these rows points at a feedback_posts row and was
  // already resolved in pass 1 against that table. Only parent_id is remapped
  // here, and only against feedback_comments. Conflating the two would build
  // trees that are silently wrong and violate no constraint.
  if (present.includes("feedback_comments")) {
    remapped += db
      .prepare(
        `UPDATE messages SET parent_id = (
           SELECT p.id FROM messages p
           WHERE p.legacy_source = 'feedback_comments'
             AND p.legacy_id = messages.legacy_parent_id
         )
         WHERE kind = 'feedback_comment'
           AND legacy_source = 'feedback_comments'
           AND legacy_parent_id IS NOT NULL
           AND parent_id IS NULL
           AND EXISTS (SELECT 1 FROM messages p
                       WHERE p.legacy_source = 'feedback_comments'
                         AND p.legacy_id = messages.legacy_parent_id)`,
      )
      .run().changes;
  }

  return remapped;
}

/**
 * Rewrite `notifications.metadata.commentId`.
 *
 * The comment-notification path writes `{ workPackageId, spId, commentId }`, where
 * commentId is a `flight_comments.id` (see the POST handler in
 * api/work-packages/[id]/comments). Under ID remapping that number now points at
 * an unrelated row — or at nothing — so the notification's deep link breaks.
 * workPackageId and spId are unaffected: they reference tables this migration
 * does not touch.
 *
 * Idempotency needs care here. After one run the field holds the NEW id, and a
 * naive re-run could remap it again if that value happens to also be a valid
 * legacy flight_comments id — which is likely, since both are small integers from
 * the same range. The original is therefore preserved as `legacyCommentId`, and
 * its presence is the guard: a row that has it is already done.
 */
function remapNotificationMetadata(
  db: Database.Database,
  present: readonly LegacySource[],
): number {
  if (!present.includes("notifications") || !present.includes("flight_comments")) return 0;

  return db
    .prepare(
      `UPDATE messages
       SET metadata = json_set(
             json_set(metadata, '$.legacyCommentId', json_extract(metadata, '$.commentId')),
             '$.commentId',
             (SELECT c.id FROM messages c
              WHERE c.legacy_source = 'flight_comments'
                AND c.legacy_id = json_extract(messages.metadata, '$.commentId'))
           )
       WHERE kind = 'notification'
         AND legacy_source = 'notifications'
         AND metadata IS NOT NULL
         AND json_valid(metadata)
         AND json_extract(metadata, '$.commentId') IS NOT NULL
         AND json_extract(metadata, '$.legacyCommentId') IS NULL
         AND EXISTS (SELECT 1 FROM messages c
                     WHERE c.legacy_source = 'flight_comments'
                       AND c.legacy_id = json_extract(messages.metadata, '$.commentId'))`,
    )
    .run().changes;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reconciliation guard
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare every legacy table's row count against what landed, and THROW on a
 * mismatch.
 *
 * This is the piece that makes the empty-boot window survivable. Without it, a
 * backfill that moved nothing looks exactly like a backfill that moved
 * everything: the app starts, the pages render, and every thread is empty. There
 * is no error to notice. Crashing at boot is the only signal that reaches anyone.
 *
 * Orphans are expected and counted, not treated as loss — they are subtracted
 * from the expected total and reported separately.
 */
export function assertMessagesReconciled(result: BackfillResult): void {
  if (!result.ran) return;

  const failures: string[] = [];

  for (const [source, s] of Object.entries(result.sourceCounts)) {
    if (s.balanced) continue;
    failures.push(
      `${source}: ${s.legacy} legacy row(s) but ${s.inserted} inserted + ` +
        `${s.alreadyPresent} already present + ${s.orphansSkipped} orphan(s) skipped ` +
        `= ${s.inserted + s.alreadyPresent + s.orphansSkipped}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      "Messages backfill did not reconcile (OI-099). Refusing to start: the app " +
        "would run normally and show empty comment threads, notification lists and " +
        "feedback boards with no error of any kind.\n" +
        failures.map((f) => `  - ${f}`).join("\n") +
        "\nThe legacy tables are intact. Restore from a backup and investigate, or " +
        "run `npm run db:backfill-messages -- --dry-run` for detail.",
    );
  }
}
