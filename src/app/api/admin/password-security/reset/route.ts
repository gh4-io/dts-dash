import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  updatePasswordRequirements,
  getPasswordRequirements,
  getPasswordRequirementsSource,
} from "@/lib/config/loader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/password-security/reset");

// ─── Hardcoded Defaults (final fallback) ───────────────────────────────────

const DEFAULT_PASSWORD_REQUIREMENTS = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigits: true,
  requireSpecialChars: true,
  preventCommon: true,
  minEntropy: 50,
};

// ─── POST — Reset to env/default requirements ──────────────────────────────

export async function POST() {
  try {
    // Auth check (admin/superadmin only)
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load defaults from ENV vars (if set) → hardcoded defaults
    const envDefaults = loadPasswordEnvConfig();
    const defaults = { ...DEFAULT_PASSWORD_REQUIREMENTS, ...envDefaults };

    // Update in-memory + write to YAML file
    updatePasswordRequirements(defaults);

    log.info(
      {
        userId: session.user.id,
        userEmail: session.user.email,
      },
      "Password requirements reset to defaults",
    );

    // Return updated requirements
    const requirements = getPasswordRequirements();
    const { source } = getPasswordRequirementsSource();

    return NextResponse.json({
      requirements,
      source,
    });
  } catch (error) {
    log.error({ error }, "Failed to reset password requirements");
    return NextResponse.json({ error: "Failed to reset password requirements" }, { status: 500 });
  }
}

// ─── Helper: Load from ENV vars ────────────────────────────────────────────

function loadPasswordEnvConfig() {
  const envConfig: Partial<typeof DEFAULT_PASSWORD_REQUIREMENTS> = {};

  if (process.env.PASSWORD_MIN_LENGTH) {
    const val = parseInt(process.env.PASSWORD_MIN_LENGTH, 10);
    if (!isNaN(val) && val >= 8 && val <= 128) {
      envConfig.minLength = val;
    }
  }

  if (process.env.PASSWORD_MAX_LENGTH) {
    const val = parseInt(process.env.PASSWORD_MAX_LENGTH, 10);
    if (!isNaN(val) && val >= 8 && val <= 128) {
      envConfig.maxLength = val;
    }
  }

  if (process.env.PASSWORD_REQUIRE_UPPERCASE !== undefined) {
    envConfig.requireUppercase = process.env.PASSWORD_REQUIRE_UPPERCASE !== "false";
  }

  if (process.env.PASSWORD_REQUIRE_LOWERCASE !== undefined) {
    envConfig.requireLowercase = process.env.PASSWORD_REQUIRE_LOWERCASE !== "false";
  }

  if (process.env.PASSWORD_REQUIRE_DIGITS !== undefined) {
    envConfig.requireDigits = process.env.PASSWORD_REQUIRE_DIGITS !== "false";
  }

  if (process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== undefined) {
    envConfig.requireSpecialChars = process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== "false";
  }

  if (process.env.PASSWORD_PREVENT_COMMON !== undefined) {
    envConfig.preventCommon = process.env.PASSWORD_PREVENT_COMMON !== "false";
  }

  if (process.env.PASSWORD_MIN_ENTROPY) {
    const val = parseInt(process.env.PASSWORD_MIN_ENTROPY, 10);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      envConfig.minEntropy = val;
    }
  }

  return envConfig;
}
