import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateStaffingShift, deleteStaffingShift } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";
import type { StaffingShiftCategory } from "@/types";

const log = createChildLogger("api/admin/capacity/staffing-shifts/bulk");

const VALID_CATEGORIES: StaffingShiftCategory[] = ["DAY", "SWING", "NIGHT", "OTHER"];

/**
 * POST /api/admin/capacity/staffing-shifts/bulk
 * Bulk operations on staffing shifts.
 * Body: { action: "activate" | "deactivate" | "delete" | "update-category", ids: number[], category?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, ids, category } = body;

    if (!action || !["activate", "deactivate", "delete", "update-category"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }
    if (action === "update-category" && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "category required for update-category action" },
        { status: 400 },
      );
    }

    let updated = 0;

    for (const id of ids) {
      if (action === "delete") {
        if (deleteStaffingShift(id)) updated++;
      } else if (action === "update-category") {
        if (updateStaffingShift(id, { category })) updated++;
      } else {
        const result = updateStaffingShift(id, { isActive: action === "activate" });
        if (result) updated++;
      }
    }

    return NextResponse.json({ updated });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
