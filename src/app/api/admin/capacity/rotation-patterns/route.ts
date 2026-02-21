import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadRotationPatterns, createRotationPattern } from "@/lib/capacity";
import { validatePattern } from "@/lib/capacity/staffing-engine";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/rotation-patterns");

/**
 * GET /api/admin/capacity/rotation-patterns
 * List all rotation patterns. ?active=true for active only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activeOnly = request.nextUrl.searchParams.get("active") === "true";
    const patterns = loadRotationPatterns(activeOnly);
    return NextResponse.json(patterns);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/capacity/rotation-patterns
 * Create a new rotation pattern.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, pattern, isActive, sortOrder } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!pattern || typeof pattern !== "string") {
      return NextResponse.json({ error: "pattern is required" }, { status: 400 });
    }

    const validationError = validatePattern(pattern);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const created = createRotationPattern({
      name,
      pattern,
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
