import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { auth, invalidateUserTokens } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { validatePassword } from "@/lib/utils/password-validation";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { SYSTEM_AUTH_ID } from "@/lib/constants";

const log = createChildLogger("api/admin/users/[id]");

/**
 * PUT /api/admin/users/[id]
 * Update a user (displayName, role, isActive, email)
 * Admin only
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await request.json();

    const existing = db.select().from(users).where(eq(users.id, numId)).get();
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent modification of the system user
    if (existing.authId === SYSTEM_AUTH_ID) {
      return NextResponse.json({ error: "System user cannot be modified" }, { status: 403 });
    }

    // Prevent demoting last superadmin
    if (existing.role === "superadmin" && body.role && body.role !== "superadmin") {
      const superadminCount = db
        .select()
        .from(users)
        .where(and(eq(users.role, "superadmin"), eq(users.isActive, true)))
        .all().length;

      if (superadminCount <= 1) {
        return NextResponse.json({ error: "Cannot demote the last superadmin" }, { status: 400 });
      }
    }

    // Prevent self-deactivation
    const sessionUserId = getSessionUserId(session);
    if (numId === sessionUserId && body.isActive === false) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    let shouldInvalidateTokens = false;

    if (body.displayName !== undefined) updates.displayName = body.displayName;
    if (body.role !== undefined) {
      if (!["user", "admin", "superadmin"].includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.forcePasswordChange !== undefined) {
      updates.forcePasswordChange = body.forcePasswordChange;
    }
    if (body.email !== undefined) {
      // Check unique email (exclude this user)
      const emailConflict = db
        .select()
        .from(users)
        .where(and(eq(users.email, body.email.toLowerCase()), ne(users.id, numId)))
        .get();
      if (emailConflict) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      updates.email = body.email.toLowerCase();
    }
    if (body.username !== undefined) {
      const usernameVal = body.username ? body.username.toLowerCase() : null;
      if (usernameVal) {
        if (
          usernameVal.length < 3 ||
          usernameVal.length > 30 ||
          !/^[a-zA-Z0-9._-]+$/.test(usernameVal)
        ) {
          return NextResponse.json(
            {
              error:
                "Username must be 3-30 characters (letters, numbers, dots, hyphens, underscores)",
            },
            { status: 400 },
          );
        }
        const usernameConflict = db
          .select()
          .from(users)
          .where(and(eq(users.username, usernameVal), ne(users.id, numId)))
          .get();
        if (usernameConflict) {
          return NextResponse.json({ error: "Username already in use" }, { status: 409 });
        }
      }
      updates.username = usernameVal;
    }
    if (body.newPassword !== undefined && body.newPassword !== "") {
      const validation = validatePassword(body.newPassword);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors[0] }, { status: 400 });
      }
      updates.passwordHash = hashSync(body.newPassword, 12);
      shouldInvalidateTokens = true;
    }

    db.update(users).set(updates).where(eq(users.id, numId)).run();

    // Invalidate tokens if role changed, user deactivated, or password changed
    const roleChanged = body.role !== undefined && body.role !== existing.role;
    const deactivated = body.isActive === false && existing.isActive;
    if (roleChanged || deactivated || shouldInvalidateTokens) {
      invalidateUserTokens(numId);
    }

    // Return updated user
    const updated = db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        forcePasswordChange: users.forcePasswordChange,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, numId))
      .get();

    return NextResponse.json(updated);
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Soft-delete a user (set isActive = false)
 * Admin only
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    // Prevent self-deletion
    const sessionUserId = getSessionUserId(session);
    if (numId === sessionUserId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const existing = db.select().from(users).where(eq(users.id, numId)).get();
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deletion of the system user
    if (existing.authId === SYSTEM_AUTH_ID) {
      return NextResponse.json({ error: "System user cannot be deleted" }, { status: 403 });
    }

    // Prevent deleting last superadmin
    if (existing.role === "superadmin") {
      const superadminCount = db
        .select()
        .from(users)
        .where(and(eq(users.role, "superadmin"), eq(users.isActive, true)))
        .all().length;

      if (superadminCount <= 1) {
        return NextResponse.json({ error: "Cannot delete the last superadmin" }, { status: 400 });
      }
    }

    db.update(users)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, numId))
      .run();

    invalidateUserTokens(numId);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
