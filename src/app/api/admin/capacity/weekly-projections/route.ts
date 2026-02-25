import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadWeeklyProjections,
  bulkSaveProjections,
  deleteAllProjections,
  validateProjectionEntry,
} from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/weekly-projections");

// GET /api/admin/capacity/weekly-projections — list all projections (including inactive)
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const projections = loadWeeklyProjections(false);
    return NextResponse.json(projections);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/capacity/weekly-projections — bulk upsert projections
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const rows = body.rows;

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { error: "Request body must contain a 'rows' array" },
        { status: 400 },
      );
    }

    // Validate all entries
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const validation = validateProjectionEntry(rows[i]);
      if (!validation.valid) {
        errors.push(`Row ${i + 1}: ${validation.errors.join("; ")}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("\n") }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const count = bulkSaveProjections(rows, userId);

    return NextResponse.json({ saved: count });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/capacity/weekly-projections — clear all projections
export async function DELETE() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = deleteAllProjections();
    return NextResponse.json({ deleted });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
