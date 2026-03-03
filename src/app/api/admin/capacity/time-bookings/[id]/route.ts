import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadTimeBooking,
  updateTimeBooking,
  deleteTimeBooking,
  validateTimeBooking,
} from "@/lib/capacity";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/time-bookings/[id]");

/**
 * GET /api/admin/capacity/time-bookings/[id]
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const booking = loadTimeBooking(numId);
    if (!booking) {
      return NextResponse.json({ error: "Time booking not found" }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/time-bookings/[id]
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const existing = loadTimeBooking(numId);
    if (!existing) {
      return NextResponse.json({ error: "Time booking not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build merged object for validation (existing values + updates)
    const merged = {
      aircraftReg: body.aircraftReg ?? existing.aircraftReg,
      customer: body.customer ?? existing.customer,
      bookingDate: body.bookingDate ?? existing.bookingDate,
      shiftCode: body.shiftCode ?? existing.shiftCode,
      workedMh: body.workedMh ?? existing.workedMh,
      taskType: body.taskType ?? existing.taskType,
      source: body.source ?? existing.source,
      technicianCount:
        body.technicianCount !== undefined ? body.technicianCount : existing.technicianCount,
    };

    const validation = validateTimeBooking(merged);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.workPackageId !== undefined) updates.workPackageId = body.workPackageId;
    if (body.aircraftReg !== undefined) updates.aircraftReg = body.aircraftReg;
    if (body.customer !== undefined) updates.customer = body.customer;
    if (body.bookingDate !== undefined) updates.bookingDate = body.bookingDate;
    if (body.shiftCode !== undefined) updates.shiftCode = body.shiftCode;
    if (body.taskName !== undefined) updates.taskName = body.taskName;
    if (body.taskType !== undefined) updates.taskType = body.taskType;
    if (body.workedMh !== undefined) updates.workedMh = body.workedMh;
    if (body.technicianCount !== undefined) updates.technicianCount = body.technicianCount;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.source !== undefined) updates.source = body.source;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = updateTimeBooking(numId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/time-bookings/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const deleted = deleteTimeBooking(numId);
    if (!deleted) {
      return NextResponse.json({ error: "Time booking not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
