import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { feedbackLabels } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { isValidHex } from "@/lib/utils/contrast";

const log = createChildLogger("api/feedback/labels");

/**
 * GET /api/feedback/labels
 * List all labels.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const labels = db
      .select()
      .from(feedbackLabels)
      .orderBy(asc(feedbackLabels.sortOrder), asc(feedbackLabels.name))
      .all();

    return NextResponse.json(labels);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/feedback/labels
 * Create a label (admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = (body.name || "").trim();
    const color = (body.color || "").trim();

    if (!name || name.length > 50) {
      return NextResponse.json(
        { error: "Name is required and must be 50 characters or less" },
        { status: 400 },
      );
    }

    if (!color || !isValidHex(color)) {
      return NextResponse.json(
        { error: "Color must be a valid hex color (#rrggbb)" },
        { status: 400 },
      );
    }

    const newLabel = db
      .insert(feedbackLabels)
      .values({
        name,
        color,
        sortOrder: body.sortOrder ?? 0,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: feedbackLabels.id })
      .get();

    return NextResponse.json({ id: newLabel.id }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
