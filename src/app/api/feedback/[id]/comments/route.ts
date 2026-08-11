import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import {
  getFeedbackPostOwner,
  getFeedbackComment,
  createFeedbackComment,
} from "@/lib/messages/repository";

const log = createChildLogger("api/feedback/[id]/comments");

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/feedback/[id]/comments
 * Add a comment to a post.
 *
 * Comments are `messages` rows with kind = 'feedback_comment' and root_id = the
 * post's id (OI-099). The post IS its own thread root, which is what makes
 * "every comment on this post" a single indexed equality.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = parseIntParam(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
    }

    // Verify the post exists — and that it really is a post, not some other kind
    // of message that happens to share the id.
    if (!getFeedbackPostOwner(id)) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const body = await request.json();
    const commentBody = (body.body || "").trim();
    const parentId = body.parentId != null ? Number(body.parentId) : null;

    if (!commentBody || commentBody.length > 5000) {
      return NextResponse.json(
        { error: "Comment body is required and must be 5,000 characters or less" },
        { status: 400 },
      );
    }

    // Validate parentId is a feedback comment on this same post.
    if (parentId) {
      const parent = getFeedbackComment(parentId);
      if (!parent || parent.postId !== id) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const commentId = createFeedbackComment({
      postId: id,
      parentId,
      authorId: getSessionUserId(session),
      body: commentBody,
    });

    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
