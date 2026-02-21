import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  updateRotationPattern,
  deleteRotationPattern,
  isRotationPatternInUse,
} from "@/lib/capacity";
import { validatePattern } from "@/lib/capacity/staffing-engine";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/rotation-patterns/[id]");

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/capacity/rotation-patterns/:id
 * Update a rotation pattern.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const patternId = parseInt(id, 10);
    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, pattern, isActive, sortOrder } = body;

    if (pattern !== undefined) {
      const validationError = validatePattern(pattern);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (body.description !== undefined) updates.description = body.description;
    if (pattern !== undefined) updates.pattern = pattern;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const updated = updateRotationPattern(patternId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/capacity/rotation-patterns/:id
 * Delete a rotation pattern. Allowed even if in use — orphaned shifts
 * will display a warning badge in the UI.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const patternId = parseInt(id, 10);
    if (isNaN(patternId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const wasInUse = isRotationPatternInUse(patternId);
    const deleted = deleteRotationPattern(patternId);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, wasInUse });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
