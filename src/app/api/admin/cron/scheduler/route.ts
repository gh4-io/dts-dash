import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSchedulerState, pauseScheduler, resumeScheduler } from "@/lib/cron/index";
import { getBackupHealth } from "@/lib/cron/backup-health";
import { requireCronGate } from "@/lib/cron/api-guard";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/cron/scheduler");

/**
 * GET /api/admin/cron/scheduler
 * Scheduler state (deployment gate + runtime switch) and backup freshness.
 * Readable in every state — the disabled view is still a full read-only view.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      scheduler: getSchedulerState(),
      backup: getBackupHealth(),
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/cron/scheduler
 * Body: { paused: boolean } — the runtime Running/Paused switch.
 *
 * Never writes server.config.yml: `features.cronEnabled` is a deployment
 * concern and stays out of reach of the web app.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // With the gate off there is nothing to pause or resume, and pretending
    // otherwise is precisely the confusion this endpoint exists to remove.
    const gated = requireCronGate();
    if (gated) return gated;

    const body = await request.json();
    if (typeof body?.paused !== "boolean") {
      return NextResponse.json({ error: "Body must be { paused: boolean }" }, { status: 400 });
    }

    // Recorded with the acting user so the UI can show who paused it, and when
    const actor = session.user.email || session.user.name || `user:${session.user.id}`;
    const state = body.paused ? pauseScheduler(actor) : resumeScheduler(actor);

    log.info(
      { paused: state.paused, actor, activeTasks: state.activeTaskCount },
      "Scheduler state changed",
    );
    return NextResponse.json({ scheduler: state, backup: getBackupHealth() });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
