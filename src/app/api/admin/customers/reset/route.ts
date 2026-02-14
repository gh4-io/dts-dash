import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SEED_CUSTOMERS } from "@/lib/db/seed-data";
import { getContrastText } from "@/lib/utils/contrast";

/**
 * POST /api/admin/customers/reset
 * Reset original 6 customers to seed colors/names.
 * Does NOT delete custom-added customers.
 * Admin only
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();
    let resetCount = 0;

    for (const seed of SEED_CUSTOMERS) {
      const existing = db
        .select()
        .from(customers)
        .where(eq(customers.name, seed.name))
        .get();

      if (existing) {
        db.update(customers)
          .set({
            displayName: seed.displayName,
            color: seed.color,
            colorText: getContrastText(seed.color),
            sortOrder: seed.sortOrder,
            isActive: true,
            updatedAt: now,
          })
          .where(eq(customers.id, existing.id))
          .run();
        resetCount++;
      } else {
        // Re-create if it was hard-deleted somehow
        db.insert(customers)
          .values({
            id: crypto.randomUUID(),
            name: seed.name,
            displayName: seed.displayName,
            color: seed.color,
            colorText: getContrastText(seed.color),
            sortOrder: seed.sortOrder,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        resetCount++;
      }
    }

    return NextResponse.json({ success: true, reset: resetCount });
  } catch (error) {
    console.error("[api/admin/customers/reset] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
