import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashSync } from "bcryptjs";
import { validatePassword, formatPasswordErrors } from "@/lib/utils/password-validation";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/setup");

/**
 * POST /api/setup
 * First-run setup — creates the initial admin user.
 * Only works when zero users exist (excluding system users).
 * Returns 403 after initial admin is created.
 */
export async function POST(request: NextRequest) {
  try {
    // Count real users (exclude system user with empty password hash)
    const realUsers = db
      .select()
      .from(users)
      .all()
      .filter((u) => u.passwordHash !== "");

    if (realUsers.length > 0) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, displayName } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return NextResponse.json({ error: formatPasswordErrors(validation.errors) }, { status: 400 });
    }

    const now = new Date().toISOString();
    db.insert(users)
      .values({
        authId: crypto.randomUUID(),
        email: email.toLowerCase(),
        username: null,
        displayName: displayName || "Admin",
        passwordHash: hashSync(password, 10),
        role: "superadmin",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/setup
 * Check if setup is needed (zero real users)
 */
export async function GET() {
  const realUsers = db
    .select()
    .from(users)
    .all()
    .filter((u) => u.passwordHash !== "");

  return NextResponse.json({ setupRequired: realUsers.length === 0 });
}
