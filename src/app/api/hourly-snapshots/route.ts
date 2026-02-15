import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import { applyFilters, parseFilterParams } from "@/lib/utils/filter-helpers";
import { computeHourlySnapshots } from "@/lib/data/engines/hourly-snapshot";

/**
 * GET /api/hourly-snapshots
 * Returns hourly arrival/departure/on-ground counts
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
    const timezone = searchParams.get("timezone") || "UTC";

    // Read and transform data
    const rawData = readWorkPackages();
    const workPackages = await transformWorkPackages(rawData);

    // Apply filters
    const filtered = applyFilters(workPackages, filterParams);

    // Parse filter dates to clamp chart range
    const filterStart = filterParams.start ? new Date(filterParams.start) : undefined;
    const filterEnd = filterParams.end ? new Date(filterParams.end) : undefined;

    // Compute snapshots (bounded to filter date range)
    const snapshots = computeHourlySnapshots(filtered, timezone, filterStart, filterEnd);

    return NextResponse.json({
      data: snapshots,
      timezone,
      total: snapshots.length,
    });
  } catch (error) {
    console.error("[api/hourly-snapshots] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
