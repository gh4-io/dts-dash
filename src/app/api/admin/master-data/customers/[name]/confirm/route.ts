import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name } = await params;

    if (!name) {
      return NextResponse.json(
        { error: "Customer name required" },
        { status: 400 }
      );
    }

    const decodedName = decodeURIComponent(name);

    // Update source to "confirmed"
    await db
      .update(customers)
      .set({
        source: "confirmed",
        updatedAt: new Date().toISOString(),
        updatedBy: session.user.id,
      })
      .where(eq(customers.name, decodedName));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[confirm-customer] Error:", error);
    return NextResponse.json(
      {
        error: "Confirmation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
