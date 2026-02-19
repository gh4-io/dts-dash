import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";

const log = createChildLogger("api/admin/master-data/customers/confirm");

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name } = await params;

    if (!name) {
      return NextResponse.json({ error: "Customer name required" }, { status: 400 });
    }

    const decodedName = decodeURIComponent(name);

    // Update source to "confirmed"
    const userId = getSessionUserId(session);
    await db
      .update(customers)
      .set({
        source: "confirmed",
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      })
      .where(eq(customers.name, decodedName));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Confirmation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
