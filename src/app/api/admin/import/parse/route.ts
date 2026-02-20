/**
 * POST /api/admin/import/parse
 *
 * Parse raw content and return source fields + auto-mapping suggestion.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { ensureSchemasLoaded, getSchema } from "@/lib/import/registry";
import { parseContent, detectFormat, checkContentSize } from "@/lib/import/parser";
import { autoMap, extractSourceFields } from "@/lib/import/mapping";

const log = createChildLogger("api/admin/import/parse");

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { schemaId, content, format: requestedFormat } = body;

    if (!schemaId || !content) {
      return NextResponse.json({ error: "schemaId and content are required" }, { status: 400 });
    }

    await ensureSchemasLoaded();
    const schema = getSchema(schemaId);
    if (!schema) {
      return NextResponse.json({ error: `Unknown schema: ${schemaId}` }, { status: 400 });
    }

    // Check size limit
    const sizeError = checkContentSize(content, schema.maxSizeMB || 50);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    // Detect or use provided format
    const detectedFormat = requestedFormat || detectFormat(content);
    if (!detectedFormat) {
      return NextResponse.json(
        { error: "Could not detect format. Please specify 'json' or 'csv'." },
        { status: 400 },
      );
    }

    // Parse content
    const parseResult = parseContent(content, detectedFormat);

    // Run preProcess if the schema defines it
    let records = parseResult.records;
    if (schema.preProcess) {
      records = schema.preProcess(records);
    }

    // Extract source fields from the (possibly preprocessed) records
    const sourceFields = extractSourceFields(records);

    // Auto-map source fields to schema fields
    const suggestedMapping = autoMap(sourceFields, schema.fields);

    return NextResponse.json({
      sourceFields,
      suggestedMapping,
      recordCount: records.length,
      detectedFormat,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: `Parse failed: ${message}` }, { status: 422 });
  }
}
