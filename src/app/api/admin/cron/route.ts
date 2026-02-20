import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCronStatus, restartCron } from "@/lib/cron/index";
import { getCronJobOverrides, updateCronJobOverrides } from "@/lib/config/loader";
import { validateCronExpression } from "@/lib/utils/cron-helpers";
import { createChildLogger } from "@/lib/logger";
import fs from "fs";
import path from "path";

const log = createChildLogger("api/admin/cron");

/**
 * GET /api/admin/cron
 * List effective jobs (built-in defaults + YAML overrides + runtime state)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const jobs = getCronStatus();
    return NextResponse.json(jobs);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/cron
 * Add a custom job (validates script exists, schedule valid, writes YAML, restarts)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { key, name, description, script, schedule, enabled, options } = body;

    // Validate key
    if (!key || typeof key !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
      return NextResponse.json(
        { error: "Key is required and must be kebab-case (e.g. my-task)" },
        { status: 400 },
      );
    }

    // Check key uniqueness against all effective jobs
    const existing = getCronStatus();
    if (existing.some((j) => j.key === key)) {
      return NextResponse.json(
        { error: `A job with key "${key}" already exists` },
        { status: 409 },
      );
    }

    // Validate script
    if (!script || typeof script !== "string") {
      return NextResponse.json(
        { error: "Script path is required for custom jobs" },
        { status: 400 },
      );
    }
    const scriptPath = path.resolve(script);
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: `Script file not found: ${script}` }, { status: 400 });
    }

    // Validate schedule
    if (!schedule || typeof schedule !== "string") {
      return NextResponse.json({ error: "Schedule is required" }, { status: 400 });
    }
    const schedErr = validateCronExpression(schedule);
    if (schedErr) {
      return NextResponse.json({ error: `Invalid schedule: ${schedErr}` }, { status: 400 });
    }

    // Write to YAML
    const overrides = getCronJobOverrides();
    overrides[key] = {
      name: name || key,
      description: description || "",
      script,
      schedule,
      enabled: enabled !== false,
      ...(options && Object.keys(options).length > 0 ? { options } : {}),
    };
    updateCronJobOverrides(overrides);

    // Restart scheduler
    restartCron();

    log.info({ key, schedule }, "Custom cron job created");
    return NextResponse.json({ ok: true, key }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
