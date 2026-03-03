import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadStaffingConfig, updateStaffingConfig, deleteStaffingConfig } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/staffing-configs/[id]");

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/capacity/staffing-configs/:id
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const config = loadStaffingConfig(parseInt(id, 10));
    if (!config) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/capacity/staffing-configs/:id
 * Update name/description.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);
    if (isNaN(configId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    const updated = updateStaffingConfig(configId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/staffing-configs/:id
 * Cannot delete the active config.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);
    if (isNaN(configId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const config = loadStaffingConfig(configId);
    if (!config) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (config.isActive) {
      return NextResponse.json(
        { error: "Cannot delete the active configuration. Deactivate it first." },
        { status: 409 },
      );
    }

    deleteStaffingConfig(configId);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
