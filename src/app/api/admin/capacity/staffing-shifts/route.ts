import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadStaffingShifts, createStaffingShift, loadRotationPattern } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";
import type { StaffingShiftCategory } from "@/types";

const log = createChildLogger("api/admin/capacity/staffing-shifts");

const VALID_CATEGORIES: StaffingShiftCategory[] = ["DAY", "SWING", "NIGHT", "OTHER"];

/**
 * GET /api/admin/capacity/staffing-shifts?configId=X
 * List shifts for a specific config.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configId = parseInt(request.nextUrl.searchParams.get("configId") ?? "", 10);
    if (isNaN(configId)) {
      return NextResponse.json({ error: "configId is required" }, { status: 400 });
    }

    const shifts = loadStaffingShifts(configId);
    return NextResponse.json(shifts);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/staffing-shifts
 * Create a new staffing shift.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.configId || typeof body.configId !== "number") {
      return NextResponse.json({ error: "configId is required" }, { status: 400 });
    }
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: "category must be DAY, SWING, NIGHT, or OTHER" },
        { status: 400 },
      );
    }
    if (!body.rotationId || typeof body.rotationId !== "number") {
      return NextResponse.json({ error: "rotationId is required" }, { status: 400 });
    }
    if (!body.rotationStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.rotationStartDate)) {
      return NextResponse.json({ error: "rotationStartDate must be YYYY-MM-DD" }, { status: 400 });
    }
    if (body.startHour === undefined || body.startHour < 0 || body.startHour > 23) {
      return NextResponse.json({ error: "startHour must be 0-23" }, { status: 400 });
    }
    if (body.endHour === undefined || body.endHour < 0 || body.endHour > 23) {
      return NextResponse.json({ error: "endHour must be 0-23" }, { status: 400 });
    }
    if (body.headcount === undefined || body.headcount < 0) {
      return NextResponse.json({ error: "headcount must be >= 0" }, { status: 400 });
    }

    // Validate rotation pattern exists
    const rotation = loadRotationPattern(body.rotationId);
    if (!rotation) {
      return NextResponse.json({ error: "Rotation pattern not found" }, { status: 400 });
    }

    const created = createStaffingShift({
      configId: body.configId,
      name: body.name,
      category: body.category,
      rotationId: body.rotationId,
      rotationStartDate: body.rotationStartDate,
      startHour: body.startHour,
      startMinute: body.startMinute,
      endHour: body.endHour,
      endMinute: body.endMinute,
      breakMinutes: body.breakMinutes,
      lunchMinutes: body.lunchMinutes,
      mhOverride: body.mhOverride,
      headcount: body.headcount,
      isActive: body.isActive,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
