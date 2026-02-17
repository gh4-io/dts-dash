import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  feedbackPosts,
  feedbackComments,
  feedbackPostLabels,
  feedbackLabels,
  users,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import type { FeedbackStatus } from "@/types/feedback";

const log = createChildLogger("api/feedback/[id]");

const VALID_STATUSES: FeedbackStatus[] = [
  "open",
  "under_review",
  "planned",
  "in_progress",
  "done",
  "wont_fix",
];

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/feedback/[id]
 * Get post detail with comments and labels.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const post = db
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
      .where(eq(feedbackPosts.id, id))
      .get();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Labels
    const labels = db
      .select({
        id: feedbackLabels.id,
        name: feedbackLabels.name,
        color: feedbackLabels.color,
        sortOrder: feedbackLabels.sortOrder,
        createdAt: feedbackLabels.createdAt,
      })
      .from(feedbackPostLabels)
      .innerJoin(feedbackLabels, eq(feedbackPostLabels.labelId, feedbackLabels.id))
      .where(eq(feedbackPostLabels.postId, id))
      .all();

    // Comments
    const comments = db
      .select({
        id: feedbackComments.id,
        postId: feedbackComments.postId,
        authorId: feedbackComments.authorId,
        authorName: users.displayName,
        body: feedbackComments.body,
        createdAt: feedbackComments.createdAt,
        updatedAt: feedbackComments.updatedAt,
      })
      .from(feedbackComments)
      .innerJoin(users, eq(feedbackComments.authorId, users.id))
      .where(eq(feedbackComments.postId, id))
      .orderBy(asc(feedbackComments.createdAt))
      .all();

    return NextResponse.json({
      ...post,
      labels,
      comments,
      commentCount: comments.length,
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/feedback/[id]
 * Edit body (author), or status/labels/pin (admin).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const role = (session.user as unknown as { role: string }).role;
    const isAdmin = role === "admin" || role === "superadmin";

    const post = db.select().from(feedbackPosts).where(eq(feedbackPosts.id, id)).get();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const isAuthor = post.authorId === session.user.id;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    // Author can edit title and body
    if (isAuthor) {
      if (body.title !== undefined) {
        const title = (body.title || "").trim();
        if (!title || title.length > 200) {
          return NextResponse.json({ error: "Title must be 1-200 characters" }, { status: 400 });
        }
        updates.title = title;
      }
      if (body.body !== undefined) {
        const postBody = (body.body || "").trim();
        if (!postBody || postBody.length > 10000) {
          return NextResponse.json({ error: "Body must be 1-10,000 characters" }, { status: 400 });
        }
        updates.body = postBody;
      }
    }

    // Admin can change status, pin, labels
    if (isAdmin) {
      if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(body.status)) {
          return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        updates.status = body.status;
      }
      if (body.isPinned !== undefined) {
        updates.isPinned = !!body.isPinned;
      }
      if (body.labelIds !== undefined) {
        if (!Array.isArray(body.labelIds)) {
          return NextResponse.json({ error: "labelIds must be an array" }, { status: 400 });
        }
        // Replace all labels
        db.delete(feedbackPostLabels).where(eq(feedbackPostLabels.postId, id)).run();
        for (const labelId of body.labelIds) {
          db.insert(feedbackPostLabels).values({ postId: id, labelId }).run();
        }
      }
    }

    db.update(feedbackPosts).set(updates).where(eq(feedbackPosts.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback/[id]
 * Delete post (author or admin). CASCADE deletes comments + label associations.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const role = (session.user as unknown as { role: string }).role;
    const isAdmin = role === "admin" || role === "superadmin";

    const post = db.select().from(feedbackPosts).where(eq(feedbackPosts.id, id)).get();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const isAuthor = post.authorId === session.user.id;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    db.delete(feedbackPosts).where(eq(feedbackPosts.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
