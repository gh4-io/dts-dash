import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { feedbackComments, feedbackPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/feedback/[id]/comments");

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/feedback/[id]/comments
 * Add a comment to a post.
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

    // Verify post exists
    const post = db
      .select({ id: feedbackPosts.id })
      .from(feedbackPosts)
      .where(eq(feedbackPosts.id, id))
      .get();

    if (!post) {
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

    // Validate parentId belongs to the same post
    if (parentId) {
      const parent = db
        .select({ id: feedbackComments.id, postId: feedbackComments.postId })
        .from(feedbackComments)
        .where(eq(feedbackComments.id, parentId))
        .get();
      if (!parent || parent.postId !== id) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const now = new Date().toISOString();
    const userId = getSessionUserId(session);

    const newComment = db
      .insert(feedbackComments)
      .values({
        postId: id,
        parentId,
        authorId: userId,
        body: commentBody,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: feedbackComments.id })
      .get();

    return NextResponse.json({ id: newComment.id }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
