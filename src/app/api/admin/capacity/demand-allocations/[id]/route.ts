import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, capacityShifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  loadDemandAllocation,
  updateDemandAllocation,
  deleteDemandAllocation,
} from "@/lib/capacity";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/demand-allocations/[id]");

/**
 * GET /api/admin/capacity/demand-allocations/[id]
 * Get a single demand allocation. Admin only.
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

    const allocation = loadDemandAllocation(numId);
    if (!allocation) {
      return NextResponse.json({ error: "Demand allocation not found" }, { status: 404 });
    }

    return NextResponse.json(allocation);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/demand-allocations/[id]
 * Update a demand allocation. Admin only.
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

    const existing = loadDemandAllocation(numId);
    if (!existing) {
      return NextResponse.json({ error: "Demand allocation not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.customerId !== undefined) {
      const customer = db.select().from(customers).where(eq(customers.id, body.customerId)).get();
      if (!customer) {
        return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
      }
      updates.customerId = body.customerId;
    }

    if (body.shiftId !== undefined) {
      if (body.shiftId !== null) {
        const shift = db
          .select()
          .from(capacityShifts)
          .where(eq(capacityShifts.id, body.shiftId))
          .get();
        if (!shift) {
          return NextResponse.json({ error: "Invalid shiftId" }, { status: 400 });
        }
      }
      updates.shiftId = body.shiftId;
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

    if (body.allocatedMh !== undefined) {
      if (typeof body.allocatedMh !== "number" || body.allocatedMh <= 0) {
        return NextResponse.json(
          { error: "allocatedMh must be a positive number" },
          { status: 400 },
        );
      }
      updates.allocatedMh = body.allocatedMh;
    }

    if (body.mode !== undefined) {
      if (!["ADDITIVE", "MINIMUM_FLOOR"].includes(body.mode)) {
        return NextResponse.json(
          { error: "mode must be ADDITIVE or MINIMUM_FLOOR" },
          { status: 400 },
        );
      }
      updates.mode = body.mode;
    }

    if (body.reason !== undefined) updates.reason = body.reason;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = updateDemandAllocation(numId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/demand-allocations/[id]
 * Delete a demand allocation. Admin only.
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

    const deleted = deleteDemandAllocation(numId);
    if (!deleted) {
      return NextResponse.json({ error: "Demand allocation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
