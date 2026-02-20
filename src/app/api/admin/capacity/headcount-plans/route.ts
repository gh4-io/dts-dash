import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { headcountPlans, capacityShifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadPlans } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/headcount-plans");

/**
 * GET /api/admin/capacity/headcount-plans
 * List all headcount plans.
 * Admin only.
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

    const plans = loadPlans(start, end);
    return NextResponse.json(plans);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/headcount-plans
 * Create a new headcount plan.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { shiftId, headcount, effectiveFrom, effectiveTo, dayOfWeek, label, notes } = body;

    // Required fields
    if (shiftId === undefined || headcount === undefined || !effectiveFrom) {
      return NextResponse.json(
        { error: "shiftId, headcount, and effectiveFrom are required" },
        { status: 400 },
      );
    }

    // Validate shiftId exists
    const shift = db.select().from(capacityShifts).where(eq(capacityShifts.id, shiftId)).get();
    if (!shift) {
      return NextResponse.json({ error: "Invalid shiftId" }, { status: 400 });
    }

    // Validate headcount
    if (typeof headcount !== "number" || headcount < 0 || !Number.isInteger(headcount)) {
      return NextResponse.json(
        { error: "headcount must be a non-negative integer" },
        { status: 400 },
      );
    }

    // Validate dayOfWeek
    if (dayOfWeek !== undefined && dayOfWeek !== null) {
      if (
        typeof dayOfWeek !== "number" ||
        dayOfWeek < 0 ||
        dayOfWeek > 6 ||
        !Number.isInteger(dayOfWeek)
      ) {
        return NextResponse.json(
          { error: "dayOfWeek must be 0-6 (Sun-Sat) or null" },
          { status: 400 },
        );
      }
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      return NextResponse.json({ error: "effectiveFrom must be YYYY-MM-DD" }, { status: 400 });
    }
    if (effectiveTo && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo)) {
      return NextResponse.json({ error: "effectiveTo must be YYYY-MM-DD" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const userId = Number(session.user.id);
    const newPlan = db
      .insert(headcountPlans)
      .values({
        shiftId,
        headcount,
        effectiveFrom,
        effectiveTo: effectiveTo ?? null,
        dayOfWeek: dayOfWeek ?? null,
        label: label ?? null,
        notes: notes ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning()
      .get();

    return NextResponse.json(newPlan, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
