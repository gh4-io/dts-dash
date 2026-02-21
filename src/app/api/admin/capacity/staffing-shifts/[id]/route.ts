import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateStaffingShift, deleteStaffingShift } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";
import type { StaffingShiftCategory } from "@/types";

const log = createChildLogger("api/admin/capacity/staffing-shifts/[id]");

type Params = { params: Promise<{ id: string }> };

const VALID_CATEGORIES: StaffingShiftCategory[] = ["DAY", "SWING", "NIGHT", "OTHER"];

/**
 * PUT /api/admin/capacity/staffing-shifts/:id
 * Update any field of a staffing shift.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const shiftId = parseInt(id, 10);
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();

    // Validate category if provided
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: "category must be DAY, SWING, NIGHT, or OTHER" },
        { status: 400 },
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    const allowedFields = [
      "name",
      "description",
      "category",
      "rotationId",
      "rotationStartDate",
      "startHour",
      "startMinute",
      "endHour",
      "endMinute",
      "breakMinutes",
      "lunchMinutes",
      "mhOverride",
      "headcount",
      "isActive",
      "sortOrder",
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const updated = updateStaffingShift(shiftId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/staffing-shifts/:id
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const shiftId = parseInt(id, 10);
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const deleted = deleteStaffingShift(shiftId);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
