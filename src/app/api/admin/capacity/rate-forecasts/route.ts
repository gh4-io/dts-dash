import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadForecastRates,
  loadForecastModel,
  createForecastRate,
  validateForecastRate,
} from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/rate-forecasts");

/**
 * GET /api/admin/capacity/rate-forecasts?modelId=N&start=&end=
 * List rates for a model. Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const modelIdStr = searchParams.get("modelId");
    if (!modelIdStr) {
      return NextResponse.json({ error: "modelId query parameter is required" }, { status: 400 });
    }

    const modelId = parseInt(modelIdStr, 10);
    if (isNaN(modelId) || modelId <= 0) {
      return NextResponse.json({ error: "Invalid modelId" }, { status: 400 });
    }

    const start = searchParams.get("start") ?? undefined;
    const end = searchParams.get("end") ?? undefined;

    const rates = loadForecastRates(modelId, start, end);
    return NextResponse.json(rates);
  } catch (error) {
    log.error({ err: error }, "Error listing forecast rates");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/rate-forecasts
 * Create a manual forecast rate. Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const validation = validateForecastRate(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    // Verify model exists
    const model = loadForecastModel(body.modelId);
    if (!model) {
      return NextResponse.json({ error: "Forecast model not found" }, { status: 404 });
    }

    const userId = Number(session.user.id);
    const rate = createForecastRate({
      modelId: body.modelId,
      forecastDate: body.forecastDate,
      shiftCode: body.shiftCode ?? null,
      customer: body.customer?.trim() || null,
      forecastedMh: body.forecastedMh,
      confidence: body.confidence ?? null,
      isManualOverride: true, // Manual rates always marked as override
      notes: body.notes?.trim() || null,
      isActive: body.isActive ?? true,
      createdBy: userId,
    });

    return NextResponse.json(rate, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "Error creating forecast rate");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
