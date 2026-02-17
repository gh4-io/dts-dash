import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadServerConfig,
  getPasswordRequirements,
  getPasswordRequirementsSource,
} from "@/lib/config/loader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/password-security/reset");

// ─── POST — Reset to config/default requirements ───────────────────────────

export async function POST() {
  try {
    // Auth check (admin/superadmin only)
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Reload from server.config.yml (discards any in-memory overrides)
    loadServerConfig();

    log.info(
      { userId: session.user.id, userEmail: session.user.email },
      "Password requirements reset to config/defaults",
    );

    const requirements = getPasswordRequirements();
    const { source } = getPasswordRequirementsSource();

    return NextResponse.json({ requirements, source });
  } catch (error) {
    log.error({ error }, "Failed to reset password requirements");
    return NextResponse.json({ error: "Failed to reset password requirements" }, { status: 500 });
  }
}
