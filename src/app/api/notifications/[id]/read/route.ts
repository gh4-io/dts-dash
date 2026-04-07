import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { parseIntParam } from "@/lib/utils/route-helpers";

const log = createChildLogger("api/notifications/read");

/**
 * PATCH /api/notifications/[id]/read
 * Mark a single notification as read.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const userId = getSessionUserId(session);
    const now = new Date().toISOString();

    const updated = db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.id, numId), eq(notifications.userId, userId)))
      .returning()
      .get();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      metadata: updated.metadata ? JSON.parse(updated.metadata) : null,
    });
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
