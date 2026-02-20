import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { inviteCodes, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/invite-codes");

/** Alphabet excluding ambiguous characters (0, O, I, L, 1). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
    .join("");
}

function computeStatus(code: {
  isActive: boolean;
  currentUses: number;
  maxUses: number;
  expiresAt: string | null;
}): "active" | "expired" | "depleted" | "revoked" {
  if (!code.isActive) return "revoked";
  if (code.currentUses >= code.maxUses) return "depleted";
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return "expired";
  return "active";
}

/**
 * GET /api/admin/invite-codes
 * List all invite codes (admin/superadmin only).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        maxUses: inviteCodes.maxUses,
        currentUses: inviteCodes.currentUses,
        expiresAt: inviteCodes.expiresAt,
        isActive: inviteCodes.isActive,
        createdAt: inviteCodes.createdAt,
        createdByName: users.displayName,
      })
      .from(inviteCodes)
      .leftJoin(users, eq(inviteCodes.createdBy, users.id))
      .all();

    const codes = rows.map((r) => ({
      ...r,
      status: computeStatus(r),
    }));

    return NextResponse.json(codes);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/invite-codes
 * Create a new invite code (admin/superadmin only).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = getSessionUserId(session);
    const body = await request.json();
    const maxUses = Math.max(1, Math.min(1000, body.maxUses ?? 1));
    const expiresAt = body.expiresAt || null;

    const code = generateInviteCode();
    const now = new Date().toISOString();

    const row = db
      .insert(inviteCodes)
      .values({
        code,
        createdBy: userId,
        maxUses,
        currentUses: 0,
        expiresAt,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: inviteCodes.id })
      .get();

    log.info({ codeId: row.id, maxUses }, "Invite code created");
    return NextResponse.json({ id: row.id, code });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
