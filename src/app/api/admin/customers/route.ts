import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getContrastText, isValidHex } from "@/lib/utils/contrast";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/customers");

/**
 * GET /api/admin/customers
 * Returns all active customers (any authenticated user can read for color lookups)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allCustomers = db.select().from(customers).orderBy(customers.sortOrder).all();

    return NextResponse.json(allCustomers);
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/customers
 * Bulk update customers: accepts Array<{id, color, displayName?, sortOrder?}>
 * Admin only
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Expected array of updates" }, { status: 400 });
    }

    const now = new Date().toISOString();
    let updated = 0;

    for (const item of body) {
      if (!item.id) continue;

      const updates: Record<string, unknown> = { updatedAt: now };

      if (item.color) {
        if (!isValidHex(item.color)) {
          return NextResponse.json({ error: `Invalid hex color: ${item.color}` }, { status: 400 });
        }
        updates.color = item.color;
        updates.colorText = getContrastText(item.color);
      }
      if (item.displayName !== undefined) updates.displayName = item.displayName;
      if (item.sortOrder !== undefined) updates.sortOrder = item.sortOrder;

      db.update(customers).set(updates).where(eq(customers.id, item.id)).run();

      updated++;
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/customers
 * Create a new customer
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, displayName, color } = body;

    if (!name || !displayName || !color) {
      return NextResponse.json(
        { error: "name, displayName, and color are required" },
        { status: 400 },
      );
    }

    if (!isValidHex(color)) {
      return NextResponse.json({ error: `Invalid hex color: ${color}` }, { status: 400 });
    }

    // Check unique name
    const existing = db.select().from(customers).where(eq(customers.name, name)).get();

    if (existing) {
      return NextResponse.json(
        { error: "A customer with this name already exists" },
        { status: 409 },
      );
    }

    // Get max sortOrder
    const maxSort = db
      .select({ max: sql<number>`MAX(${customers.sortOrder})` })
      .from(customers)
      .get();

    const now = new Date().toISOString();
    const newCustomer = db
      .insert(customers)
      .values({
        name,
        displayName,
        color,
        colorText: getContrastText(color),
        isActive: true,
        sortOrder: (maxSort?.max ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
