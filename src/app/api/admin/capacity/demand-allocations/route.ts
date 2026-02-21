import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, capacityShifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadDemandAllocations, createDemandAllocation } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/demand-allocations");

/**
 * GET /api/admin/capacity/demand-allocations
 * List all demand allocations. Admin only.
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

    const allocations = loadDemandAllocations(start, end);
    return NextResponse.json(allocations);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/demand-allocations
 * Create a new demand allocation. Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerId,
      shiftId,
      dayOfWeek,
      effectiveFrom,
      effectiveTo,
      allocatedMh,
      mode,
      reason,
      isActive,
    } = body;

    // Required fields
    if (customerId === undefined || !effectiveFrom || allocatedMh === undefined || !mode) {
      return NextResponse.json(
        { error: "customerId, effectiveFrom, allocatedMh, and mode are required" },
        { status: 400 },
      );
    }

    // Validate customerId exists
    const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
    if (!customer) {
      return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
    }

    // Validate shiftId if provided
    if (shiftId !== undefined && shiftId !== null) {
      const shift = db.select().from(capacityShifts).where(eq(capacityShifts.id, shiftId)).get();
      if (!shift) {
        return NextResponse.json({ error: "Invalid shiftId" }, { status: 400 });
      }
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
    if (effectiveTo && effectiveTo < effectiveFrom) {
      return NextResponse.json({ error: "effectiveTo must be >= effectiveFrom" }, { status: 400 });
    }

    // Validate allocatedMh
    if (typeof allocatedMh !== "number" || allocatedMh <= 0) {
      return NextResponse.json({ error: "allocatedMh must be a positive number" }, { status: 400 });
    }

    // Validate mode
    if (!["ADDITIVE", "MINIMUM_FLOOR"].includes(mode)) {
      return NextResponse.json(
        { error: "mode must be ADDITIVE or MINIMUM_FLOOR" },
        { status: 400 },
      );
    }

    const userId = Number(session.user.id);
    const allocation = createDemandAllocation({
      customerId,
      shiftId: shiftId ?? null,
      dayOfWeek: dayOfWeek ?? null,
      effectiveFrom,
      effectiveTo: effectiveTo ?? null,
      allocatedMh,
      mode,
      reason: reason ?? null,
      isActive: isActive ?? true,
      createdBy: userId,
    });

    return NextResponse.json(allocation, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
