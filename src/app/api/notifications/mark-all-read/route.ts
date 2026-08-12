import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { markAllNotificationsRead } from "@/lib/messages/repository";

const log = createChildLogger("api/notifications/mark-all-read");

/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications as read for the current user.
 *
 * ⚠️ Since v1.0.0 `read_at` is shared by every message kind, so this statement's
 * WHERE clause MUST carry `kind = 'notification'` — otherwise it stamps the
 * user's flight comments and feedback posts as read too. That filter lives in
 * markAllNotificationsRead (OI-099).
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ updated: markAllNotificationsRead(getSessionUserId(session)) });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
