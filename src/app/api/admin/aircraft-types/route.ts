import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { aircraftTypeMappings } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { invalidateMappingsCache } from "@/lib/utils/aircraft-type";
import { createChildLogger } from "@/lib/logger";
import { parseIntParam } from "@/lib/utils/route-helpers";

const log = createChildLogger("api/admin/aircraft-types");

/**
 * GET /api/admin/aircraft-types
 * Returns all mappings ordered by priority DESC
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mappings = db
      .select()
      .from(aircraftTypeMappings)
      .orderBy(desc(aircraftTypeMappings.priority))
      .all();

    return NextResponse.json({ mappings });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/aircraft-types
 * Create a new mapping
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { pattern, canonicalType, description, priority } = body;

    if (!pattern || !canonicalType) {
      return NextResponse.json(
        { error: "pattern and canonicalType are required" },
        { status: 400 },
      );
    }

    const validTypes = ["B777", "B767", "B747", "B757", "B737", "Unknown"];
    if (!validTypes.includes(canonicalType)) {
      return NextResponse.json(
        { error: `canonicalType must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const newMapping = db
      .insert(aircraftTypeMappings)
      .values({
        pattern,
        canonicalType,
        description: description || null,
        priority: priority ?? 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    invalidateMappingsCache();

    return NextResponse.json(newMapping, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/aircraft-types
 * Update a single mapping or bulk reorder
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Bulk update: { mappings: [{ id, priority?, isActive?, canonicalType?, ... }] }
    if (Array.isArray(body.mappings)) {
      for (const item of body.mappings) {
        if (!item.id) continue;
        const updates: Record<string, unknown> = { updatedAt: now };
        if (item.pattern !== undefined) updates.pattern = item.pattern;
        if (item.canonicalType !== undefined) updates.canonicalType = item.canonicalType;
        if (item.description !== undefined) updates.description = item.description;
        if (item.priority !== undefined) updates.priority = item.priority;
        if (item.isActive !== undefined) updates.isActive = item.isActive;
        db.update(aircraftTypeMappings)
          .set(updates)
          .where(eq(aircraftTypeMappings.id, item.id))
          .run();
      }
      invalidateMappingsCache();
      return NextResponse.json({ success: true });
    }

    // Single edit: { id, pattern?, canonicalType?, description?, priority?, isActive? }
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.pattern !== undefined) updates.pattern = body.pattern;
    if (body.canonicalType !== undefined) updates.canonicalType = body.canonicalType;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    db.update(aircraftTypeMappings).set(updates).where(eq(aircraftTypeMappings.id, body.id)).run();

    invalidateMappingsCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "PUT error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/aircraft-types?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Bulk delete: JSON body with { ids: number[] }
    let body: { ids?: number[] } | null = null;
    try {
      body = await request.json();
    } catch {
      // No body — fall through to single-id path
    }

    if (body?.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      db.delete(aircraftTypeMappings).where(inArray(aircraftTypeMappings.id, body.ids)).run();
      invalidateMappingsCache();
      return NextResponse.json({ success: true, count: body.ids.length });
    }

    // Single delete: ?id=xxx
    const idParam = request.nextUrl.searchParams.get("id");
    if (!idParam) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const numId = parseIntParam(idParam);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    db.delete(aircraftTypeMappings).where(eq(aircraftTypeMappings.id, numId)).run();

    invalidateMappingsCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "DELETE error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
