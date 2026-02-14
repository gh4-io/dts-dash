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
      shifts: JSON.parse(
        configMap.shifts ??
          JSON.stringify([
            { name: "Day", startHour: 7, endHour: 15, headcount: 8 },
            { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
            { name: "Night", startHour: 23, endHour: 7, headcount: 4 },
          ])
      ),
      theoreticalCapacityPerPerson: parseFloat(
        configMap.theoreticalCapacityPerPerson ?? "8.0"
      ),
      realCapacityPerPerson: parseFloat(configMap.realCapacityPerPerson ?? "6.5"),
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
    console.error("[api/capacity] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
