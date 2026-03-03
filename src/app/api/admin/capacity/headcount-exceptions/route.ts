import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { headcountExceptions, capacityShifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadExceptions } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/headcount-exceptions");

/**
 * GET /api/admin/capacity/headcount-exceptions
 * List headcount exceptions, optionally filtered by date range.
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

    const exceptions = loadExceptions(start, end);
    return NextResponse.json(exceptions);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/headcount-exceptions
 * Create a new headcount exception.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { shiftId, exceptionDate, headcountDelta, reason } = body;

    // Required fields
    if (shiftId === undefined || !exceptionDate || headcountDelta === undefined) {
      return NextResponse.json(
        { error: "shiftId, exceptionDate, and headcountDelta are required" },
        { status: 400 },
      );
    }

    // Validate shiftId exists
    const shift = db.select().from(capacityShifts).where(eq(capacityShifts.id, shiftId)).get();
    if (!shift) {
      return NextResponse.json({ error: "Invalid shiftId" }, { status: 400 });
    }

    // Validate headcountDelta
    if (typeof headcountDelta !== "number" || !Number.isInteger(headcountDelta)) {
      return NextResponse.json({ error: "headcountDelta must be an integer" }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate)) {
      return NextResponse.json({ error: "exceptionDate must be YYYY-MM-DD" }, { status: 400 });
    }

    const now = new Date().toISOString();

    try {
      const newException = db
        .insert(headcountExceptions)
        .values({
          shiftId,
          exceptionDate,
          headcountDelta,
          reason: reason ?? null,
          createdAt: now,
          createdBy: Number(session.user.id),
        })
        .returning()
        .get();

      return NextResponse.json(newException, { status: 201 });
    } catch (dbError: unknown) {
      // Handle unique constraint violation (shift_id + exception_date)
      if (dbError instanceof Error && dbError.message.includes("UNIQUE constraint")) {
        return NextResponse.json(
          { error: "An exception already exists for this shift and date" },
          { status: 409 },
        );
      }
      throw dbError;
    }
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
