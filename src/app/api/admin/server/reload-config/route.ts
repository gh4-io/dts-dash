import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadServerConfig, getAppTitle, getAuthSecret, getDatabasePath } from "@/lib/config/loader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/server/reload-config");

// ─── POST — Hot-reload server config ────────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for auth/db changes that require restart (before reload overwrites state)
    const warnings: string[] = [];
    const newSecret = getAuthSecret();
    if (newSecret && newSecret !== process.env.AUTH_SECRET) {
      warnings.push("auth.secret changed — restart required to take effect");
      log.warn("auth.secret changed in config but cannot be applied at runtime (restart required)");
    }
    const newDbPath = getDatabasePath();
    if (newDbPath !== process.env.DATABASE_PATH) {
      warnings.push("database.path changed — restart required to take effect");
      log.warn(
        "database.path changed in config but cannot be applied at runtime (restart required)",
      );
    }

    loadServerConfig(true);

    const title = getAppTitle();

    log.info(
      { userId: session.user.id, userEmail: session.user.email, title },
      "Server configuration reloaded",
    );

    return NextResponse.json({
      message: "Configuration reloaded successfully",
      title,
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    log.error({ error }, "Failed to reload configuration");
    return NextResponse.json({ error: "Failed to reload configuration" }, { status: 500 });
  }
}
