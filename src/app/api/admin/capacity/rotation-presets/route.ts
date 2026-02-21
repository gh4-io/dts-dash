import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadRotationPresets } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/rotation-presets");

/**
 * GET /api/admin/capacity/rotation-presets
 * List all rotation presets (library entries). Admin-gated.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const presets = loadRotationPresets();
    return NextResponse.json(presets);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
