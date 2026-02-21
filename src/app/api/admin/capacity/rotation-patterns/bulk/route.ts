import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  updateRotationPattern,
  deleteRotationPattern,
  isRotationPatternInUse,
} from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/rotation-patterns/bulk");

/**
 * POST /api/admin/capacity/rotation-patterns/bulk
 * Bulk operations: activate, deactivate, delete.
 * Body: { action: "activate" | "deactivate" | "delete", ids: number[] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, ids } = body;

    if (!action || !["activate", "deactivate", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    let updated = 0;
    const errors: string[] = [];

    for (const id of ids) {
      if (action === "delete") {
        if (isRotationPatternInUse(id)) {
          errors.push(`Pattern ${id} is in use, skipped`);
          continue;
        }
        if (deleteRotationPattern(id)) updated++;
      } else {
        const result = updateRotationPattern(id, { isActive: action === "activate" });
        if (result) updated++;
      }
    }

    return NextResponse.json({ updated, errors });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
