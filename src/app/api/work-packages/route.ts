import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import { applyFilters, parseFilterParams } from "@/lib/utils/filter-helpers";
import { paginate, parsePaginationParams } from "@/lib/utils/pagination";
import { createChildLogger } from "@/lib/logger";
import { flightCommentCountsBySpId } from "@/lib/messages/repository";

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
    // One repository call, shared with /api/work-packages/all — both routes used
    // to carry their own copy of this subquery, which is a second place to forget
    // the `kind` filter (OI-099).
    const countMap = flightCommentCountsBySpId();

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
