import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db/client";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { createChildLogger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/create";

const log = createChildLogger("api/work-packages/comments");

/** Resolve sp_id (client-facing) to internal auto-increment id */
function resolveWpId(spId: number): number | null {
  const row = sqlite.prepare("SELECT id FROM work_packages WHERE sp_id = ?").get(spId) as
    | { id: number }
    | undefined;
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

    const comments = sqlite
      .prepare(
        `SELECT fc.id, fc.work_package_id AS workPackageId, fc.parent_id AS parentId,
                fc.author_id AS authorId, u.display_name AS authorName,
                fc.body, fc.created_at AS createdAt, fc.updated_at AS updatedAt
         FROM flight_comments fc
         JOIN users u ON u.id = fc.author_id
         WHERE fc.work_package_id = ?
         ORDER BY fc.created_at ASC`,
      )
      .all(internalId);

    return NextResponse.json(comments);
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

    // Validate parentId belongs to same WP if provided
    if (parentId != null) {
      const parent = sqlite
        .prepare("SELECT id FROM flight_comments WHERE id = ? AND work_package_id = ?")
        .get(parentId, internalId) as { id: number } | undefined;
      if (!parent) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const result = sqlite
      .prepare(
        `INSERT INTO flight_comments (work_package_id, parent_id, author_id, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(internalId, parentId, userId, body, now, now);

    const insertedId = result.lastInsertRowid;

    // Return the new comment with author name
    const comment = sqlite
      .prepare(
        `SELECT fc.id, fc.work_package_id AS workPackageId, fc.parent_id AS parentId,
                fc.author_id AS authorId, u.display_name AS authorName,
                fc.body, fc.created_at AS createdAt, fc.updated_at AS updatedAt
         FROM flight_comments fc
         JOIN users u ON u.id = fc.author_id
         WHERE fc.id = ?`,
      )
      .get(insertedId);

    // Notify other thread participants
    try {
      const participants = sqlite
        .prepare(
          `SELECT DISTINCT author_id FROM flight_comments WHERE work_package_id = ? AND author_id != ?`,
        )
        .all(internalId, userId) as { author_id: number }[];

      if (participants.length > 0) {
        const wp = sqlite
          .prepare("SELECT aircraft_reg FROM work_packages WHERE id = ?")
          .get(internalId) as { aircraft_reg: string } | undefined;
        const reg = wp?.aircraft_reg ?? "aircraft";

        createNotification(
          participants.map((p) => p.author_id),
          {
            type: "comment",
            category: "flight",
            title: `New comment on ${reg}`,
            message: body.length > 100 ? body.slice(0, 100) + "..." : body,
            metadata: { workPackageId: internalId, spId, commentId: Number(insertedId) },
            actionUrl: "/flight-board",
          },
        );
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

    const comment = sqlite
      .prepare("SELECT author_id FROM flight_comments WHERE id = ? AND work_package_id = ?")
      .get(commentId, internalId) as { author_id: number } | undefined;

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (comment.author_id !== userId && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the comment and any replies to it
    sqlite.prepare("DELETE FROM flight_comments WHERE parent_id = ?").run(commentId);
    sqlite.prepare("DELETE FROM flight_comments WHERE id = ?").run(commentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
