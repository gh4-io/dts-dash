import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFlightSettings, updateFlightSettings, type FlightSettings } from "@/lib/config/loader";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/server/flights");

// ─── GET — Fetch current flight settings ────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = getFlightSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    log.error({ error }, "Failed to fetch flight settings");
    return NextResponse.json({ error: "Failed to fetch flight settings" }, { status: 500 });
  }
}

// ─── PUT — Update flight settings ───────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { settings } = body as { settings: FlightSettings };

    if (!settings) {
      return NextResponse.json({ error: "Missing settings field" }, { status: 400 });
    }

    if (typeof settings.hideCanceled !== "boolean") {
      return NextResponse.json({ error: "hideCanceled must be a boolean" }, { status: 400 });
    }

    if (
      typeof settings.cleanupGraceHours !== "number" ||
      !Number.isInteger(settings.cleanupGraceHours) ||
      settings.cleanupGraceHours < 1 ||
      settings.cleanupGraceHours > 720
    ) {
      return NextResponse.json(
        { error: "cleanupGraceHours must be an integer between 1 and 720" },
        { status: 400 },
      );
    }

    updateFlightSettings(settings);

    // Invalidate data caches so the new hideCanceled setting takes effect immediately
    invalidateCache();
    invalidateTransformerCache();

    log.info(
      { userId: session.user.id, userEmail: session.user.email, settings },
      "Flight settings updated",
    );

    return NextResponse.json({
      settings: getFlightSettings(),
      message: "Flight settings updated successfully",
    });
  } catch (error) {
    log.error({ error }, "Failed to update flight settings");
    return NextResponse.json({ error: "Failed to update flight settings" }, { status: 500 });
  }
}
