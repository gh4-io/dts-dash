import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadDemandContracts, createDemandContract } from "@/lib/capacity";
import { validateContract } from "@/lib/capacity/allocation-engine";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/demand-contracts");

/**
 * GET /api/admin/capacity/demand-contracts
 * List all demand contracts with embedded lines. Admin only.
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

    const contracts = loadDemandContracts(start, end);
    return NextResponse.json(contracts);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/demand-contracts
 * Create a new demand contract with lines. Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validate via engine
    const validation = validateContract(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    // Validate customerId exists
    const customer = db.select().from(customers).where(eq(customers.id, body.customerId)).get();
    if (!customer) {
      return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
    }

    // Require at least one line (except PER_EVENT which uses contractedMh directly)
    if ((!body.lines || body.lines.length === 0) && body.periodType !== "PER_EVENT") {
      return NextResponse.json({ error: "At least one line is required" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const contract = createDemandContract({
      customerId: body.customerId,
      name: body.name,
      mode: body.mode,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
      contractedMh: body.contractedMh ?? null,
      periodType: body.periodType ?? null,
      reason: body.reason ?? null,
      priority: body.priority ?? 100,
      isActive: body.isActive ?? true,
      createdBy: userId,
      lines: body.lines,
    });

    invalidateTransformerCache();
    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
