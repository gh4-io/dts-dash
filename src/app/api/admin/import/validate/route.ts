/**
 * POST /api/admin/import/validate
 *
 * Schema-driven validation. Accepts schemaId + content + fieldMapping,
 * returns ValidationPreview with errors, warnings, badges, preview rows.
 *
 * Backwards-compatible: if no schemaId is provided and jsonContent is present,
 * falls back to work-packages validation (legacy behavior).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { ensureSchemasLoaded, getSchema } from "@/lib/import/registry";
import {
  parseContent,
  detectFormat,
  checkContentSize,
  stripImportTypeKey,
} from "@/lib/import/parser";
import { autoMap, extractSourceFields } from "@/lib/import/mapping";
import { validateRecords } from "@/lib/import/validator";
import type { FieldMapping, ImportContext } from "@/lib/import/types";

const log = createChildLogger("api/admin/import/validate");

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Legacy fallback: if jsonContent is provided without schemaId, assume work-packages
    const schemaId = body.schemaId || (body.jsonContent ? "work-packages" : null);
    const content = body.content || body.jsonContent;
    const format = body.format;
    const fieldMapping: FieldMapping[] | undefined = body.fieldMapping;

    if (!schemaId) {
      return NextResponse.json({ error: "schemaId is required" }, { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { valid: false, errors: ["content (string) is required"] },
        { status: 400 },
      );
    }

    await ensureSchemasLoaded();
    const schema = getSchema(schemaId);
    if (!schema) {
      return NextResponse.json({ error: `Unknown schema: ${schemaId}` }, { status: 400 });
    }

    // Size check
    const sizeError = checkContentSize(content, schema.maxSizeMB || 50);
    if (sizeError) {
      return NextResponse.json({ valid: false, errors: [sizeError] }, { status: 400 });
    }

    // Parse
    const detectedFormat = format || detectFormat(content);
    if (!detectedFormat) {
      return NextResponse.json(
        { valid: false, errors: ["Could not detect format"] },
        { status: 400 },
      );
    }

    const parseResult = parseContent(content, detectedFormat);
    let records = parseResult.records;

    // PreProcess
    if (schema.preProcess) {
      records = schema.preProcess(records);
    }

    // Strip reserved _importType key
    records = stripImportTypeKey(records);

    // Auto-map if no mapping provided
    const mapping = fieldMapping || autoMap(extractSourceFields(records), schema.fields);

    // Build context
    const ctx: ImportContext = {
      userId: Number(session.user.id),
      source: "file",
      format: detectedFormat as "json" | "csv",
      schemaId,
    };

    // Validate
    const preview = await validateRecords(records, schema, mapping, ctx);

    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ err: error }, "POST error");
    return NextResponse.json({ valid: false, errors: [message] }, { status: 500 });
  }
}
