import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  feedbackPosts,
  feedbackPostLabels,
  feedbackLabels,
  feedbackComments,
  users,
} from "@/lib/db/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import type { FeedbackStatus } from "@/types/feedback";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { parseIntParam } from "@/lib/utils/route-helpers";

const log = createChildLogger("api/feedback");

const VALID_STATUSES: FeedbackStatus[] = [
  "open",
  "under_review",
  "planned",
  "in_progress",
  "done",
  "wont_fix",
];

/**
 * GET /api/feedback
 * List posts with optional status/label filters and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const label = searchParams.get("label");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (status && VALID_STATUSES.includes(status as FeedbackStatus)) {
      conditions.push(eq(feedbackPosts.status, status as FeedbackStatus));
    }

    // If filtering by label, get matching post IDs first
    let labelPostIds: number[] | null = null;
    if (label) {
      const labelIdNum = parseIntParam(label);
      if (!labelIdNum) {
        return NextResponse.json({ posts: [], total: 0, page, limit });
      }
      const labelRows = db
        .select({ postId: feedbackPostLabels.postId })
        .from(feedbackPostLabels)
        .innerJoin(feedbackLabels, eq(feedbackPostLabels.labelId, feedbackLabels.id))
        .where(eq(feedbackLabels.id, labelIdNum))
        .all();
      labelPostIds = labelRows.map((r) => r.postId);
      if (labelPostIds.length === 0) {
        return NextResponse.json({ posts: [], total: 0, page, limit });
      }
      conditions.push(inArray(feedbackPosts.id, labelPostIds));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const countResult = db
      .select({ count: sql<number>`count(*)` })
      .from(feedbackPosts)
      .where(where)
      .get();
    const total = countResult?.count ?? 0;

    // Fetch posts
    const rows = db
      .select({
        id: feedbackPosts.id,
        authorId: feedbackPosts.authorId,
        authorName: users.displayName,
        title: feedbackPosts.title,
        body: feedbackPosts.body,
        status: feedbackPosts.status,
        isPinned: feedbackPosts.isPinned,
        createdAt: feedbackPosts.createdAt,
        updatedAt: feedbackPosts.updatedAt,
      })
      .from(feedbackPosts)
      .innerJoin(users, eq(feedbackPosts.authorId, users.id))
      .where(where)
      .orderBy(desc(feedbackPosts.isPinned), desc(feedbackPosts.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    // Fetch labels and comment counts for these posts
    const postIds = rows.map((r) => r.id);

    const labelsMap: Record<
      number,
      { id: number; name: string; color: string; sortOrder: number; createdAt: string }[]
    > = {};
    const commentCounts: Record<number, number> = {};

    if (postIds.length > 0) {
      const labelRows = db
        .select({
          postId: feedbackPostLabels.postId,
          labelId: feedbackLabels.id,
          labelName: feedbackLabels.name,
          labelColor: feedbackLabels.color,
          labelSortOrder: feedbackLabels.sortOrder,
          labelCreatedAt: feedbackLabels.createdAt,
        })
        .from(feedbackPostLabels)
        .innerJoin(feedbackLabels, eq(feedbackPostLabels.labelId, feedbackLabels.id))
        .where(inArray(feedbackPostLabels.postId, postIds))
        .all();

      for (const lr of labelRows) {
        if (!labelsMap[lr.postId]) labelsMap[lr.postId] = [];
        labelsMap[lr.postId].push({
          id: lr.labelId,
          name: lr.labelName,
          color: lr.labelColor,
          sortOrder: lr.labelSortOrder,
          createdAt: lr.labelCreatedAt,
        });
      }

      const commentRows = db
        .select({
          postId: feedbackComments.postId,
          count: sql<number>`count(*)`,
        })
        .from(feedbackComments)
        .where(inArray(feedbackComments.postId, postIds))
        .groupBy(feedbackComments.postId)
        .all();

      for (const cr of commentRows) {
        commentCounts[cr.postId] = cr.count;
      }
    }

    const posts = rows.map((r) => ({
      ...r,
      labels: labelsMap[r.id] || [],
      commentCount: commentCounts[r.id] || 0,
    }));

    return NextResponse.json({ posts, total, page, limit });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/feedback
 * Create a new post.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const title = (body.title || "").trim();
    const postBody = (body.body || "").trim();

    if (!title || title.length > 200) {
      return NextResponse.json(
        { error: "Title is required and must be 200 characters or less" },
        { status: 400 },
      );
    }
    if (!postBody || postBody.length > 10000) {
      return NextResponse.json(
        { error: "Body is required and must be 10,000 characters or less" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const userId = getSessionUserId(session);

    const newPost = db
      .insert(feedbackPosts)
      .values({
        authorId: userId,
        title,
        body: postBody,
        status: "open",
        isPinned: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: feedbackPosts.id })
      .get();

    return NextResponse.json({ id: newPost.id }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
