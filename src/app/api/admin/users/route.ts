import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import {
  validatePassword,
  formatPasswordErrors,
} from "@/lib/utils/password-validation";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * GET /api/admin/users
 * List all users (excludes passwordHash)
 * Admin only
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allUsers = db
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
      .orderBy(users.createdAt)
      .all();

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error("[api/admin/users] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, username, displayName, role, password } = body;

    // Validation
    if (!email || !displayName || !role) {
      return NextResponse.json(
        { error: "email, displayName, and role are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (username && (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9._-]+$/.test(username))) {
      return NextResponse.json(
        { error: "Username must be 3-30 characters (letters, numbers, dots, hyphens, underscores)" },
        { status: 400 }
      );
    }

    if (displayName.length < 2 || displayName.length > 50) {
      return NextResponse.json(
        { error: "Display name must be 2-50 characters" },
        { status: 400 }
      );
    }

    if (!["user", "admin", "superadmin"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be user, admin, or superadmin" },
        { status: 400 }
      );
    }

    // Check unique email
    const existingEmail = db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .get();

    if (existingEmail) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Check unique username
    if (username) {
      const existingUsername = db
        .select()
        .from(users)
        .where(eq(users.username, username.toLowerCase()))
        .get();

      if (existingUsername) {
        return NextResponse.json(
          { error: "A user with this username already exists" },
          { status: 409 }
        );
      }
    }

    if (password) {
      const validation = validatePassword(password);
      if (!validation.valid) {
        return NextResponse.json(
          { error: formatPasswordErrors(validation.errors) },
          { status: 400 }
        );
      }
    }

    const tempPassword = password || generateTempPassword();
    const forcePasswordChange = !password;

    const now = new Date().toISOString();
    const newUser = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      username: username ? username.toLowerCase() : null,
      displayName,
      passwordHash: hashSync(tempPassword, 10),
      role,
      isActive: true,
      forcePasswordChange,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(users).values(newUser).run();

    // Return user without passwordHash, plus tempPassword if generated
    const response: Record<string, unknown> = {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      displayName: newUser.displayName,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    if (!password) {
      response.tempPassword = tempPassword;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[api/admin/users] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
