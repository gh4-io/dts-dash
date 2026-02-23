import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadShifts, isValidTimezone } from "@/lib/capacity";
import { db } from "@/lib/db/client";
import { capacityShifts } from "@/lib/db/schema";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/shifts");

/**
 * GET /api/admin/capacity/shifts
 * List active capacity shifts (read-only reference data).
 * Admin only.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shifts = loadShifts();
    return NextResponse.json(shifts);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/capacity/shifts
 * Update timezone for all capacity shifts.
 * Body: { timezone: string } — valid IANA timezone.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { timezone } = body;

    if (!timezone || typeof timezone !== "string") {
      return NextResponse.json({ error: "timezone is required" }, { status: 400 });
    }

    if (!isValidTimezone(timezone)) {
      return NextResponse.json(
        { error: `Invalid timezone: "${timezone}". Must be a valid IANA timezone.` },
        { status: 400 },
      );
    }

    db.update(capacityShifts).set({ timezone, updatedAt: new Date().toISOString() }).run();

    log.info({ timezone }, "Updated shift timezone");
    const shifts = loadShifts();
    return NextResponse.json(shifts);
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
