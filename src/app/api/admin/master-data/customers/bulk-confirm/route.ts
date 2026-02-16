import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/master-data/customers/bulk-confirm");

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { names } = body as { names: string[] };

    if (!names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json(
        { error: "Customer names array required" },
        { status: 400 }
      );
    }

    // Update source to "confirmed" for all matching names
    await db
      .update(customers)
      .set({
        source: "confirmed",
        updatedAt: new Date().toISOString(),
        updatedBy: session.user.id,
      })
      .where(inArray(customers.name, names));

    return NextResponse.json({ success: true, count: names.length });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Bulk confirmation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
