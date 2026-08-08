import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { workPackages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { createChildLogger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/create";
import {
  listFlightComments,
  getFlightComment,
  createFlightComment,
  deleteMessageSubtree,
  flightCommentParticipants,
} from "@/lib/messages/repository";

const log = createChildLogger("api/work-packages/comments");

/**
 * Resolve sp_id (client-facing) to internal auto-increment id.
 *
 * Kept as-is through the OI-099 rewrite: [id] in this route is the SharePoint ID,
 * and the messages table stores the internal work_packages.id in subject_id.
 * Conflating the two would attach comments to the wrong aircraft.
 *
 * Moved from raw SQL to Drizzle along with the rest of this route — raw SQL is
 * exactly what let the old table name stay invisible to tsc.
 */
function resolveWpId(spId: number): number | null {
  const row = db
    .select({ id: workPackages.id })
    .from(workPackages)
    .where(eq(workPackages.spId, spId))
    .get();
  return row?.id ?? null;
}

/**
 * GET /api/work-packages/[id]/comments
 * Fetch all comments for a work package, with author names.
 * Returns a flat list ordered by created_at ASC — the client builds the tree.
 *
 * Note: [id] is the SharePoint ID (sp_id), not the internal DB id.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const spId = Number(id);
    if (isNaN(spId) || spId < 1) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const internalId = resolveWpId(spId);
    if (!internalId) {
      return NextResponse.json({ error: "Work package not found" }, { status: 404 });
    }

    return NextResponse.json(listFlightComments(internalId));
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/work-packages/[id]/comments
 * Create a new comment (or reply) on a work package.
 * Body: { body: string, parentId?: number }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const spId = Number(id);
    if (isNaN(spId) || spId < 1) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const internalId = resolveWpId(spId);
    if (!internalId) {
      return NextResponse.json({ error: "Work package not found" }, { status: 404 });
    }

    const userId = getSessionUserId(session);
    const json = await request.json();
    const body = (json.body ?? "").trim();
    if (!body) {
      return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
    }

    const parentId = json.parentId != null ? Number(json.parentId) : null;

    // Validate parentId belongs to the same WP if provided. The repository scopes
    // this by kind and subject, so a notification id or a feedback comment id
    // cannot be smuggled in as a parent.
    if (parentId != null && !getFlightComment(parentId, internalId)) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
    }

    const comment = createFlightComment({
      workPackageId: internalId,
      authorId: userId,
      body,
      parentId,
    });

    if (!comment) {
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    // Notify other thread participants
    try {
      const participants = flightCommentParticipants(internalId, userId);

      if (participants.length > 0) {
        const wp = db
          .select({ aircraftReg: workPackages.aircraftReg })
          .from(workPackages)
          .where(eq(workPackages.id, internalId))
          .get();
        const reg = wp?.aircraftReg ?? "aircraft";

        createNotification(participants, {
          type: "comment",
          category: "flight",
          title: `New comment on ${reg}`,
          message: body.length > 100 ? body.slice(0, 100) + "..." : body,
          metadata: { workPackageId: internalId, spId, commentId: comment.id },
          actionUrl: "/flight-board",
        });
      }
    } catch (notifErr) {
      log.warn({ err: notifErr }, "Failed to create comment notifications");
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/work-packages/[id]/comments?commentId=123
 * Delete a comment. Only the author or admin/superadmin can delete.
 *
 * ⚠️ Behaviour change in v1.0.0 (OI-099), deliberate: this used to run two flat
 * DELETEs and so removed only ONE level of replies, orphaning anything nested
 * deeper. It now removes the full subtree, matching what feedback comments always
 * did. That fixes the orphaning defect recorded on OI-092.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const spId = Number(id);
    if (isNaN(spId) || spId < 1) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const internalId = resolveWpId(spId);
    if (!internalId) {
      return NextResponse.json({ error: "Work package not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = Number(searchParams.get("commentId"));
    if (isNaN(commentId) || commentId < 1) {
      return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
    }

    const userId = getSessionUserId(session);
    const isAdmin = ["admin", "superadmin"].includes(session.user.role);

    const comment = getFlightComment(commentId, internalId);

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.authorId !== userId && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    deleteMessageSubtree(commentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
