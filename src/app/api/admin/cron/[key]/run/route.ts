import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEffectiveJobs, executeJob, updateRunState } from "@/lib/cron/index";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/cron/[key]/run");

/**
 * POST /api/admin/cron/[key]/run
 * Manual trigger — execute immediately, update runtime state
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { key } = await params;
    const jobs = getEffectiveJobs();
    const job = jobs.find((j) => j.key === key);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    log.info({ key }, "Manual cron job trigger");

    try {
      const result = await executeJob(job);
      updateRunState(key, "success", result.message);
      return NextResponse.json({ ok: true, message: result.message });
    } catch (err) {
      const message = (err as Error).message ?? "Unknown error";
      updateRunState(key, "error", message);
      log.error({ err, key }, "Manual cron job execution failed");
      return NextResponse.json({ error: `Execution failed: ${message}` }, { status: 500 });
    }
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
