import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadFlightEvents, createFlightEvent, validateFlightEvent } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/flight-events");

/**
 * GET /api/admin/capacity/flight-events
 * List flight events with optional date range. Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;

    const events = loadFlightEvents(start, end);
    return NextResponse.json(events);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/flight-events
 * Create a new flight event. Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validate with engine
    const validation = validateFlightEvent(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    // Additional: window durations must be non-negative numbers
    const arrWin = body.arrivalWindowMinutes ?? 30;
    const depWin = body.departureWindowMinutes ?? 60;
    if (typeof arrWin !== "number" || arrWin < 0) {
      return NextResponse.json(
        { error: "arrivalWindowMinutes must be a non-negative number" },
        { status: 400 },
      );
    }
    if (typeof depWin !== "number" || depWin < 0) {
      return NextResponse.json(
        { error: "departureWindowMinutes must be a non-negative number" },
        { status: 400 },
      );
    }

    const userId = Number(session.user.id);
    const event = createFlightEvent({
      workPackageId: body.workPackageId ?? null,
      aircraftReg: body.aircraftReg.trim(),
      customer: body.customer.trim(),
      scheduledArrival: body.scheduledArrival || null,
      actualArrival: body.actualArrival || null,
      scheduledDeparture: body.scheduledDeparture || null,
      actualDeparture: body.actualDeparture || null,
      arrivalWindowMinutes: arrWin,
      departureWindowMinutes: depWin,
      status: body.status,
      source: body.source,
      notes: body.notes || null,
      isActive: body.isActive ?? true,
      createdBy: userId,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
