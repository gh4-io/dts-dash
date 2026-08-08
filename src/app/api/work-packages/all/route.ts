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
import { flightCommentCountsBySpId } from "@/lib/messages/repository";

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
    // Pages that only need the filter option lists (every page renders the
    // TopMenuBar, but only the flight board and dashboard need the rows) can
    // ask for facets alone and skip shipping ~2000 work packages.
    const facetsOnly = searchParams.get("facetsOnly") === "1";

    // Read and transform data
    const rawData = readWorkPackages();
    const workPackages = await transformWorkPackages(rawData);

    // Two-stage filter: date range first (for facets), then entity filters
    const dateScoped = applyDateRangeFilter(workPackages, filterParams);
    const facets = extractFacets(dateScoped);

    if (facetsOnly) {
      return NextResponse.json({ data: [], total: 0, facets });
    }

    const filtered = applyFilters(workPackages, filterParams);

    // Enrich with comment counts (join through sp_id since wp.id = SharePoint ID)
    // One repository call, shared with /api/work-packages/all — both routes used
    // to carry their own copy of this subquery, which is a second place to forget
    // the `kind` filter (OI-099).
    const countMap = flightCommentCountsBySpId();

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
