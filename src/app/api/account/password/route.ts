import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users, sessions } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { compareSync, hashSync } from "bcryptjs";
import {
  validatePassword,
  formatPasswordErrors,
} from "@/lib/utils/password-validation";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/account/password");

// Unified error to prevent account enumeration
const INVALID_CREDENTIALS = "Current password is incorrect";

/**
 * PUT /api/account/password
 * Change current user's password.
 * Requires current password verification.
 * Bumps tokenVersion to invalidate all other JWT tokens.
 * Deletes other DB sessions (keeps current session alive).
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

    if (typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      );
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: formatPasswordErrors(validation.errors) },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must differ from current password" },
        { status: 400 }
      );
    }

    // Fetch user
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .get();

    if (!user) {
      // Unified error — don't reveal whether user exists
      return NextResponse.json(
        { error: INVALID_CREDENTIALS },
        { status: 403 }
      );
    }

    // Verify current password
    const isValid = compareSync(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: INVALID_CREDENTIALS },
        { status: 403 }
      );
    }

    // Update password and bump tokenVersion
    const newHash = hashSync(newPassword, 10);
    db.update(users)
      .set({
        passwordHash: newHash,
        tokenVersion: user.tokenVersion + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, session.user.id))
      .run();

    // Delete other DB sessions (keep current session alive via JWT)
    // The tokenVersion bump will invalidate other JWT tokens on their next request
    const currentSessionId = (session as unknown as { sessionId?: string })
      .sessionId;
    if (currentSessionId) {
      db.delete(sessions)
        .where(
          and(
            eq(sessions.userId, session.user.id),
            ne(sessions.id, currentSessionId)
          )
        )
        .run();
    } else {
      // Fallback: delete all sessions for user
      db.delete(sessions)
        .where(eq(sessions.userId, session.user.id))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
