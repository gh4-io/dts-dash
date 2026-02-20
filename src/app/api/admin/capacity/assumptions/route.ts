import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { capacityAssumptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadAssumptions } from "@/lib/capacity";
import { validateDemandCurveWeights } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/assumptions");

/**
 * GET /api/admin/capacity/assumptions
 * Read the active capacity assumptions.
 * Admin only.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assumptions = loadAssumptions();
    if (!assumptions) {
      return NextResponse.json({ error: "No assumptions configured" }, { status: 404 });
    }

    return NextResponse.json(assumptions);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/assumptions
 * Update the active capacity assumptions.
 * Admin only.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validate fields
    const updates: Record<string, unknown> = {};
    const now = new Date().toISOString();

    if (body.paidToAvailable !== undefined) {
      const val = Number(body.paidToAvailable);
      if (isNaN(val) || val < 0 || val > 1) {
        return NextResponse.json(
          { error: "paidToAvailable must be between 0 and 1" },
          { status: 400 },
        );
      }
      updates.paidToAvailable = val;
    }

    if (body.availableToProductive !== undefined) {
      const val = Number(body.availableToProductive);
      if (isNaN(val) || val < 0 || val > 1) {
        return NextResponse.json(
          { error: "availableToProductive must be between 0 and 1" },
          { status: 400 },
        );
      }
      updates.availableToProductive = val;
    }

    if (body.nightProductivityFactor !== undefined) {
      const val = Number(body.nightProductivityFactor);
      if (isNaN(val) || val < 0 || val > 1) {
        return NextResponse.json(
          { error: "nightProductivityFactor must be between 0 and 1" },
          { status: 400 },
        );
      }
      updates.nightProductivityFactor = val;
    }

    if (body.defaultMhNoWp !== undefined) {
      const val = Number(body.defaultMhNoWp);
      if (isNaN(val) || val < 0.5 || val > 10) {
        return NextResponse.json(
          { error: "defaultMhNoWp must be between 0.5 and 10" },
          { status: 400 },
        );
      }
      updates.defaultMhNoWp = val;
    }

    if (body.demandCurve !== undefined) {
      if (!["EVEN", "WEIGHTED"].includes(body.demandCurve)) {
        return NextResponse.json(
          { error: "demandCurve must be EVEN or WEIGHTED" },
          { status: 400 },
        );
      }
      updates.demandCurve = body.demandCurve;
    }

    if (body.arrivalWeight !== undefined) {
      const val = Number(body.arrivalWeight);
      if (isNaN(val) || val < 0) {
        return NextResponse.json({ error: "arrivalWeight must be >= 0" }, { status: 400 });
      }
      updates.arrivalWeight = val;
    }

    if (body.departureWeight !== undefined) {
      const val = Number(body.departureWeight);
      if (isNaN(val) || val < 0) {
        return NextResponse.json({ error: "departureWeight must be >= 0" }, { status: 400 });
      }
      updates.departureWeight = val;
    }

    // Cross-validate demand curve weights
    const current = loadAssumptions();
    if (!current) {
      return NextResponse.json({ error: "No assumptions to update" }, { status: 404 });
    }

    const finalArrival = (updates.arrivalWeight as number) ?? current.arrivalWeight;
    const finalDeparture = (updates.departureWeight as number) ?? current.departureWeight;
    const weightError = validateDemandCurveWeights(finalArrival, finalDeparture);
    if (weightError) {
      return NextResponse.json({ error: weightError }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updatedAt = now;
    updates.updatedBy = Number(session.user.id);

    db.update(capacityAssumptions).set(updates).where(eq(capacityAssumptions.id, current.id)).run();

    const updated = loadAssumptions();
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
