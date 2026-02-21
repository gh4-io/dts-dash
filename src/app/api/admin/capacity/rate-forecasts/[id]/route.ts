import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadForecastRate, updateForecastRate, deleteForecastRate } from "@/lib/capacity";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/rate-forecasts/[id]");

/**
 * GET /api/admin/capacity/rate-forecasts/[id]
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

    const rate = loadForecastRate(numId);
    if (!rate) return NextResponse.json({ error: "Forecast rate not found" }, { status: 404 });

    return NextResponse.json(rate);
  } catch (error) {
    log.error({ err: error }, "Error loading forecast rate");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/rate-forecasts/[id]
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

    const existing = loadForecastRate(numId);
    if (!existing) return NextResponse.json({ error: "Forecast rate not found" }, { status: 404 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.forecastDate !== undefined) {
      if (typeof body.forecastDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.forecastDate)) {
        return NextResponse.json({ error: "forecastDate must be YYYY-MM-DD" }, { status: 400 });
      }
      updates.forecastDate = body.forecastDate;
    }

    if (body.shiftCode !== undefined) {
      if (body.shiftCode !== null && !["DAY", "SWING", "NIGHT"].includes(body.shiftCode)) {
        return NextResponse.json(
          { error: "shiftCode must be DAY, SWING, or NIGHT" },
          { status: 400 },
        );
      }
      updates.shiftCode = body.shiftCode;
    }

    if (body.customer !== undefined) {
      updates.customer = body.customer?.trim() || null;
    }

    if (body.forecastedMh !== undefined) {
      if (typeof body.forecastedMh !== "number" || body.forecastedMh < 0) {
        return NextResponse.json(
          { error: "forecastedMh must be a non-negative number" },
          { status: 400 },
        );
      }
      updates.forecastedMh = body.forecastedMh;
    }

    if (body.confidence !== undefined) {
      if (body.confidence !== null) {
        const c = Number(body.confidence);
        if (isNaN(c) || c < 0 || c > 1) {
          return NextResponse.json({ error: "confidence must be 0.0-1.0" }, { status: 400 });
        }
        updates.confidence = c;
      } else {
        updates.confidence = null;
      }
    }

    if (body.isManualOverride !== undefined) {
      updates.isManualOverride = Boolean(body.isManualOverride);
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes?.trim() || null;
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = updateForecastRate(numId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "Error updating forecast rate");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/rate-forecasts/[id]
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

    const deleted = deleteForecastRate(numId);
    if (!deleted) return NextResponse.json({ error: "Forecast rate not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Error deleting forecast rate");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
