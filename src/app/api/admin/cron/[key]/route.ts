import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEffectiveJobs, restartCron, getBuiltinJobs } from "@/lib/cron/index";
import { getCronJobOverrides, updateCronJobOverrides } from "@/lib/config/loader";
import { validateCronExpression } from "@/lib/utils/cron-helpers";
import { createChildLogger } from "@/lib/logger";
import fs from "fs";
import path from "path";

const log = createChildLogger("api/admin/cron/[key]");

/**
 * PUT /api/admin/cron/[key]
 * Update job overrides (built-in: writes override; custom: updates definition)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
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

    const body = await request.json();
    const overrides = getCronJobOverrides();

    // Validate schedule if provided
    if (body.schedule !== undefined) {
      const schedErr = validateCronExpression(body.schedule);
      if (schedErr) {
        return NextResponse.json({ error: `Invalid schedule: ${schedErr}` }, { status: 400 });
      }
    }

    // Validate script if provided (custom jobs only)
    if (body.script !== undefined && !job.builtin) {
      const scriptPath = path.resolve(body.script);
      if (!fs.existsSync(scriptPath)) {
        return NextResponse.json(
          { error: `Script file not found: ${body.script}` },
          { status: 400 },
        );
      }
    }

    // Build the override entry
    const existing = overrides[key] ?? {};

    if (job.builtin) {
      // For built-in: only store overridden fields
      if (body.schedule !== undefined) existing.schedule = body.schedule;
      if (body.enabled !== undefined) existing.enabled = body.enabled;
      if (body.name !== undefined) existing.name = body.name;
      if (body.description !== undefined) existing.description = body.description;
      if (body.options !== undefined) existing.options = body.options;
    } else {
      // For custom: full update
      if (body.name !== undefined) existing.name = body.name;
      if (body.description !== undefined) existing.description = body.description;
      if (body.script !== undefined) existing.script = body.script;
      if (body.schedule !== undefined) existing.schedule = body.schedule;
      if (body.enabled !== undefined) existing.enabled = body.enabled;
      if (body.options !== undefined) existing.options = body.options;
    }

    overrides[key] = existing;
    updateCronJobOverrides(overrides);
    restartCron();

    log.info({ key }, "Cron job updated");
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/cron/[key]
 * Remove custom job only (rejects if built-in)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { key } = await params;

    // Check if built-in
    const builtins = getBuiltinJobs();
    if (builtins.some((b) => b.key === key)) {
      return NextResponse.json(
        { error: "Cannot delete built-in jobs. Use Reset to restore defaults." },
        { status: 400 },
      );
    }

    const overrides = getCronJobOverrides();
    if (!overrides[key]) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    delete overrides[key];
    updateCronJobOverrides(overrides);
    restartCron();

    log.info({ key }, "Custom cron job deleted");
    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
