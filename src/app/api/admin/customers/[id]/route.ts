import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
    console.error("[api/admin/customers/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
