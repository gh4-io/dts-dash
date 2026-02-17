import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { feedbackComments, feedbackPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

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

    const { id } = await context.params;

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

    if (!commentBody || commentBody.length > 5000) {
      return NextResponse.json(
        { error: "Comment body is required and must be 5,000 characters or less" },
        { status: 400 },
      );
    }

    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.insert(feedbackComments)
      .values({
        id: commentId,
        postId: id,
        authorId: session.user.id,
        body: commentBody,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
