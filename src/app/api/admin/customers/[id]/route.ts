import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { isValidHex, getContrastText } from "@/lib/utils/contrast";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/customers/[id]");

/**
 * PATCH /api/admin/customers/[id]
 * Update a single customer (name, displayName, color)
 * Admin only
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, displayName, color } = body as {
      name?: string;
      displayName?: string;
      color?: string;
    };

    // Must have at least one field
    if (!name && !displayName && !color) {
      return NextResponse.json(
        { error: "At least one field (name, displayName, color) is required" },
        { status: 400 }
      );
    }

    // Validate color format if provided
    if (color && !isValidHex(color)) {
      return NextResponse.json(
        { error: "Invalid hex color format (must be #rrggbb)" },
        { status: 400 }
      );
    }

    const existing = db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check name uniqueness if changing name
    if (name && name !== existing.name) {
      const duplicate = db
        .select()
        .from(customers)
        .where(and(eq(customers.name, name), ne(customers.id, id)))
        .get();
      if (duplicate) {
        return NextResponse.json(
          { error: `A customer named "${name}" already exists` },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };
    if (name) updates.name = name;
    if (displayName) updates.displayName = displayName;
    if (color) {
      updates.color = color;
      updates.colorText = getContrastText(color);
    }

    db.update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .run();

    const updated = db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .get();

    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/customers/[id]
 * Soft-delete a customer (set isActive = false)
 * Admin only
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    db.update(customers)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
