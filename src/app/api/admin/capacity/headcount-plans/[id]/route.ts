import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { headcountPlans, capacityShifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/headcount-plans/[id]");

/**
 * PUT /api/admin/capacity/headcount-plans/[id]
 * Update a headcount plan.
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

    const existing = db.select().from(headcountPlans).where(eq(headcountPlans.id, numId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Headcount plan not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const now = new Date().toISOString();

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

    if (body.headcount !== undefined) {
      if (
        typeof body.headcount !== "number" ||
        body.headcount < 0 ||
        !Number.isInteger(body.headcount)
      ) {
        return NextResponse.json(
          { error: "headcount must be a non-negative integer" },
          { status: 400 },
        );
      }
      updates.headcount = body.headcount;
    }

    if (body.effectiveFrom !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.effectiveFrom)) {
        return NextResponse.json({ error: "effectiveFrom must be YYYY-MM-DD" }, { status: 400 });
      }
      updates.effectiveFrom = body.effectiveFrom;
    }

    if (body.effectiveTo !== undefined) {
      if (body.effectiveTo !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.effectiveTo)) {
        return NextResponse.json(
          { error: "effectiveTo must be YYYY-MM-DD or null" },
          { status: 400 },
        );
      }
      updates.effectiveTo = body.effectiveTo;
    }

    if (body.dayOfWeek !== undefined) {
      if (body.dayOfWeek !== null) {
        if (
          typeof body.dayOfWeek !== "number" ||
          body.dayOfWeek < 0 ||
          body.dayOfWeek > 6 ||
          !Number.isInteger(body.dayOfWeek)
        ) {
          return NextResponse.json({ error: "dayOfWeek must be 0-6 or null" }, { status: 400 });
        }
      }
      updates.dayOfWeek = body.dayOfWeek;
    }

    if (body.label !== undefined) updates.label = body.label;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updatedAt = now;
    updates.updatedBy = Number(session.user.id);

    db.update(headcountPlans).set(updates).where(eq(headcountPlans.id, numId)).run();

    const updated = db.select().from(headcountPlans).where(eq(headcountPlans.id, numId)).get();
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/headcount-plans/[id]
 * Delete a headcount plan.
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

    const existing = db.select().from(headcountPlans).where(eq(headcountPlans.id, numId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Headcount plan not found" }, { status: 404 });
    }

    db.delete(headcountPlans).where(eq(headcountPlans.id, numId)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
