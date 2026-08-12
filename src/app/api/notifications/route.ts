import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { listNotifications } from "@/lib/messages/repository";

const log = createChildLogger("api/notifications");

/**
 * GET /api/notifications
 * List notifications for the current user (paginated, newest first).
 *
 * The kind/recipient/expiry scoping and the metadata JSON parse live in the
 * repository (OI-099) — this route only reads query params. Response shape is
 * unchanged from v0.3.0.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getSessionUserId(session);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const { items, total, unreadCount } = listNotifications(userId, { page, limit });

    return NextResponse.json({ notifications: items, total, unreadCount, page, limit });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
