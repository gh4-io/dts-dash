import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, appConfig, inviteCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { validatePassword, formatPasswordErrors } from "@/lib/utils/password-validation";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/auth/register");

/** Count "real" users — those with a non-empty password hash (excludes the system user). */
function countRealUsers(): number {
  return db
    .select()
    .from(users)
    .all()
    .filter((u) => u.passwordHash !== "").length;
}

/**
 * GET /api/auth/register
 * Returns registration availability status.
 */
export async function GET() {
  try {
    const realCount = countRealUsers();

    if (realCount === 0) {
      return NextResponse.json({
        registrationOpen: true,
        isFirstUser: true,
        requiresInviteCode: false,
      });
    }

    const regRow = db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "registrationEnabled"))
      .get();
    const enabled = regRow?.value === "true";

    return NextResponse.json({
      registrationOpen: enabled,
      isFirstUser: false,
      requiresInviteCode: true,
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/auth/register
 * Create a new user account.
 *
 * First-user path: no invite code needed, becomes superadmin.
 * Subsequent users: requires valid invite code, becomes user role.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, displayName, password, inviteCode } = body;

    // ─── Validate common fields ────────────────────────────────────────────
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

    const emailLower = email.toLowerCase();

    // Check email uniqueness
    const existing = db.select().from(users).where(eq(users.email, emailLower)).get();
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const realCount = countRealUsers();
    const now = new Date().toISOString();
    const passwordHash = hashSync(password, 10);

    // ─── First-user path ───────────────────────────────────────────────────
    if (realCount === 0) {
      db.insert(users)
        .values({
          authId: crypto.randomUUID(),
          email: emailLower,
          username: null,
          displayName: displayName || "Admin",
          passwordHash,
          role: "superadmin",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      log.info({ email: emailLower }, "First user registered as superadmin");
      return NextResponse.json({ success: true, role: "superadmin" });
    }

    // ─── Subsequent user path ──────────────────────────────────────────────

    // Check registration is enabled
    const regRow = db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "registrationEnabled"))
      .get();

    if (regRow?.value !== "true") {
      return NextResponse.json(
        { error: "Registration is not currently available" },
        { status: 403 },
      );
    }

    // Validate invite code
    if (!inviteCode) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const codeRow = db
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, inviteCode), eq(inviteCodes.isActive, true)))
      .get();

    if (!codeRow) {
      return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 400 });
    }

    // Check uses
    if (codeRow.currentUses >= codeRow.maxUses) {
      return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 400 });
    }

    // Check expiration
    if (codeRow.expiresAt && new Date(codeRow.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 400 });
    }

    // Create user
    db.insert(users)
      .values({
        authId: crypto.randomUUID(),
        email: emailLower,
        username: null,
        displayName: displayName || emailLower.split("@")[0],
        passwordHash,
        role: "user",
        isActive: true,
        forcePasswordChange: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Increment invite code usage
    db.update(inviteCodes)
      .set({
        currentUses: codeRow.currentUses + 1,
        updatedAt: now,
      })
      .where(eq(inviteCodes.id, codeRow.id))
      .run();

    log.info({ email: emailLower, inviteCodeId: codeRow.id }, "User registered via invite code");
    return NextResponse.json({ success: true, role: "user" });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
