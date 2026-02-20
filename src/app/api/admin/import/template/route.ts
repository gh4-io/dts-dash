/**
 * GET /api/admin/import/template?schemaId=X&format=Y
 *
 * Download an example template file for a schema.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { ensureSchemasLoaded, getSchema } from "@/lib/import/registry";
import { generateTemplate } from "@/lib/import/exporter";

const log = createChildLogger("api/admin/import/template");

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const schemaId = searchParams.get("schemaId");
    const format = searchParams.get("format") || "json";

    if (!schemaId) {
      return NextResponse.json({ error: "schemaId query parameter is required" }, { status: 400 });
    }

    if (!["json", "csv"].includes(format)) {
      return NextResponse.json({ error: "format must be 'json' or 'csv'" }, { status: 400 });
    }

    await ensureSchemasLoaded();
    const schema = getSchema(schemaId);
    if (!schema) {
      return NextResponse.json({ error: `Unknown schema: ${schemaId}` }, { status: 400 });
    }

    const result = generateTemplate(schema, format as "json" | "csv");

    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    log.error({ err: error }, "GET error");
    return NextResponse.json({ error: "Template generation failed" }, { status: 500 });
  }
}
