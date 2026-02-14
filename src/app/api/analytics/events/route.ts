import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { analyticsEvents } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { desc } from "drizzle-orm";
import { paginate, parsePaginationParams } from "@/lib/utils/pagination";

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
    await db.insert(analyticsEvents).values({
      id: nanoid(),
      userId: session.user.id,
      eventType,
      eventData: props ? JSON.stringify(props) : null,
      page: props?.page ?? null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/analytics/events] POST error:", error);
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
    const paginationParams = parsePaginationParams(searchParams);

    // Query events (most recent first)
    const events = await db
      .select()
      .from(analyticsEvents)
      .orderBy(desc(analyticsEvents.createdAt));

    // Paginate
    const result = paginate(events, paginationParams);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/analytics/events] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
