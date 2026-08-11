import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import type { FeedbackStatus } from "@/types/feedback";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import {
  getFeedbackPostDetail,
  getFeedbackPostOwner,
  updateFeedbackPost,
  deleteFeedbackPostThread,
  setFeedbackPostLabels,
} from "@/lib/messages/repository";

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
 *
 * ⚠️ v1.0.0 BREAKING: post ids were remapped when the tables merged (OI-099), so
 * a pre-v1.0.0 /feedback/[id] denotes a different post, or none.
 *
 * This route takes the id literally and 404s on a miss — it is the data API, and
 * silently answering with a different post than the one asked for is worse than
 * saying no. Recovery belongs to the page: it calls resolveFeedbackPostId(),
 * which falls back to messages.legacy_id, and redirects to the canonical URL
 * (OI-140). So old links do keep working; they just get corrected first.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
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

    const detail = getFeedbackPostDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/feedback/[id]
 * Edit title/body (author), or status/labels/pin (admin).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const role = (session.user as unknown as { role: string }).role;
    const isAdmin = role === "admin" || role === "superadmin";

    const post = getFeedbackPostOwner(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const userId = getSessionUserId(session);
    const isAuthor = post.authorId === userId;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates: { title?: string; body?: string; status?: FeedbackStatus; isPinned?: boolean } =
      {};

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
        setFeedbackPostLabels(id, body.labelIds);
      }
    }

    updateFeedbackPost(id, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback/[id]
 * Delete post (author or admin), together with its whole comment thread.
 *
 * v0.3.0 relied on ON DELETE CASCADE from feedback_posts. Under the unified
 * self-referential FKs that becomes a cascade chain whose depth follows the reply
 * tree and whose behaviour depends on a per-connection pragma, so the repository
 * deletes explicitly by root_id instead (OI-099). Label links go with the post via
 * message_labels' own cascade.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
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
    const role = (session.user as unknown as { role: string }).role;
    const isAdmin = role === "admin" || role === "superadmin";

    const post = getFeedbackPostOwner(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const userId = getSessionUserId(session);
    const isAuthor = post.authorId === userId;
    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    deleteFeedbackPostThread(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
