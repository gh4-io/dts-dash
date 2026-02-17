import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { db } from "@/lib/db/client";
import { importLog, workPackages } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/import/reset");

/**
 * POST /api/admin/import/reset
 * Clears all work package data from the database.
 * Admin/superadmin only.
 */
export async function POST() {
  const session = await auth();

  // Auth check
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role check
  if (session.user.role !== "admin" && session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Count current records
    const countResult = db
      .select({ count: sql<number>`count(*)` })
      .from(workPackages)
      .get();
    const currentRecordCount = countResult?.count ?? 0;

    if (currentRecordCount === 0) {
      return NextResponse.json({
        success: true,
        message: "No data to reset",
        recordCount: 0,
      });
    }

    // Delete all work packages
    db.delete(workPackages).run();

    // Invalidate caches
    invalidateCache();
    invalidateTransformerCache();

    // Log the reset action
    const logId = crypto.randomUUID();
    try {
      db.insert(importLog)
        .values({
          id: logId,
          importedAt: new Date().toISOString(),
          recordCount: 0,
          source: "api",
          fileName: "RESET",
          importedBy: session.user.id,
          status: "success",
          errors: null,
          idempotencyKey: null,
        })
        .run();
    } catch (logErr) {
      log.error({ err: logErr }, "Failed to log reset");
    }

    return NextResponse.json({
      success: true,
      message: `Reset complete. Cleared ${currentRecordCount} records.`,
      recordCount: currentRecordCount,
    });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Failed to reset work package data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
