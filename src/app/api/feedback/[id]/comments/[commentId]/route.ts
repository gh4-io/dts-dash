import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import {
  getFeedbackComment,
  updateFeedbackComment,
  deleteMessageSubtree,
} from "@/lib/messages/repository";

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

    const comment = getFeedbackComment(commentId);
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

    updateFeedbackComment(commentId, commentBody);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback/[id]/comments/[commentId]
 * Delete a comment and all of its replies (author or admin).
 *
 * The recursive walk that used to be local to this file is now
 * deleteMessageSubtree in the repository, shared with flight comments — which is
 * how flight comments picked up full-subtree deletion in v1.0.0 (OI-099).
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

    const comment = getFeedbackComment(commentId);
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const userId = getSessionUserId(session);
    const isAuthor = comment.authorId === userId;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    deleteMessageSubtree(commentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
