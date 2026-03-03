import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadWeeklyProjections } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/capacity/weekly-projections");

// GET /api/capacity/weekly-projections — returns active projections (any authenticated user)
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projections = loadWeeklyProjections(true);
    return NextResponse.json(projections);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
