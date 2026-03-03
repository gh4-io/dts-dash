import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadRotationPresetCount } from "@/lib/capacity";

/**
 * GET /api/admin/capacity/rotation-presets/count
 * Returns { count: N } — lightweight check for preset availability.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ count: loadRotationPresetCount() });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
