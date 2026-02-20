import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBuiltinJobs, restartCron } from "@/lib/cron/index";
import { getCronJobOverrides, updateCronJobOverrides } from "@/lib/config/loader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/cron/[key]/reset");

/**
 * POST /api/admin/cron/[key]/reset
 * Remove YAML overrides for a built-in job (restore defaults)
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

    // Only works for built-in jobs
    const builtins = getBuiltinJobs();
    if (!builtins.some((b) => b.key === key)) {
      return NextResponse.json(
        { error: "Reset is only available for built-in jobs" },
        { status: 400 },
      );
    }

    const overrides = getCronJobOverrides();
    if (overrides[key]) {
      delete overrides[key];
      updateCronJobOverrides(overrides);
      restartCron();
      log.info({ key }, "Built-in cron job reset to defaults");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
