import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { aircraftTypeMappings } from "@/lib/db/schema";
import { SEED_AIRCRAFT_TYPE_MAPPINGS } from "@/lib/db/seed-data";
import { invalidateMappingsCache } from "@/lib/utils/aircraft-type";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/aircraft-types/reset");

/**
 * POST /api/admin/aircraft-types/reset
 * Delete all mappings and restore seed defaults.
 * Superadmin only.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete all existing mappings
    db.delete(aircraftTypeMappings).run();

    // Re-insert seed mappings
    const now = new Date().toISOString();
    db.insert(aircraftTypeMappings)
      .values(
        SEED_AIRCRAFT_TYPE_MAPPINGS.map((m) => ({
          ...m,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    invalidateMappingsCache();

    return NextResponse.json({
      success: true,
      restored: SEED_AIRCRAFT_TYPE_MAPPINGS.length,
    });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
