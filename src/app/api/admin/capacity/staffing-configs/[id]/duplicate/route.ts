import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { duplicateStaffingConfig } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/staffing-configs/[id]/duplicate");

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/capacity/staffing-configs/:id/duplicate
 * Deep copy a config and all its shifts.
 * Body: { name: string }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sourceId = parseInt(id, 10);
    if (isNaN(sourceId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required for the duplicate" }, { status: 400 });
    }

    const userId = session.user.id ? parseInt(session.user.id, 10) : undefined;
    const duplicated = duplicateStaffingConfig(sourceId, name, userId);

    if (!duplicated) {
      return NextResponse.json({ error: "Source config not found" }, { status: 404 });
    }

    return NextResponse.json(duplicated, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
