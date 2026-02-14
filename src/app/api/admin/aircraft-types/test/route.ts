import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeAircraftType } from "@/lib/utils/aircraft-type";

/**
 * POST /api/admin/aircraft-types/test
 * Test a raw type string against current mappings
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { rawType } = body;

    if (!rawType || typeof rawType !== "string") {
      return NextResponse.json(
        { error: "rawType is required" },
        { status: 400 }
      );
    }

    const result = await normalizeAircraftType(rawType);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/admin/aircraft-types/test] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
