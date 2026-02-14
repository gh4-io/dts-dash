import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { importLog, users } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

/**
 * GET /api/admin/import/history?page=1&pageSize=10
 * Returns paginated import history with user display names
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const pageSize = parseInt(request.nextUrl.searchParams.get("pageSize") || "10");
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(importLog)
      .get();
    const total = countResult?.count ?? 0;

    // Get paginated results with user display name
    const rows = db
      .select({
        id: importLog.id,
        importedAt: importLog.importedAt,
        recordCount: importLog.recordCount,
        source: importLog.source,
        fileName: importLog.fileName,
        importedBy: importLog.importedBy,
        status: importLog.status,
        errors: importLog.errors,
        userDisplayName: users.displayName,
      })
      .from(importLog)
      .leftJoin(users, eq(importLog.importedBy, users.id))
      .orderBy(desc(importLog.importedAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[api/admin/import/history] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
