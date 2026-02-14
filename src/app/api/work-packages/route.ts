import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import { applyFilters, parseFilterParams } from "@/lib/utils/filter-helpers";
import { paginate, parsePaginationParams } from "@/lib/utils/pagination";

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

    // Paginate
    const result = paginate(filtered, paginationParams);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/work-packages] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
