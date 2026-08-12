import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { isValidHex } from "@/lib/utils/contrast";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { getLabel, updateLabel, deleteLabel } from "@/lib/messages/repository";

const log = createChildLogger("api/feedback/labels/[id]");

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/feedback/labels/[id]
 * Edit a label (admin only).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = parseIntParam(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid label ID" }, { status: 400 });
    }

    if (!getLabel(id)) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: { name?: string; color?: string; sortOrder?: number } = {};

    if (body.name !== undefined) {
      const name = (body.name || "").trim();
      if (!name || name.length > 50) {
        return NextResponse.json({ error: "Name must be 1-50 characters" }, { status: 400 });
      }
      updates.name = name;
    }

    if (body.color !== undefined) {
      if (!isValidHex(body.color)) {
        return NextResponse.json(
          { error: "Color must be a valid hex color (#rrggbb)" },
          { status: 400 },
        );
      }
      updates.color = body.color;
    }

    if (body.sortOrder !== undefined) {
      updates.sortOrder = body.sortOrder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updateLabel(id, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback/labels/[id]
 * Delete a label (admin only). message_labels cascades, so post associations go
 * with it.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = parseIntParam(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid label ID" }, { status: 400 });
    }

    if (!getLabel(id)) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    deleteLabel(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
