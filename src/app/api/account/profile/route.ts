import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

    const user = db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .get();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[api/account/profile] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/account/profile
 * Update current user's display name.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName } = body;

    if (
      !displayName ||
      typeof displayName !== "string" ||
      displayName.trim().length < 2 ||
      displayName.trim().length > 50
    ) {
      return NextResponse.json(
        { error: "Display name must be 2-50 characters" },
        { status: 400 }
      );
    }

    db.update(users)
      .set({
        displayName: displayName.trim(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, session.user.id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/account/profile] PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
