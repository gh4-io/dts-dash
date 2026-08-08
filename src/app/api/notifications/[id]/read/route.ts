import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { markNotificationRead } from "@/lib/messages/repository";

const log = createChildLogger("api/notifications/read");

/**
 * PATCH /api/notifications/[id]/read
 * Mark a single notification as read.
 *
 * The repository scopes the update by kind AND recipient, so neither another
 * user's notification nor a message of a different kind can be marked through
 * this route (OI-099).
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

    const updated = markNotificationRead(numId, getSessionUserId(session));
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
