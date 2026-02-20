import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { headcountExceptions, capacityShifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/headcount-exceptions/[id]");

/**
 * PUT /api/admin/capacity/headcount-exceptions/[id]
 * Update a headcount exception.
 * Admin only.
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

    const existing = db
      .select()
      .from(headcountExceptions)
      .where(eq(headcountExceptions.id, numId))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.shiftId !== undefined) {
      const shift = db
        .select()
        .from(capacityShifts)
        .where(eq(capacityShifts.id, body.shiftId))
        .get();
      if (!shift) {
        return NextResponse.json({ error: "Invalid shiftId" }, { status: 400 });
      }
      updates.shiftId = body.shiftId;
    }

    if (body.exceptionDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.exceptionDate)) {
        return NextResponse.json({ error: "exceptionDate must be YYYY-MM-DD" }, { status: 400 });
      }
      updates.exceptionDate = body.exceptionDate;
    }

    if (body.headcountDelta !== undefined) {
      if (typeof body.headcountDelta !== "number" || !Number.isInteger(body.headcountDelta)) {
        return NextResponse.json({ error: "headcountDelta must be an integer" }, { status: 400 });
      }
      updates.headcountDelta = body.headcountDelta;
    }

    if (body.reason !== undefined) {
      updates.reason = body.reason;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    try {
      db.update(headcountExceptions).set(updates).where(eq(headcountExceptions.id, numId)).run();
    } catch (dbError: unknown) {
      if (dbError instanceof Error && dbError.message.includes("UNIQUE constraint")) {
        return NextResponse.json(
          { error: "An exception already exists for this shift and date" },
          { status: 409 },
        );
      }
      throw dbError;
    }

    const updated = db
      .select()
      .from(headcountExceptions)
      .where(eq(headcountExceptions.id, numId))
      .get();

    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/headcount-exceptions/[id]
 * Delete a headcount exception.
 * Admin only.
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

    const existing = db
      .select()
      .from(headcountExceptions)
      .where(eq(headcountExceptions.id, numId))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Exception not found" }, { status: 404 });
    }

    db.delete(headcountExceptions).where(eq(headcountExceptions.id, numId)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
