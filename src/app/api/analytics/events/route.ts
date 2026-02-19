import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { analyticsEvents } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 30;

const log = createChildLogger("api/analytics/events");

/**
 * POST /api/analytics/events
 * Track an analytics event
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      // Silently fail for unauthenticated (fire-and-forget)
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const body = await request.json();
    const { eventType, props } = body;

    if (!eventType) {
      return NextResponse.json({ error: "eventType required" }, { status: 400 });
    }

    // Insert event
    const userId = getSessionUserId(session);
    await db.insert(analyticsEvents).values({
      userId,
      eventType,
      eventData: props ? JSON.stringify(props) : null,
      page: props?.page ?? null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "POST error");
    // Silently fail - never block UI
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

/**
 * GET /api/analytics/events
 * Query analytics events (admin only, paginated)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSizeParam = parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, pageSizeParam));
    const offset = (page - 1) * pageSize;

    const [events, countResult] = await Promise.all([
      db
        .select()
        .from(analyticsEvents)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: sql<number>`COUNT(*)` }).from(analyticsEvents),
    ]);

    const total = countResult[0]?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      data: events,
      meta: {
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
