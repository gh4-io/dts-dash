import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/notifications/mark-all-read");

/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications as read for the current user.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getSessionUserId(session);
    const now = new Date().toISOString();

    const result = db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .run();

    return NextResponse.json({ updated: result.changes });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
