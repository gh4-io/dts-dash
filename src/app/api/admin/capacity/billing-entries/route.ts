import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadBillingEntries, createBillingEntry } from "@/lib/capacity";
import { validateBillingEntry } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/billing-entries");

// GET /api/admin/capacity/billing-entries — list billing entries
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;

    const entries = loadBillingEntries(start, end);
    return NextResponse.json(entries);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/capacity/billing-entries — create a billing entry
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      workPackageId,
      aircraftReg,
      customer,
      billingDate,
      shiftCode,
      description,
      billedMh,
      invoiceRef,
      notes,
      source,
      isActive,
    } = body;

    // Validate with engine
    const validation = validateBillingEntry({
      aircraftReg,
      customer,
      billingDate,
      shiftCode,
      billedMh,
      source,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const entry = createBillingEntry({
      workPackageId: workPackageId ?? null,
      aircraftReg,
      customer,
      billingDate,
      shiftCode,
      description: description ?? null,
      billedMh,
      invoiceRef: invoiceRef ?? null,
      notes: notes ?? null,
      source: source ?? "manual",
      isActive: isActive ?? true,
      createdBy: userId,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
