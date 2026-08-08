import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { isValidHex } from "@/lib/utils/contrast";
import { listLabels, createLabel } from "@/lib/messages/repository";

const log = createChildLogger("api/feedback/labels");

/**
 * GET /api/feedback/labels
 * List all labels.
 *
 * Labels live in their own `labels` table, deliberately NOT folded into
 * `messages` (OI-099) — `name` is NOT NULL UNIQUE, the join row has no identity
 * of its own, and a label is a dimension rather than an utterance.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(listLabels());
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

    const id = createLabel({ name, color, sortOrder: body.sortOrder ?? 0 });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
