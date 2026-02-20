/**
 * GET /api/admin/import/schemas
 *
 * List all registered import schemas (metadata + fields, no commit functions).
 * Optionally filter by category.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import {
  ensureSchemasLoaded,
  getAllSchemas,
  getSchemasByCategory,
  toSerializable,
} from "@/lib/import/registry";

const log = createChildLogger("api/admin/import/schemas");

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await ensureSchemasLoaded();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    if (category) {
      const grouped = getSchemasByCategory();
      const schemas = grouped[category] || [];
      return NextResponse.json({
        schemas: schemas.map(toSerializable),
      });
    }

    const all = getAllSchemas();
    const grouped = getSchemasByCategory();

    return NextResponse.json({
      schemas: all.map(toSerializable),
      categories: Object.keys(grouped),
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Failed to fetch schemas" }, { status: 500 });
  }
}
