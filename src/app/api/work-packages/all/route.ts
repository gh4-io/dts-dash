import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import {
  applyDateRangeFilter,
  applyFilters,
  extractFacets,
  parseFilterParams,
} from "@/lib/utils/filter-helpers";
import { createChildLogger } from "@/lib/logger";
import { sqlite } from "@/lib/db/client";

const log = createChildLogger("api/work-packages/all");

/**
 * GET /api/work-packages/all
 * Returns ALL work packages with filters (no pagination)
 * Use for charts, exports, etc.
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

    // Two-stage filter: date range first (for facets), then entity filters
    const dateScoped = applyDateRangeFilter(workPackages, filterParams);
    const facets = extractFacets(dateScoped);
    const filtered = applyFilters(workPackages, filterParams);

    // Enrich with comment counts (join through sp_id since wp.id = SharePoint ID)
    const commentCounts = sqlite
      .prepare(
        `SELECT wp.sp_id, COUNT(*) as cnt
         FROM flight_comments fc
         JOIN work_packages wp ON wp.id = fc.work_package_id
         GROUP BY wp.sp_id`,
      )
      .all() as { sp_id: number; cnt: number }[];
    const countMap = new Map(commentCounts.map((r) => [r.sp_id, r.cnt]));

    const enriched = filtered.map((wp) => ({
      ...wp,
      _commentCount: countMap.get(wp.id) ?? 0,
    }));

    return NextResponse.json({
      data: enriched,
      total: enriched.length,
      facets,
    });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
