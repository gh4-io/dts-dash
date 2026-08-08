import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import type { FeedbackStatus } from "@/types/feedback";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { listFeedbackPosts, createFeedbackPost } from "@/lib/messages/repository";

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
 *
 * Posts are `messages` rows with kind = 'feedback_post' since v1.0.0 (OI-099);
 * the kind filter, the label join and the comment counts all live in the
 * repository. Response shape is unchanged.
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

    let labelId: number | null = null;
    if (label) {
      labelId = parseIntParam(label) ?? null;
      if (!labelId) {
        return NextResponse.json({ posts: [], total: 0, page, limit });
      }
    }

    const { posts, total } = listFeedbackPosts({
      status:
        status && VALID_STATUSES.includes(status as FeedbackStatus)
          ? (status as FeedbackStatus)
          : null,
      labelId,
      page,
      limit,
    });

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

    const id = createFeedbackPost({
      authorId: getSessionUserId(session),
      title,
      body: postBody,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
