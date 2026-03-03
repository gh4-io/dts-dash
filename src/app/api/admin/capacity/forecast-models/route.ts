import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadForecastModels, createForecastModel, validateForecastModel } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/forecast-models");

/**
 * GET /api/admin/capacity/forecast-models
 * List all forecast models. Admin only.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const models = loadForecastModels();
    return NextResponse.json(models);
  } catch (error) {
    log.error({ err: error }, "Error listing forecast models");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/forecast-models
 * Create a new forecast model. Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const validation = validateForecastModel(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join("; ") }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const model = createForecastModel({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      method: body.method,
      lookbackDays: body.lookbackDays ?? 30,
      forecastHorizonDays: body.forecastHorizonDays ?? 14,
      granularity: body.granularity ?? "shift",
      customerFilter: body.customerFilter?.trim() || null,
      weightRecent: body.weightRecent ?? 0.7,
      isActive: body.isActive ?? true,
      createdBy: userId,
    });

    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "Error creating forecast model");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
