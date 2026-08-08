/**
 * Message repository — the single place every `kind` filter lives (OI-099).
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * v1.0.0 folded four tables into one `messages` table discriminated by `kind`.
 * That makes a forgotten `kind` filter the top silent-failure risk in the app:
 * omit it and notifications appear inside a comment thread, or "mark all read"
 * quietly marks every comment in the database as read. Neither throws. Neither
 * logs. Both look like working code.
 *
 * The mitigation is that no route may query `messages` directly. Every
 * `eq(messages.kind, …)` in the codebase is in this file, routes are thin
 * callers, and the per-kind partial indexes (see schema-init.ts) only work when
 * that filter is present — so correctness and performance fail together, loudly,
 * rather than performance degrading on its own.
 *
 * ── API contract types are unchanged ────────────────────────────────────────
 *
 * `FlightComment`, `AppNotification` and everything in types/feedback.ts kept
 * their pre-merge shape. This file maps between the DB row and those types at
 * the boundary, which is what leaves all the UI untouched. Do not let the DB
 * shape (kind / subject_id / recipient_id / root_id / msg_type) leak past here.
 */

import { db } from "@/lib/db/client";
import { messages, labels, messageLabels, users, workPackages } from "@/lib/db/schema";
import { eq, and, or, asc, desc, isNull, gt, sql, inArray } from "drizzle-orm";
import type {
  FlightComment,
  AppNotification,
  NotificationType,
  NotificationCategory,
} from "@/types";
import type {
  FeedbackLabel,
  FeedbackPost,
  FeedbackComment,
  FeedbackPostDetail,
  FeedbackStatus,
} from "@/types/feedback";

/** Subject type for messages attached to a work package. */
const SUBJECT_WORK_PACKAGE = "work_package";

// ═══════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Delete a message and every descendant, walking the tree explicitly.
 *
 * `parent_id` carries ON DELETE CASCADE, so with `foreign_keys = ON` the database
 * would do this too. We walk it anyway: the pragma is per-connection, and a
 * subtree delete that silently degrades to a single-row delete when some other
 * connection forgets the pragma is exactly the class of bug this migration is
 * meant to remove.
 *
 * Behaviour change from v0.3.0, deliberate: flight comment deletion used to run
 * two flat DELETEs and so removed only ONE level of replies, orphaning anything
 * deeper. It now removes the full subtree, matching what feedback comments always
 * did. That fixes the orphaning defect noted on OI-092.
 */
export function deleteMessageSubtree(id: number): number {
  let deleted = 0;
  const children = db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.parentId, id))
    .all();

  for (const child of children) {
    deleted += deleteMessageSubtree(child.id);
  }

  deleted += db.delete(messages).where(eq(messages.id, id)).run().changes;
  return deleted;
}

// ═══════════════════════════════════════════════════════════════════════════
// Flight comments  (kind = 'flight_comment')
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All comments on a work package, flat and oldest-first. The client builds the
 * tree, as it always has.
 *
 * `workPackageId` is the internal work_packages.id, not the SharePoint sp_id —
 * callers resolve that first (see resolveWpId in the route).
 */
