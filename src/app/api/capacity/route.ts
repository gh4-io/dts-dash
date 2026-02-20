import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import { applyFilters, parseFilterParams } from "@/lib/utils/filter-helpers";
import {
  computeDailyDemand,
  computeDailyCapacity,
  computeDailyUtilization,
} from "@/lib/data/engines/capacity";
import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";
import { createChildLogger } from "@/lib/logger";
import {
  DEFAULT_THEORETICAL_CAPACITY_PER_PERSON,
  DEFAULT_REAL_CAPACITY_PER_PERSON,
  DEFAULT_SHIFTS_JSON,
} from "@/lib/data/config-defaults";

const log = createChildLogger("api/capacity");

/**
 * GET /api/capacity
 * Returns daily demand, capacity, and utilization
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const filterParams = parseFilterParams(searchParams);

    // Read and transform data
    const rawData = readWorkPackages();
    const workPackages = await transformWorkPackages(rawData);

    // Apply filters (demand is filtered, capacity is NOT)
    const filtered = applyFilters(workPackages, filterParams);

    // Load config
    const configRows = await db.select().from(appConfig);
    const configMap = Object.fromEntries(configRows.map((r) => [r.key, r.value]));

    const config = {
      shifts: JSON.parse(configMap.shifts ?? DEFAULT_SHIFTS_JSON),
      theoreticalCapacityPerPerson: parseFloat(
        configMap.theoreticalCapacityPerPerson ?? String(DEFAULT_THEORETICAL_CAPACITY_PER_PERSON),
      ),
      realCapacityPerPerson: parseFloat(
        configMap.realCapacityPerPerson ?? String(DEFAULT_REAL_CAPACITY_PER_PERSON),
      ),
    };

    // Compute demand, capacity, utilization
    const demand = computeDailyDemand(filtered);
    const dates = demand.map((d) => d.date);
    const capacity = computeDailyCapacity(dates, config);
    const utilization = computeDailyUtilization(demand, capacity);

    return NextResponse.json({
      demand,
      capacity,
      utilization,
    });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
