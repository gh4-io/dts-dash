import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/utils/session-helpers";

// ─── GET — Check if current user needs forced password reset ───────────────

export async function GET() {
  try {
    // Auth check: any authenticated user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query users table for forcePasswordChange field
    const userId = getSessionUserId(session);
    const [user] = await db
      .select({ forcePasswordChange: users.forcePasswordChange })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      forcePasswordChange: user.forcePasswordChange,
    });
  } catch (error) {
    console.error("[check-force-reset] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
