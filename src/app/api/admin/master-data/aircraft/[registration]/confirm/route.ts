import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { aircraft } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/master-data/aircraft/confirm");

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ registration: string }> }
) {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { registration } = await params;

    if (!registration) {
      return NextResponse.json(
        { error: "Aircraft registration required" },
        { status: 400 }
      );
    }

    const decodedReg = decodeURIComponent(registration);

    // Update source to "confirmed"
    await db
      .update(aircraft)
      .set({
        source: "confirmed",
        updatedAt: new Date().toISOString(),
        updatedBy: session.user.id,
      })
      .where(eq(aircraft.registration, decodedReg));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Confirmation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
