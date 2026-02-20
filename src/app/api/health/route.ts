import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";

const startTime = Date.now();

/**
 * GET /api/health
 * No authentication required.
 * Returns system health status with DB and work package data checks.
 * Returns 503 if database is unreachable.
 */
export async function GET() {
  const checks: Record<string, { status: string; message?: string }> = {};
  let healthy = true;

  // Check database connectivity
  try {
    const result = sqlite.prepare("SELECT 1 as ok").get() as { ok: number };
    checks.database =
      result?.ok === 1 ? { status: "ok" } : { status: "error", message: "Unexpected query result" };
  } catch (error) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    healthy = false;
  }

  // Check work packages exist in database
  try {
    const result = sqlite.prepare("SELECT count(*) as count FROM work_packages").get() as {
      count: number;
    };
    const count = result?.count ?? 0;
    checks.workPackages =
      count > 0
        ? { status: "ok", message: `${count} records` }
        : { status: "warning", message: "No work packages — import data to begin" };
  } catch {
    checks.workPackages = { status: "warning", message: "Could not query work_packages table" };
  }

  const uptimeMs = Date.now() - startTime;
  const body = {
    status: healthy ? "healthy" : "unhealthy",
    version: process.env.npm_package_version || "0.1.0",
    uptime: `${Math.floor(uptimeMs / 1000)}s`,
    checks,
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
