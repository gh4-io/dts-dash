import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { eq, sql, and, isNull, or, gt } from "drizzle-orm";
import { getSessionUserId } from "@/lib/utils/session-helpers";

/**
 * GET /api/notifications/unread-count
 * Lightweight endpoint for badge polling — returns just the unread count.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getSessionUserId(session);
    const now = new Date().toISOString();

    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          or(isNull(notifications.expiresAt), gt(notifications.expiresAt, now)),
        ),
      )
      .get();

    return NextResponse.json({ count: result?.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
