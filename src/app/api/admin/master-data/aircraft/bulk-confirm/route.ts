import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { aircraft } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/admin/master-data/aircraft/bulk-confirm");

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { registrations } = body as { registrations: string[] };

    if (!registrations || !Array.isArray(registrations) || registrations.length === 0) {
      return NextResponse.json({ error: "Aircraft registrations array required" }, { status: 400 });
    }

    // Update source to "confirmed" for all matching registrations
    const userId = getSessionUserId(session);
    await db
      .update(aircraft)
      .set({
        source: "confirmed",
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      })
      .where(inArray(aircraft.registration, registrations));

    return NextResponse.json({ success: true, count: registrations.length });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Bulk confirmation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
