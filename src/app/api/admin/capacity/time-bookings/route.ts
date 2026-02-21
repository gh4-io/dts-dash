import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadTimeBookings, createTimeBooking } from "@/lib/capacity";
import { validateTimeBooking } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/time-bookings");

// GET /api/admin/capacity/time-bookings — list time bookings
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;

    const bookings = loadTimeBookings(start, end);
    return NextResponse.json(bookings);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/capacity/time-bookings — create a time booking
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      workPackageId,
      aircraftReg,
      customer,
      bookingDate,
      shiftCode,
      taskName,
      taskType,
      workedMh,
      technicianCount,
      notes,
      source,
      isActive,
    } = body;

    // Validate with engine
    const validation = validateTimeBooking({
      aircraftReg,
      customer,
      bookingDate,
      shiftCode,
      taskType,
      workedMh,
      source,
      technicianCount,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const booking = createTimeBooking({
      workPackageId: workPackageId ?? null,
      aircraftReg,
      customer,
      bookingDate,
      shiftCode,
      taskName: taskName ?? null,
      taskType: taskType ?? "routine",
      workedMh,
      technicianCount: technicianCount ?? null,
      notes: notes ?? null,
      source: source ?? "manual",
      isActive: isActive ?? true,
      createdBy: userId,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
