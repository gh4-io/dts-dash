import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/server/restart");

// ─── POST — Restart the server process ──────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    log.warn(
      { userId: session.user.id, userEmail: session.user.email },
      "Server restart requested",
    );

    // Schedule process exit after response is sent
    setTimeout(() => {
      log.info("Server shutting down for restart...");
      process.exit(0);
    }, 1500);

    return NextResponse.json({ message: "Server is restarting..." });
  } catch (error) {
    log.error({ error }, "Failed to initiate server restart");
    return NextResponse.json({ error: "Failed to initiate restart" }, { status: 500 });
  }
}
