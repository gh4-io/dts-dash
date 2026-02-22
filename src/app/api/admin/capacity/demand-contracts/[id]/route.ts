import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadDemandContract, updateDemandContract, deleteDemandContract } from "@/lib/capacity";
import { validateContract } from "@/lib/capacity/allocation-engine";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/demand-contracts/[id]");

/**
 * GET /api/admin/capacity/demand-contracts/[id]
 * Get a single demand contract with lines. Admin only.
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

    const contract = loadDemandContract(numId);
    if (!contract) {
      return NextResponse.json({ error: "Demand contract not found" }, { status: 404 });
    }

    return NextResponse.json(contract);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/demand-contracts/[id]
 * Update a demand contract and its lines. Admin only.
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

    const existing = loadDemandContract(numId);
    if (!existing) {
      return NextResponse.json({ error: "Demand contract not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build merged data for validation (existing + updates)
    const merged = {
      customerId: body.customerId ?? existing.customerId,
      name: body.name ?? existing.name,
      mode: body.mode ?? existing.mode,
      effectiveFrom: body.effectiveFrom ?? existing.effectiveFrom,
      effectiveTo: body.effectiveTo !== undefined ? body.effectiveTo : existing.effectiveTo,
      contractedMh: body.contractedMh !== undefined ? body.contractedMh : existing.contractedMh,
      periodType: body.periodType !== undefined ? body.periodType : existing.periodType,
      lines: body.lines,
    };

    const validation = validateContract(merged);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    // Validate customerId if changed
    if (body.customerId !== undefined) {
      const customer = db.select().from(customers).where(eq(customers.id, body.customerId)).get();
      if (!customer) {
        return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
      }
    }

    const updated = updateDemandContract(numId, body);
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/demand-contracts/[id]
 * Delete a demand contract (cascades to lines). Admin only.
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

    const deleted = deleteDemandContract(numId);
    if (!deleted) {
      return NextResponse.json({ error: "Demand contract not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
