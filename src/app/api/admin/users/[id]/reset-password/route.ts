import { NextRequest, NextResponse } from "next/server";
import { auth, invalidateUserTokens } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { createChildLogger } from "@/lib/logger";
import { parseIntParam } from "@/lib/utils/route-helpers";

const log = createChildLogger("api/admin/users/[id]/reset-password");

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * POST /api/admin/users/[id]/reset-password
 * Generate new temp password for a user
 * Admin only
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const existing = db.select().from(users).where(eq(users.id, numId)).get();
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tempPassword = generateTempPassword();

    db.update(users)
      .set({
        passwordHash: hashSync(tempPassword, 10),
        forcePasswordChange: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, numId))
      .run();

    // Force user to re-login with temp password
    invalidateUserTokens(numId);

    return NextResponse.json({ tempPassword });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
