import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cleanupCanceledWPs } from "@/lib/cron/tasks/cleanup-canceled";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/server/cleanup");

// ─── POST — Cleanup canceled work packages ──────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const graceHours = typeof body.graceHours === "number" ? body.graceHours : 6;

    if (graceHours < 0) {
      return NextResponse.json({ error: "graceHours must be >= 0" }, { status: 400 });
    }

    const result = await cleanupCanceledWPs({ graceHours });

    log.info(
      {
        userId: session.user.id,
        userEmail: session.user.email,
        graceHours,
        message: result.message,
      },
      "Canceled work packages cleaned up",
    );

    return NextResponse.json({
      message: result.message,
    });
  } catch (error) {
    log.error({ error }, "Failed to cleanup canceled work packages");
    return NextResponse.json(
      { error: "Failed to cleanup canceled work packages" },
      { status: 500 },
    );
  }
}
