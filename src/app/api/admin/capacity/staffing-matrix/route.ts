import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadStaffingShifts,
  loadRotationPatterns,
  loadAssumptions,
  loadStaffingConfig,
  loadActiveStaffingConfig,
} from "@/lib/capacity";
import { computeWeeklyMatrix, buildPatternMap } from "@/lib/capacity/staffing-engine";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/staffing-matrix");

/**
 * GET /api/admin/capacity/staffing-matrix?configId=X&weekStart=YYYY-MM-DD
 * Compute the weekly staffing matrix for a given config and week.
 *
 * If configId is omitted, uses the active config.
 * If weekStart is omitted, uses the current week (most recent Sunday).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve config
    const configIdParam = request.nextUrl.searchParams.get("configId");
    let configId: number;

    if (configIdParam) {
      configId = parseInt(configIdParam, 10);
      if (isNaN(configId)) {
        return NextResponse.json({ error: "Invalid configId" }, { status: 400 });
      }
      const config = loadStaffingConfig(configId);
      if (!config) {
        return NextResponse.json({ error: "Config not found" }, { status: 404 });
      }
    } else {
      const activeConfig = loadActiveStaffingConfig();
      if (!activeConfig) {
        return NextResponse.json(
          { error: "No active staffing configuration. Create and activate one first." },
          { status: 404 },
        );
      }
      configId = activeConfig.id;
    }

    // Resolve week start (default: most recent Sunday)
    let weekStart = request.nextUrl.searchParams.get("weekStart");
    if (!weekStart) {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const sunday = new Date(now);
      sunday.setUTCDate(now.getUTCDate() - dayOfWeek);
      weekStart = sunday.toISOString().split("T")[0];
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "weekStart must be YYYY-MM-DD" }, { status: 400 });
    }

    // Load data
    const shifts = loadStaffingShifts(configId);
    const patterns = loadRotationPatterns();
    const assumptions = loadAssumptions();

    if (!assumptions) {
      return NextResponse.json({ error: "No capacity assumptions configured" }, { status: 500 });
    }

    const patternMap = buildPatternMap(patterns);
    const matrix = computeWeeklyMatrix(weekStart, shifts, patternMap, assumptions);

    return NextResponse.json(matrix);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
