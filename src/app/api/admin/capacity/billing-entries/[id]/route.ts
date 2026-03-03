import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadBillingEntry,
  updateBillingEntry,
  deleteBillingEntry,
  validateBillingEntry,
} from "@/lib/capacity";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/billing-entries/[id]");

/**
 * GET /api/admin/capacity/billing-entries/[id]
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

    const entry = loadBillingEntry(numId);
    if (!entry) {
      return NextResponse.json({ error: "Billing entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/billing-entries/[id]
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

    const existing = loadBillingEntry(numId);
    if (!existing) {
      return NextResponse.json({ error: "Billing entry not found" }, { status: 404 });
    }

    const body = await request.json();

    // Build merged object for validation (existing values + updates)
    const merged = {
      aircraftReg: body.aircraftReg ?? existing.aircraftReg,
      customer: body.customer ?? existing.customer,
      billingDate: body.billingDate ?? existing.billingDate,
      shiftCode: body.shiftCode ?? existing.shiftCode,
      billedMh: body.billedMh ?? existing.billedMh,
      source: body.source ?? existing.source,
    };

    const validation = validateBillingEntry(merged);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.workPackageId !== undefined) updates.workPackageId = body.workPackageId;
    if (body.aircraftReg !== undefined) updates.aircraftReg = body.aircraftReg;
    if (body.customer !== undefined) updates.customer = body.customer;
    if (body.billingDate !== undefined) updates.billingDate = body.billingDate;
    if (body.shiftCode !== undefined) updates.shiftCode = body.shiftCode;
    if (body.description !== undefined) updates.description = body.description;
    if (body.billedMh !== undefined) updates.billedMh = body.billedMh;
    if (body.invoiceRef !== undefined) updates.invoiceRef = body.invoiceRef;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.source !== undefined) updates.source = body.source;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = updateBillingEntry(numId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/billing-entries/[id]
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

    const deleted = deleteBillingEntry(numId);
    if (!deleted) {
      return NextResponse.json({ error: "Billing entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
