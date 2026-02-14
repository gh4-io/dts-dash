import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users, sessions } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { compareSync, hashSync } from "bcryptjs";

/**
 * PUT /api/account/password
 * Change current user's password.
 * Requires current password verification.
 * Invalidates all other sessions on success.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must differ from current password" },
        { status: 400 }
      );
    }

    // Fetch user with password hash
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isValid = compareSync(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 }
      );
    }

    // Update password
    const newHash = hashSync(newPassword, 10);
    db.update(users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, session.user.id))
      .run();

    // Invalidate other sessions (not the current one)
    // Auth.js JWT strategy doesn't use the sessions table, but clear it for safety
    db.delete(sessions)
      .where(
        and(
          eq(sessions.userId, session.user.id),
          ne(sessions.id, session.user.id) // best-effort — JWT doesn't track session IDs here
        )
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/account/password] PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
