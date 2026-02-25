import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadForecastModel, updateForecastModel, deleteForecastModel } from "@/lib/capacity";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/forecast-models/[id]");

/**
 * GET /api/admin/capacity/forecast-models/[id]
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

    const model = loadForecastModel(numId);
    if (!model) return NextResponse.json({ error: "Forecast model not found" }, { status: 404 });

    return NextResponse.json(model);
  } catch (error) {
    log.error({ err: error }, "Error loading forecast model");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/forecast-models/[id]
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

    const existing = loadForecastModel(numId);
    if (!existing) return NextResponse.json({ error: "Forecast model not found" }, { status: 404 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null;
    }

    if (body.method !== undefined) {
      const valid = ["moving_average", "weighted_average", "linear_trend"];
      if (!valid.includes(body.method)) {
        return NextResponse.json(
          { error: `method must be one of: ${valid.join(", ")}` },
          { status: 400 },
        );
      }
      updates.method = body.method;
    }

    if (body.lookbackDays !== undefined) {
      const lb = Number(body.lookbackDays);
      if (!Number.isInteger(lb) || lb < 7 || lb > 365) {
        return NextResponse.json({ error: "lookbackDays must be 7-365" }, { status: 400 });
      }
      updates.lookbackDays = lb;
    }

    if (body.forecastHorizonDays !== undefined) {
      const fh = Number(body.forecastHorizonDays);
      if (!Number.isInteger(fh) || fh < 1 || fh > 90) {
        return NextResponse.json({ error: "forecastHorizonDays must be 1-90" }, { status: 400 });
      }
      updates.forecastHorizonDays = fh;
    }

    if (body.granularity !== undefined) {
      if (!["daily", "shift"].includes(body.granularity)) {
        return NextResponse.json({ error: "granularity must be daily or shift" }, { status: 400 });
      }
      updates.granularity = body.granularity;
    }

    if (body.customerFilter !== undefined) {
      updates.customerFilter = body.customerFilter?.trim() || null;
    }

    if (body.weightRecent !== undefined) {
      const wr = Number(body.weightRecent);
      if (isNaN(wr) || wr < 0 || wr > 1) {
        return NextResponse.json({ error: "weightRecent must be 0.0-1.0" }, { status: 400 });
      }
      updates.weightRecent = wr;
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = updateForecastModel(numId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "Error updating forecast model");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/forecast-models/[id]
 * Cascade-deletes all associated rates.
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

    const deleted = deleteForecastModel(numId);
    if (!deleted) return NextResponse.json({ error: "Forecast model not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Error deleting forecast model");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
