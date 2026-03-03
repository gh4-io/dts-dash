/**
 * POST /api/admin/import/commit
 *
 * Schema-driven commit. Accepts schemaId + content + fieldMapping,
 * calls schema.commit(), logs to import_log.
 *
 * Backwards-compatible: if no schemaId is provided and jsonContent is present,
 * falls back to work-packages commit (legacy behavior).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { ensureSchemasLoaded, getSchema } from "@/lib/import/registry";
import {
  parseContent,
  detectFormat,
  checkContentSize,
  stripImportTypeKey,
} from "@/lib/import/parser";
import { autoMap, applyMapping, extractSourceFields } from "@/lib/import/mapping";
import type { FieldMapping, ImportContext } from "@/lib/import/types";

const log = createChildLogger("api/admin/import/commit");

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Legacy fallback
    const schemaId = body.schemaId || (body.jsonContent ? "work-packages" : null);
    const content = body.content || body.jsonContent;
    const format = body.format;
    const source = body.source || "file";
    const fileName = body.fileName;
    const fieldMapping: FieldMapping[] | undefined = body.fieldMapping;

    if (!schemaId) {
      return NextResponse.json({ error: "schemaId is required" }, { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    if (!["file", "paste", "api"].includes(source)) {
      return NextResponse.json(
        { error: "source must be 'file', 'paste', or 'api'" },
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
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    // Parse
    const detectedFormat = format || detectFormat(content);
    if (!detectedFormat) {
      return NextResponse.json({ error: "Could not detect format" }, { status: 400 });
    }

    const parseResult = parseContent(content, detectedFormat);
    let records = parseResult.records;

    // PreProcess
    if (schema.preProcess) {
      records = schema.preProcess(records);
    }

    // Strip reserved _importType key
    records = stripImportTypeKey(records);

    // Map fields
    const mapping = fieldMapping || autoMap(extractSourceFields(records), schema.fields);
    const mappedRecords = applyMapping(records, mapping, schema.fields);

    // Build context
    const userId = getSessionUserId(session);
    const ctx: ImportContext = {
      userId,
      source: source as "file" | "paste" | "api",
      fileName,
      format: detectedFormat as "json" | "csv",
      schemaId,
    };

    // Commit
    const result = await schema.commit(mappedRecords, ctx);

    // PostCommit hook
    if (result.success && schema.postCommit) {
      try {
        await schema.postCommit(result, ctx);
      } catch (hookErr) {
        log.error({ err: hookErr }, "postCommit hook error");
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
