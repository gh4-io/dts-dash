import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/analytics/summary");

/**
 * GET /api/analytics/summary
 * Returns aggregated analytics data for the admin dashboard.
 * Admin-only endpoint.
 * Query params: timeRange=7d|30d (default 7d)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") === "30d" ? 30 : 7;

    // Calculate cutoff date
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeRange);
    const cutoffISO = cutoff.toISOString();

    // Active users (distinct user_id in range)
    const activeUsersResult = db.all<{ count: number }>(
      sql`SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE created_at >= ${cutoffISO}`
    );
    const activeUsers = activeUsersResult[0]?.count ?? 0;

    // Page views in range
    const pageViewsResult = db.all<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ${cutoffISO}`
    );
    const pageViews = pageViewsResult[0]?.count ?? 0;

    // Data imports in range
    const dataImportsResult = db.all<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'data_import' AND created_at >= ${cutoffISO}`
    );
    const dataImports = dataImportsResult[0]?.count ?? 0;

    // Errors in range
    const errorsResult = db.all<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'error' AND created_at >= ${cutoffISO}`
    );
    const errors = errorsResult[0]?.count ?? 0;

    // Page views by day
    const pageViewsByDay = db.all<{ date: string; count: number }>(
      sql`SELECT DATE(created_at) as date, COUNT(*) as count FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ${cutoffISO} GROUP BY DATE(created_at) ORDER BY date`
    );

    // Top pages (top 10)
    const topPages = db.all<{ page: string; count: number }>(
      sql`SELECT page, COUNT(*) as count FROM analytics_events WHERE page IS NOT NULL AND created_at >= ${cutoffISO} GROUP BY page ORDER BY count DESC LIMIT 10`
    );

    // Events by type
    const eventsByType = db.all<{ eventType: string; count: number }>(
      sql`SELECT event_type as eventType, COUNT(*) as count FROM analytics_events WHERE created_at >= ${cutoffISO} GROUP BY event_type ORDER BY count DESC`
    );

    return NextResponse.json({
      activeUsers,
      pageViews,
      dataImports,
      errors,
      pageViewsByDay,
      topPages,
      eventsByType,
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
