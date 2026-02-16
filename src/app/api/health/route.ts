import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import fs from "fs";
import path from "path";

const startTime = Date.now();

/**
 * GET /api/health
 * No authentication required.
 * Returns system health status with DB and data file checks.
 * Returns 503 if database is unreachable.
 */
export async function GET() {
  const checks: Record<string, { status: string; message?: string }> = {};
  let healthy = true;

  // Check database connectivity
  try {
    const result = sqlite.prepare("SELECT 1 as ok").get() as { ok: number };
    checks.database = result?.ok === 1
      ? { status: "ok" }
      : { status: "error", message: "Unexpected query result" };
  } catch (error) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    healthy = false;
  }

  // Check data file exists
  const dataPath = path.join(process.cwd(), "data", "input.json");
  try {
    const exists = fs.existsSync(dataPath);
    checks.dataFile = exists
      ? { status: "ok" }
      : { status: "warning", message: "No data file — import data to begin" };
  } catch {
    checks.dataFile = { status: "warning", message: "Could not check data file" };
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
