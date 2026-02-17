import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { feedbackComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

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

    const { commentId } = await context.params;

    const comment = db
      .select()
      .from(feedbackComments)
      .where(eq(feedbackComments.id, commentId))
      .get();

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.authorId !== session.user.id) {
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

    const { commentId } = await context.params;
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

    const isAuthor = comment.authorId === session.user.id;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    db.delete(feedbackComments).where(eq(feedbackComments.id, commentId)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
