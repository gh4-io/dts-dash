import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPasswordRequirements,
  getPasswordRequirementsSource,
  updatePasswordRequirements,
  type PasswordRequirements,
} from "@/lib/config/loader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/password-security");

// ─── GET — Fetch current password requirements ─────────────────────────────

export async function GET() {
  try {
    // Auth check (admin/superadmin only)
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get current requirements from in-memory config
    const requirements = getPasswordRequirements();
    const { source } = getPasswordRequirementsSource();

    return NextResponse.json({
      requirements,
      source,
    });
  } catch (error) {
    log.error({ error }, "Failed to fetch password requirements");
    return NextResponse.json({ error: "Failed to fetch password requirements" }, { status: 500 });
  }
}

// ─── POST — Update password requirements ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth check (admin/superadmin only)
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { requirements } = body as { requirements: PasswordRequirements };

    if (!requirements) {
      return NextResponse.json({ error: "Missing requirements field" }, { status: 400 });
    }

    // Validate requirements
    if (
      requirements.minLength < 8 ||
      requirements.minLength > 128 ||
      requirements.maxLength < 8 ||
      requirements.maxLength > 128 ||
      requirements.minLength > requirements.maxLength
    ) {
      return NextResponse.json(
        {
          error: "Invalid length requirements (must be 8-128, min <= max)",
        },
        { status: 400 },
      );
    }

    if (requirements.minEntropy < 0 || requirements.minEntropy > 100) {
      return NextResponse.json({ error: "Invalid minEntropy (must be 0-100)" }, { status: 400 });
    }

    // Update in-memory + write to YAML file
    updatePasswordRequirements(requirements);

    log.info(
      {
        userId: session.user.id,
        userEmail: session.user.email,
      },
      "Password requirements updated",
    );

    // Return updated requirements with source
    const { source } = getPasswordRequirementsSource();

    return NextResponse.json({
      requirements,
      source,
    });
  } catch (error) {
    log.error({ error }, "Failed to update password requirements");
    return NextResponse.json({ error: "Failed to update password requirements" }, { status: 500 });
  }
}
