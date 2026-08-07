import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { eq, desc, sql, and, isNull, or, gt } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/notifications");

/**
 * GET /api/notifications
 * List notifications for the current user (paginated, newest first).
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
    const offset = (page - 1) * limit;
    const now = new Date().toISOString();

    // Filter: belongs to user AND not expired
    const baseWhere = and(
      eq(notifications.userId, userId),
      or(isNull(notifications.expiresAt), gt(notifications.expiresAt, now)),
    );

    const countResult = db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(baseWhere)
      .get();
    const total = countResult?.count ?? 0;

    const unreadResult = db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(baseWhere, isNull(notifications.readAt)))
      .get();
    const unreadCount = unreadResult?.count ?? 0;

    const rows = db
      .select()
      .from(notifications)
      .where(baseWhere)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    // Parse metadata JSON
    const items = rows.map((r) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    }));

    return NextResponse.json({ notifications: items, total, unreadCount, page, limit });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
