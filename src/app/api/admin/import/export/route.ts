/**
 * POST /api/admin/import/export
 *
 * Export data for a schema with optional filters. Returns file download.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { ensureSchemasLoaded, getSchema } from "@/lib/import/registry";
import { exportData } from "@/lib/import/exporter";

const log = createChildLogger("api/admin/import/export");

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { schemaId, format = "json", filters = {} } = body;

    if (!schemaId) {
      return NextResponse.json({ error: "schemaId is required" }, { status: 400 });
    }

    if (!["json", "csv"].includes(format)) {
      return NextResponse.json({ error: "format must be 'json' or 'csv'" }, { status: 400 });
    }

    await ensureSchemasLoaded();
    const schema = getSchema(schemaId);
    if (!schema) {
      return NextResponse.json({ error: `Unknown schema: ${schemaId}` }, { status: 400 });
    }

    if (!schema.export) {
      return NextResponse.json(
        { error: `Schema "${schemaId}" does not support export` },
        { status: 400 },
      );
    }

    const result = await exportData(schema, filters, format as "json" | "csv");

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
