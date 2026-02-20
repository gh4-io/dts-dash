/**
 * POST /api/admin/import/reset
 *
 * Reset (clear) data for a specific schema type.
 * Requires schemaId in body. Falls back to work-packages for backwards compatibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { db } from "@/lib/db/client";
import {
  workPackages,
  customers,
  aircraft,
  aircraftTypeMappings,
  aircraftModels,
  manufacturers,
  engineTypes,
  appConfig,
  unifiedImportLog,
} from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/admin/import/reset");

// Map schema IDs to their DB tables for reset operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RESET_TABLES: Record<string, any> = {
  "work-packages": workPackages,
  customers: customers,
  aircraft: aircraft,
  "aircraft-type-mappings": aircraftTypeMappings,
  "aircraft-models": aircraftModels,
  manufacturers: manufacturers,
  "engine-types": engineTypes,
  "app-config": appConfig,
  // "users" intentionally excluded — cannot bulk-delete users via reset
};

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin" && session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    let schemaId: string;

    // Parse body — may be empty for legacy work-packages reset
    try {
      const body = await request.json();
      schemaId = body.schemaId || "work-packages";
    } catch {
      // Empty body → legacy work-packages reset
      schemaId = "work-packages";
    }

    const table = RESET_TABLES[schemaId];
    if (!table) {
      return NextResponse.json({ error: `Cannot reset schema: ${schemaId}` }, { status: 400 });
    }

    // Count current records
    const countResult = db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .get();
    const currentRecordCount = countResult?.count ?? 0;

    if (currentRecordCount === 0) {
      return NextResponse.json({
        success: true,
        message: "No data to reset",
        recordCount: 0,
      });
    }

    // Delete all records
    db.delete(table).run();

    // Invalidate caches for work-packages
    if (schemaId === "work-packages") {
      invalidateCache();
      invalidateTransformerCache();
    }

    // Log the reset action
    const userId = getSessionUserId(session);
    try {
      db.insert(unifiedImportLog)
        .values({
          importedAt: new Date().toISOString(),
          dataType: schemaId,
          source: "api",
          format: "json",
          fileName: "RESET",
          importedBy: userId,
          status: "success",
          recordsTotal: 0,
        })
        .run();
    } catch (logErr) {
      log.error({ err: logErr }, "Failed to log reset");
    }

    return NextResponse.json({
      success: true,
      message: `Reset complete. Cleared ${currentRecordCount} ${schemaId} records.`,
      recordCount: currentRecordCount,
    });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Failed to reset data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
