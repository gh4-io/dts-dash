/**
 * GET /api/admin/import/history?page=1&pageSize=10&type=work-packages
 *
 * Unified import history across all data types.
 * Queries unified_import_log with optional type filter.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { unifiedImportLog, users } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/import/history");

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const pageSize = parseInt(request.nextUrl.searchParams.get("pageSize") || "10");
    const typeFilter = request.nextUrl.searchParams.get("type");
    const offset = (page - 1) * pageSize;

    // Build WHERE clause
    const conditions = typeFilter ? and(eq(unifiedImportLog.dataType, typeFilter)) : undefined;

    // Total count
    const countResult = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(unifiedImportLog)
      .where(conditions)
      .get();
    const total = countResult?.count ?? 0;

    // Paginated results with user display name
    const rows = db
      .select({
        id: unifiedImportLog.id,
        importedAt: unifiedImportLog.importedAt,
        dataType: unifiedImportLog.dataType,
        source: unifiedImportLog.source,
        format: unifiedImportLog.format,
        fileName: unifiedImportLog.fileName,
        importedBy: unifiedImportLog.importedBy,
        status: unifiedImportLog.status,
        recordsTotal: unifiedImportLog.recordsTotal,
        recordsInserted: unifiedImportLog.recordsInserted,
        recordsUpdated: unifiedImportLog.recordsUpdated,
        recordsSkipped: unifiedImportLog.recordsSkipped,
        warnings: unifiedImportLog.warnings,
        errors: unifiedImportLog.errors,
        userDisplayName: users.displayName,
      })
      .from(unifiedImportLog)
      .leftJoin(users, eq(unifiedImportLog.importedBy, users.id))
      .where(conditions)
      .orderBy(desc(unifiedImportLog.importedAt))
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
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
