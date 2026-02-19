import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { inviteCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/invite-codes/[id]");

/**
 * DELETE /api/admin/invite-codes/[id]
 * Revoke an invite code (soft delete — sets is_active = false).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const codeId = parseInt(id, 10);

    if (isNaN(codeId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const existing = db.select().from(inviteCodes).where(eq(inviteCodes.id, codeId)).get();
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    db.update(inviteCodes)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(inviteCodes.id, codeId))
      .run();

    log.info({ codeId }, "Invite code revoked");
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
