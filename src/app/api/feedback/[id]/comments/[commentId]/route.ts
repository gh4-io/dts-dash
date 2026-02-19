import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { feedbackComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { getSessionUserId } from "@/lib/utils/session-helpers";

/** Recursively delete a comment and all its replies. */
function deleteCommentTree(commentId: number): void {
  const children = db
    .select({ id: feedbackComments.id })
    .from(feedbackComments)
    .where(eq(feedbackComments.parentId, commentId))
    .all();
  for (const child of children) {
    deleteCommentTree(child.id);
  }
  db.delete(feedbackComments).where(eq(feedbackComments.id, commentId)).run();
}

const log = createChildLogger("api/feedback/[id]/comments/[commentId]");

type RouteContext = { params: Promise<{ id: string; commentId: string }> };

/**
 * PATCH /api/feedback/[id]/comments/[commentId]
 * Edit a comment (author only).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId: rawCommentId } = await context.params;
    const commentId = parseIntParam(rawCommentId);
    if (!commentId) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const comment = db
      .select()
      .from(feedbackComments)
      .where(eq(feedbackComments.id, commentId))
      .get();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const userId = getSessionUserId(session);
    if (comment.authorId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const commentBody = (body.body || "").trim();

    if (!commentBody || commentBody.length > 5000) {
      return NextResponse.json(
        { error: "Comment body is required and must be 5,000 characters or less" },
        { status: 400 },
      );
    }

    db.update(feedbackComments)
      .set({
        body: commentBody,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(feedbackComments.id, commentId))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback/[id]/comments/[commentId]
 * Delete a comment (author or admin).
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId: rawCommentId } = await context.params;
    const commentId = parseIntParam(rawCommentId);
    if (!commentId) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }
    const role = (session.user as unknown as { role: string }).role;
    const isAdmin = role === "admin" || role === "superadmin";

    const comment = db
      .select()
      .from(feedbackComments)
      .where(eq(feedbackComments.id, commentId))
      .get();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const userId = getSessionUserId(session);
    const isAuthor = comment.authorId === userId;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    deleteCommentTree(commentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
