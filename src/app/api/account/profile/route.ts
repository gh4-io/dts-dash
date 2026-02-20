import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/account/profile");

/**
 * GET /api/account/profile
 * Return current user's profile (username, email, displayName, role).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getSessionUserId(session);
    const user = db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/account/profile
 * Update current user's display name, username, and/or email.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = getSessionUserId(session);
    const body = await request.json();
    const { displayName, username, email } = body;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    // Validate displayName if provided
    if (displayName !== undefined) {
      if (
        typeof displayName !== "string" ||
        displayName.trim().length < 2 ||
        displayName.trim().length > 50
      ) {
        return NextResponse.json(
          { error: "Display name must be 2-50 characters" },
          { status: 400 },
        );
      }
      updates.displayName = displayName.trim();
    }

    // Validate username if provided
    if (username !== undefined) {
      const usernameVal = username ? username.toLowerCase() : null;
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
          .where(and(eq(users.username, usernameVal), ne(users.id, userId)))
          .get();
        if (usernameConflict) {
          return NextResponse.json({ error: "Username already in use" }, { status: 409 });
        }
      }
      updates.username = usernameVal;
    }

    // Validate email if provided
    if (email !== undefined) {
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      const emailLower = email.toLowerCase();
      const emailConflict = db
        .select()
        .from(users)
        .where(and(eq(users.email, emailLower), ne(users.id, userId)))
        .get();
      if (emailConflict) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      updates.email = emailLower;
    }

    // Ensure at least one field is being updated
    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    db.update(users).set(updates).where(eq(users.id, userId)).run();

    // Return updated profile
    const updated = db
      .select({
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
