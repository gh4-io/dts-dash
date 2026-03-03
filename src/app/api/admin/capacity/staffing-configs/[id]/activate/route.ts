import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activateStaffingConfig } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/staffing-configs/[id]/activate");

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/capacity/staffing-configs/:id/activate
 * Set this config as active (deactivates all others).
 */
export async function POST(_request: NextRequest, { params }: Params) {
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

    const success = activateStaffingConfig(configId);
    if (!success) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
