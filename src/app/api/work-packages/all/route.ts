import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import { applyFilters, parseFilterParams } from "@/lib/utils/filter-helpers";
import { createChildLogger } from "@/lib/logger";

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

    // Apply filters
    const filtered = applyFilters(workPackages, filterParams);

    return NextResponse.json({
      data: filtered,
      total: filtered.length,
    });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
