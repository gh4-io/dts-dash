import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadServerConfig, getAppTitle } from "@/lib/config/loader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/server/reload-config");

// ─── POST — Hot-reload server.config.yml ────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    loadServerConfig();

    const title = getAppTitle();

    log.info(
      { userId: session.user.id, userEmail: session.user.email, title },
      "Server configuration reloaded",
    );

    return NextResponse.json({
      message: "Configuration reloaded successfully",
      title,
    });
  } catch (error) {
    log.error({ error }, "Failed to reload configuration");
    return NextResponse.json({ error: "Failed to reload configuration" }, { status: 500 });
  }
}
