import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadShifts } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/shifts");

/**
 * GET /api/admin/capacity/shifts
 * List active capacity shifts (read-only reference data).
 * Admin only.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shifts = loadShifts();
    return NextResponse.json(shifts);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
