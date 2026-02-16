import { NextRequest, NextResponse } from "next/server";
import { auth, invalidateUserTokens } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";

/**
 * PUT /api/admin/users/[id]
 * Update a user (displayName, role, isActive, email)
 * Admin only
 */
export async function PUT(
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

    const existing = db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent demoting last superadmin
    if (existing.role === "superadmin" && body.role && body.role !== "superadmin") {
      const superadminCount = db
        .select()
        .from(users)
        .where(and(eq(users.role, "superadmin"), eq(users.isActive, true)))
        .all().length;

      if (superadminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last superadmin" },
          { status: 400 }
        );
      }
    }

    // Prevent self-deactivation
    if (id === session.user.id && body.isActive === false) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.displayName !== undefined) updates.displayName = body.displayName;
    if (body.role !== undefined) {
      if (!["user", "admin", "superadmin"].includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.email !== undefined) {
      // Check unique email (exclude this user)
      const emailConflict = db
        .select()
        .from(users)
        .where(and(eq(users.email, body.email.toLowerCase()), ne(users.id, id)))
        .get();
      if (emailConflict) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 409 }
        );
      }
      updates.email = body.email.toLowerCase();
    }
    if (body.username !== undefined) {
      const usernameVal = body.username ? body.username.toLowerCase() : null;
      if (usernameVal) {
        if (usernameVal.length < 3 || usernameVal.length > 30 || !/^[a-zA-Z0-9._-]+$/.test(usernameVal)) {
          return NextResponse.json(
            { error: "Username must be 3-30 characters (letters, numbers, dots, hyphens, underscores)" },
            { status: 400 }
          );
        }
        const usernameConflict = db
          .select()
          .from(users)
          .where(and(eq(users.username, usernameVal), ne(users.id, id)))
          .get();
        if (usernameConflict) {
          return NextResponse.json(
            { error: "Username already in use" },
            { status: 409 }
          );
        }
      }
      updates.username = usernameVal;
    }

    db.update(users).set(updates).where(eq(users.id, id)).run();

    // Invalidate tokens if role changed or user deactivated
    const roleChanged = body.role !== undefined && body.role !== existing.role;
    const deactivated = body.isActive === false && existing.isActive;
    if (roleChanged || deactivated) {
      invalidateUserTokens(id);
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
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .get();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[api/admin/users/[id]] PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Soft-delete a user (set isActive = false)
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

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const existing = db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting last superadmin
    if (existing.role === "superadmin") {
      const superadminCount = db
        .select()
        .from(users)
        .where(and(eq(users.role, "superadmin"), eq(users.isActive, true)))
        .all().length;

      if (superadminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last superadmin" },
          { status: 400 }
        );
      }
    }

    db.update(users)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .run();

    invalidateUserTokens(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/admin/users/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
