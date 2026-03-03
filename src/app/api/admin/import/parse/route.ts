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
import {
  parseContent,
  detectFormat,
  checkContentSize,
  detectImportType,
  stripImportTypeKey,
} from "@/lib/import/parser";
import { autoMap, extractSourceFields } from "@/lib/import/mapping";

const log = createChildLogger("api/admin/import/parse");

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !["admin", "superadmin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { schemaId: explicitSchemaId, content, format: requestedFormat } = body;

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    await ensureSchemasLoaded();

    // Resolve schema: explicit > _importType auto-detect > work-packages default
    let detectedSchemaId: string | null = null;
    let resolvedSchemaId: string;

    if (explicitSchemaId) {
      resolvedSchemaId = explicitSchemaId;
    } else {
      detectedSchemaId = detectImportType(content);
      // Validate the detected ID maps to a real schema; fall back to work-packages
      const detectedSchema = getSchema(detectedSchemaId);
      resolvedSchemaId = detectedSchema ? detectedSchemaId : "work-packages";
      if (!detectedSchema) {
        detectedSchemaId = "work-packages";
      }
    }

    const schema = getSchema(resolvedSchemaId);
    if (!schema) {
      return NextResponse.json({ error: `Unknown schema: ${resolvedSchemaId}` }, { status: 400 });
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

    // Strip reserved _importType key before field extraction
    records = stripImportTypeKey(records);

    // Extract source fields from the (possibly preprocessed) records
    const sourceFields = extractSourceFields(records);

    // Auto-map source fields to schema fields
    const suggestedMapping = autoMap(sourceFields, schema.fields);

    return NextResponse.json({
      sourceFields,
      suggestedMapping,
      recordCount: records.length,
      detectedFormat,
      detectedSchemaId,
      schemaId: resolvedSchemaId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: `Parse failed: ${message}` }, { status: 422 });
  }
}
