import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import { applyFilters, parseFilterParams } from "@/lib/utils/filter-helpers";
import { paginate, parsePaginationParams } from "@/lib/utils/pagination";
import { createChildLogger } from "@/lib/logger";
import { sqlite } from "@/lib/db/client";

const log = createChildLogger("api/work-packages");

/**
 * GET /api/work-packages
 * Returns paginated work packages with filters
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
    const paginationParams = parsePaginationParams(searchParams);

    // Read and transform data
    const rawData = readWorkPackages();
    const workPackages = await transformWorkPackages(rawData);

    // Apply filters
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

    // Paginate
    const result = paginate(enriched, paginationParams);

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
