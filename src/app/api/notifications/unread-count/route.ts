import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { unreadNotificationCount } from "@/lib/messages/repository";

/**
 * GET /api/notifications/unread-count
 * Lightweight endpoint for badge polling — returns just the unread count.
 *
 * This is the hottest query in the app: notification-bell.tsx polls it on an
 * interval for every logged-in client. The repository query is written to resolve
 * through the partial index idx_messages_notif_unread ON
 * messages(recipient_id, read_at) WHERE kind = 'notification' (OI-099).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ count: unreadNotificationCount(getSessionUserId(session)) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