export function listFlightComments(workPackageId: number): FlightComment[] {
  const rows = db
    .select({
      id: messages.id,
      subjectId: messages.subjectId,
      parentId: messages.parentId,
      authorId: messages.authorId,
      authorName: users.displayName,
      body: messages.body,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(
      and(
        eq(messages.kind, "flight_comment"),
        eq(messages.subjectType, SUBJECT_WORK_PACKAGE),
        eq(messages.subjectId, workPackageId),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .all();

  return rows.map(toFlightComment);
}

/** One comment, scoped to its work package so a mismatched pair returns null. */
export function getFlightComment(
  id: number,
  workPackageId: number,
): { id: number; authorId: number | null } | null {
  const row = db
    .select({ id: messages.id, authorId: messages.authorId })
    .from(messages)
    .where(
      and(
        eq(messages.kind, "flight_comment"),
        eq(messages.id, id),
        eq(messages.subjectId, workPackageId),
      ),
    )
    .get();

  return row ?? null;
}

export function createFlightComment(opts: {
  workPackageId: number;
  authorId: number;
  body: string;
  parentId?: number | null;
}): FlightComment | null {
  const now = new Date().toISOString();
  const parentId = opts.parentId ?? null;

  // A reply inherits its parent's thread root; a top-level comment becomes its
  // own root once it has an id (set in the follow-up update below).
  let rootId: number | null = null;
  if (parentId != null) {
    const parent = db
      .select({ id: messages.id, rootId: messages.rootId })
      .from(messages)
      .where(and(eq(messages.kind, "flight_comment"), eq(messages.id, parentId)))
      .get();
    rootId = parent?.rootId ?? parent?.id ?? null;
  }

  const inserted = db
    .insert(messages)
    .values({
      kind: "flight_comment",
      parentId,
      rootId,
      subjectType: SUBJECT_WORK_PACKAGE,
      subjectId: opts.workPackageId,
      authorId: opts.authorId,
      body: opts.body,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: messages.id })
    .get();

  if (rootId == null) {
    db.update(messages).set({ rootId: inserted.id }).where(eq(messages.id, inserted.id)).run();
  }

  const row = db
    .select({
      id: messages.id,
      subjectId: messages.subjectId,
      parentId: messages.parentId,
      authorId: messages.authorId,
      authorName: users.displayName,
      body: messages.body,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.kind, "flight_comment"), eq(messages.id, inserted.id)))
    .get();

  return row ? toFlightComment(row) : null;
}

/** Distinct authors on a work package's thread, excluding one user. */
export function flightCommentParticipants(workPackageId: number, excludeUserId: number): number[] {
  const rows = db
    .selectDistinct({ authorId: messages.authorId })
    .from(messages)
    .where(
      and(
        eq(messages.kind, "flight_comment"),
        eq(messages.subjectType, SUBJECT_WORK_PACKAGE),
        eq(messages.subjectId, workPackageId),
      ),
    )
    .all();

  return rows
    .map((r) => r.authorId)
    .filter((id): id is number => id != null && id !== excludeUserId);
}

/**
 * Comment counts keyed by SharePoint sp_id.
 *
 * Both /api/work-packages and /api/work-packages/all had their own copy of this
 * subquery in raw SQL. They are folded into this one call — a duplicated query is
 * a duplicated place to forget the `kind` filter.
 */
export function flightCommentCountsBySpId(): Map<number, number> {
  const rows = db
    .select({ spId: workPackages.spId, count: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(workPackages, eq(workPackages.id, messages.subjectId))
    .where(and(eq(messages.kind, "flight_comment"), eq(messages.subjectType, SUBJECT_WORK_PACKAGE)))
    .groupBy(workPackages.spId)
    .all();

  const map = new Map<number, number>();
  for (const r of rows) {
    if (r.spId != null) map.set(r.spId, r.count);
  }
  return map;
}

/**
 * Delete every flight comment attached to the given work packages.
 *
 * v0.3.0 got this for free: flight_comments.work_package_id was a real FK with
 * ON DELETE CASCADE. `subject_id` is polymorphic and cannot carry an FK, so the
 * cleanup is now explicit and callers that delete work packages must invoke it.
 */
export function deleteFlightCommentsForWorkPackages(workPackageIds: number[]): number {
  if (workPackageIds.length === 0) return 0;

  return db
    .delete(messages)
    .where(
      and(
        eq(messages.kind, "flight_comment"),
        eq(messages.subjectType, SUBJECT_WORK_PACKAGE),
        inArray(messages.subjectId, workPackageIds),
      ),
    )
    .run().changes;
}

function toFlightComment(row: {
  id: number;
  subjectId: number | null;
  parentId: number | null;
  authorId: number | null;
  authorName: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}): FlightComment {
  return {
    id: row.id,
    workPackageId: row.subjectId ?? 0,
    parentId: row.parentId,
    authorId: row.authorId ?? 0,
    authorName: row.authorName,
    body: row.body ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Notifications  (kind = 'notification')
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Not-expired notifications belonging to a recipient.
 *
 * The `kind` filter is not optional here — it is what lets SQLite use
 * idx_messages_notif_unread / idx_messages_notif_created, and what stops a
 * comment from being returned as a notification.
 */
function notificationScope(userId: number, now: string) {
  return and(
    eq(messages.kind, "notification"),
    eq(messages.recipientId, userId),
    or(isNull(messages.expiresAt), gt(messages.expiresAt, now)),
  );
}

export function listNotifications(
  userId: number,
  opts: { page: number; limit: number },
): { items: AppNotification[]; total: number; unreadCount: number } {
  const now = new Date().toISOString();
  const scope = notificationScope(userId, now);

  const total =
    db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(scope)
      .get()?.count ?? 0;

  const unreadCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(scope, isNull(messages.readAt)))
      .get()?.count ?? 0;

  const rows = db
    .select()
    .from(messages)
    .where(scope)
    .orderBy(desc(messages.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit)
    .all();

  return { items: rows.map(toAppNotification), total, unreadCount };
}

/**
 * Unread badge count.
 *
 * This is the hottest query in the app — notification-bell.tsx polls it on an
 * interval for every logged-in client. It must resolve through the partial index
 * idx_messages_notif_unread ON messages(recipient_id, read_at) WHERE kind =
 * 'notification'. Keep the literal `kind` equality or that index stops applying.
 */
export function unreadNotificationCount(userId: number): number {
  const now = new Date().toISOString();
  return (
    db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(notificationScope(userId, now), isNull(messages.readAt)))
      .get()?.count ?? 0
  );
}

export function markNotificationRead(id: number, userId: number): AppNotification | null {
  const updated = db
    .update(messages)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(eq(messages.kind, "notification"), eq(messages.id, id), eq(messages.recipientId, userId)),
    )
    .returning()
    .get();

  return updated ? toAppNotification(updated) : null;
}

/**
 * Mark every unread notification read for a user.
 *
 * ⚠️ The `kind` filter is load-bearing. Without it this statement stamps
 * `read_at` on that user's flight comments and feedback posts too — they share
 * the column now.
 */
export function markAllNotificationsRead(userId: number): number {
  return db
    .update(messages)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(messages.kind, "notification"),
        eq(messages.recipientId, userId),
        isNull(messages.readAt),
      ),
    )
    .run().changes;
}

export interface CreateNotificationOpts {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  actionUrl?: string | null;
  expiresAt?: string | null;
}

/** One row per recipient — notifications are a fan-out, not a shared row. */
export function insertNotifications(userIds: number[], opts: CreateNotificationOpts): void {
  if (userIds.length === 0) return;

  const now = new Date().toISOString();
  const metadataStr = opts.metadata ? JSON.stringify(opts.metadata) : null;

  for (const uid of userIds) {
    db.insert(messages)
      .values({
        kind: "notification",
        recipientId: uid,
        msgType: opts.type,
        category: opts.category,
        title: opts.title,
        body: opts.message?.trim() || null,
        metadata: metadataStr,
        actionUrl: opts.actionUrl || null,
        expiresAt: opts.expiresAt || null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

/** DB row → the unchanged AppNotification API contract. */
function toAppNotification(row: typeof messages.$inferSelect): AppNotification {
  return {
    id: row.id,
    userId: row.recipientId ?? 0,
    type: (row.msgType ?? "system") as NotificationType,
    category: (row.category ?? "general") as NotificationCategory,
    title: row.title ?? "",
    message: row.body,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    readAt: row.readAt,
    actionUrl: row.actionUrl,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Feedback posts  (kind = 'feedback_post')  and comments  (kind = 'feedback_comment')
// ═══════════════════════════════════════════════════════════════════════════
//
// A feedback_post is its own thread root (root_id = id). Its comments carry
// root_id = the post's id, so "every comment on this post" is one indexed
// equality rather than a recursive walk, and deleting a post is one statement.

export function listFeedbackPosts(opts: {
  status?: FeedbackStatus | null;
  labelId?: number | null;
  page: number;
  limit: number;
}): { posts: FeedbackPost[]; total: number } {
  const conditions = [eq(messages.kind, "feedback_post")];

  if (opts.status) conditions.push(eq(messages.status, opts.status));

  if (opts.labelId != null) {
    const labelled = db
      .select({ messageId: messageLabels.messageId })
      .from(messageLabels)
      .where(eq(messageLabels.labelId, opts.labelId))
      .all()
      .map((r) => r.messageId);

    if (labelled.length === 0) return { posts: [], total: 0 };
    conditions.push(inArray(messages.id, labelled));
  }

  const where = and(...conditions);

  const total =
    db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(where)
      .get()?.count ?? 0;

  const rows = db
    .select({
      id: messages.id,
      authorId: messages.authorId,
      authorName: users.displayName,
      title: messages.title,
      body: messages.body,
      status: messages.status,
      isPinned: messages.isPinned,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(where)
    .orderBy(desc(messages.isPinned), desc(messages.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit)
    .all();

  const postIds = rows.map((r) => r.id);
  const labelsByPost = labelsForMessages(postIds);
  const counts = feedbackCommentCounts(postIds);

  const posts: FeedbackPost[] = rows.map((r) => ({
    id: r.id,
    authorId: r.authorId ?? 0,
    authorName: r.authorName,
    title: r.title ?? "",
    body: r.body ?? "",
    status: (r.status ?? "open") as FeedbackStatus,
    isPinned: r.isPinned,
    labels: labelsByPost.get(r.id) ?? [],
    commentCount: counts.get(r.id) ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { posts, total };
}

export function getFeedbackPostDetail(id: number): FeedbackPostDetail | null {
  const post = db
    .select({
      id: messages.id,
      authorId: messages.authorId,
      authorName: users.displayName,
      title: messages.title,
      body: messages.body,
      status: messages.status,
      isPinned: messages.isPinned,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.kind, "feedback_post"), eq(messages.id, id)))
    .get();

  if (!post) return null;

  const rawComments = db
    .select({
      id: messages.id,
      rootId: messages.rootId,
      parentId: messages.parentId,
      authorId: messages.authorId,
      authorName: users.displayName,
      body: messages.body,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.kind, "feedback_comment"), eq(messages.rootId, id)))
    .orderBy(asc(messages.createdAt))
    .all();

  // Build the reply tree; shape matches the pre-merge API exactly.
  const nodeMap = new Map<number, FeedbackComment>();
  for (const c of rawComments) {
    nodeMap.set(c.id, {
      id: c.id,
      postId: c.rootId ?? id,
      parentId: c.parentId,
      authorId: c.authorId ?? 0,
      authorName: c.authorName,
      body: c.body ?? "",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      replies: [],
    });
  }

  const topLevel: FeedbackComment[] = [];
  for (const c of rawComments) {
    const node = nodeMap.get(c.id)!;
    if (c.parentId != null && nodeMap.has(c.parentId)) {
      nodeMap.get(c.parentId)!.replies.push(node);
    } else {
      topLevel.push(node);
    }
  }

  return {
    id: post.id,
    authorId: post.authorId ?? 0,
    authorName: post.authorName,
    title: post.title ?? "",
    body: post.body ?? "",
    status: (post.status ?? "open") as FeedbackStatus,
    isPinned: post.isPinned,
    labels: labelsForMessages([id]).get(id) ?? [],
    commentCount: rawComments.length,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    comments: topLevel,
  };
}

/** Minimal row for ownership checks, without pulling the whole post. */
export function getFeedbackPostOwner(id: number): { id: number; authorId: number | null } | null {
  return (
    db
      .select({ id: messages.id, authorId: messages.authorId })
      .from(messages)
      .where(and(eq(messages.kind, "feedback_post"), eq(messages.id, id)))
      .get() ?? null
  );
}

export function createFeedbackPost(opts: {
  authorId: number;
  title: string;
  body: string;
}): number {
  const now = new Date().toISOString();

  const inserted = db
    .insert(messages)
    .values({
      kind: "feedback_post",
      authorId: opts.authorId,
      title: opts.title,
      body: opts.body,
      status: "open",
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: messages.id })
    .get();

  // A post is its own thread root. Set after insert because a self-referencing
  // FK cannot be satisfied by the same statement that creates the row.
  db.update(messages).set({ rootId: inserted.id }).where(eq(messages.id, inserted.id)).run();

  return inserted.id;
}

export function updateFeedbackPost(
  id: number,
  updates: {
    title?: string;
    body?: string;
    status?: FeedbackStatus;
    isPinned?: boolean;
  },
): void {
  db.update(messages)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(and(eq(messages.kind, "feedback_post"), eq(messages.id, id)))
    .run();
}

/**
 * Delete a post and its whole comment thread.
 *
 * v0.3.0 leaned on ON DELETE CASCADE from feedback_posts. Under self-referential
 * FKs that is a chain of cascades whose depth depends on the reply tree and whose
 * behaviour depends on a per-connection pragma. Deleting by `root_id` is one
 * statement, covers the post itself (its root is itself) and every descendant at
 * any depth, and does not care whether foreign keys are enforced.
 */
export function deleteFeedbackPostThread(id: number): number {
  return db.delete(messages).where(eq(messages.rootId, id)).run().changes;
}

export function setFeedbackPostLabels(postId: number, labelIds: number[]): void {
  db.delete(messageLabels).where(eq(messageLabels.messageId, postId)).run();
  for (const labelId of labelIds) {
    db.insert(messageLabels).values({ messageId: postId, labelId }).onConflictDoNothing().run();
  }
}

export function createFeedbackComment(opts: {
  postId: number;
  parentId?: number | null;
  authorId: number;
  body: string;
}): number {
  const now = new Date().toISOString();

  const inserted = db
    .insert(messages)
    .values({
      kind: "feedback_comment",
      parentId: opts.parentId ?? null,
      rootId: opts.postId,
      authorId: opts.authorId,
      body: opts.body,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: messages.id })
    .get();

  return inserted.id;
}

export function getFeedbackComment(
  id: number,
): { id: number; postId: number | null; authorId: number | null } | null {
  const row = db
    .select({ id: messages.id, rootId: messages.rootId, authorId: messages.authorId })
    .from(messages)
    .where(and(eq(messages.kind, "feedback_comment"), eq(messages.id, id)))
    .get();

  return row ? { id: row.id, postId: row.rootId, authorId: row.authorId } : null;
}

export function updateFeedbackComment(id: number, body: string): void {
  db.update(messages)
    .set({ body, updatedAt: new Date().toISOString() })
    .where(and(eq(messages.kind, "feedback_comment"), eq(messages.id, id)))
    .run();
}

function feedbackCommentCounts(postIds: number[]): Map<number, number> {
  const map = new Map<number, number>();
  if (postIds.length === 0) return map;

  const rows = db
    .select({ rootId: messages.rootId, count: sql<number>`count(*)` })
    .from(messages)
    .where(and(eq(messages.kind, "feedback_comment"), inArray(messages.rootId, postIds)))
    .groupBy(messages.rootId)
    .all();

  for (const r of rows) {
    if (r.rootId != null) map.set(r.rootId, r.count);
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════
// Labels
// ═══════════════════════════════════════════════════════════════════════════
//
// Labels are their own table, not a message kind — see the rationale in
// schema-init.ts. No `kind` filter applies here, which is part of the point.

export function listLabels(): FeedbackLabel[] {
  return db
    .select({
      id: labels.id,
      name: labels.name,
      color: labels.color,
      sortOrder: labels.sortOrder,
      createdAt: labels.createdAt,
    })
    .from(labels)
    .orderBy(asc(labels.sortOrder), asc(labels.name))
    .all();
}

export function getLabel(id: number): FeedbackLabel | null {
  return (
    db
      .select({
        id: labels.id,
        name: labels.name,
        color: labels.color,
        sortOrder: labels.sortOrder,
        createdAt: labels.createdAt,
      })
      .from(labels)
      .where(eq(labels.id, id))
      .get() ?? null
  );
}

export function createLabel(opts: { name: string; color: string; sortOrder?: number }): number {
  return db
    .insert(labels)
    .values({
      name: opts.name,
      color: opts.color,
      sortOrder: opts.sortOrder ?? 0,
      createdAt: new Date().toISOString(),
    })
    .returning({ id: labels.id })
    .get().id;
}

export function updateLabel(
  id: number,
  updates: { name?: string; color?: string; sortOrder?: number },
): void {
  db.update(labels).set(updates).where(eq(labels.id, id)).run();
}

export function deleteLabel(id: number): void {
  // message_labels.label_id cascades, so the join rows go with it.
  db.delete(labels).where(eq(labels.id, id)).run();
}

/** Labels attached to each of the given messages. */
function labelsForMessages(messageIds: number[]): Map<number, FeedbackLabel[]> {
  const map = new Map<number, FeedbackLabel[]>();
  if (messageIds.length === 0) return map;

  const rows = db
    .select({
      messageId: messageLabels.messageId,
      id: labels.id,
      name: labels.name,
      color: labels.color,
      sortOrder: labels.sortOrder,
      createdAt: labels.createdAt,
    })
    .from(messageLabels)
    .innerJoin(labels, eq(messageLabels.labelId, labels.id))
    .where(inArray(messageLabels.messageId, messageIds))
    .orderBy(asc(labels.sortOrder), asc(labels.name))
    .all();

  for (const r of rows) {
    const list = map.get(r.messageId);
    const label: FeedbackLabel = {
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
    };
    if (list) list.push(label);
    else map.set(r.messageId, [label]);
  }

  return map;
}
