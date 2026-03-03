import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadStaffingConfigs, createStaffingConfig } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/staffing-configs");

/**
 * GET /api/admin/capacity/staffing-configs
 * List all staffing configurations with shift count and total headcount.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = loadStaffingConfigs();
    return NextResponse.json(configs);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/staffing-configs
 * Create a new staffing configuration.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const created = createStaffingConfig({
      name,
      description,
      createdBy: session.user.id ? parseInt(session.user.id, 10) : undefined,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
