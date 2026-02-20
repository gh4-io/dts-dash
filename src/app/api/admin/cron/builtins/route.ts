import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBuiltinJobs } from "@/lib/cron/index";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/cron/builtins");

/**
 * GET /api/admin/cron/builtins
 * List built-in definitions with optionsSchema (for form rendering)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const builtins = getBuiltinJobs().map((b) => ({
      key: b.key,
      name: b.name,
      description: b.description,
      script: b.script,
      defaultSchedule: b.defaultSchedule,
      defaultEnabled: b.defaultEnabled,
      defaultOptions: b.defaultOptions,
      optionsSchema: b.optionsSchema,
    }));

    return NextResponse.json(builtins);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
