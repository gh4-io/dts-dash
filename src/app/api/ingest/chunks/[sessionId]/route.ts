import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/utils/api-auth";
import { validateImportData, commitImportData } from "@/lib/data/import-utils";
import { db } from "@/lib/db/client";
import { appConfig, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import {
  getChunkSession,
  appendChunk,
  isComplete,
  assembleAndDelete,
  deleteSession,
} from "@/lib/utils/chunk-session";

const log = createChildLogger("api/ingest/chunks");

const SYSTEM_AUTH_ID = "00000000-0000-0000-0000-000000000000";

function getSystemUserId(): number {
  const row = db.select({ id: users.id }).from(users).where(eq(users.authId, SYSTEM_AUTH_ID)).get();
  if (!row)
    throw new Error(
      "System user not found — ensure the system user exists with authId " + SYSTEM_AUTH_ID,
    );
  return row.id;
}

/**
 * PATCH /api/ingest/chunks/[sessionId]
 *
 * Receives a chunk of data for a chunked upload session initiated by
 * POST /api/ingest with x-ms-transfer-mode: chunked.
 *
 * Microsoft Power Automate chunking protocol:
 * - Content-Range: bytes=<start>-<end>/<total>
 * - Body: raw chunk bytes
 * - Server confirms with Range header until all bytes received
 * - On final chunk: assemble, validate, and commit through standard pipeline
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    // 1. Authenticate (same Bearer token as the initiating POST)
    const authResult = verifyApiKey(request);
    if (!authResult.authenticated) {
      log.warn("Chunk PATCH authentication failed");
      return authResult.error!;
    }

    const { sessionId } = await params;

    // 2. Load timeout config
    const timeoutRow = db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "ingestChunkTimeoutSeconds"))
      .get();
    const timeoutMs = parseInt(timeoutRow?.value ?? "300", 10) * 1000;

    // 3. Look up session
    const session = getChunkSession(sessionId, timeoutMs);
    if (!session) {
      log.warn({ sessionId }, "Chunk session not found or expired");
      return NextResponse.json({ error: "Chunk session not found or expired" }, { status: 404 });
    }

    // 4. Verify ownership (same API key that created the session)
    if (session.keyHash !== authResult.keyHash) {
      log.warn({ sessionId }, "Chunk PATCH API key mismatch");
      return NextResponse.json({ error: "Forbidden: API key mismatch" }, { status: 403 });
    }

    // 5. Parse Content-Range header: "bytes <start>-<end>/<total>"
    const contentRange = request.headers.get("content-range");
    if (!contentRange) {
      log.warn({ sessionId }, "Chunk PATCH missing Content-Range header");
      return NextResponse.json({ error: "Content-Range header required" }, { status: 400 });
    }

    const rangeMatch = contentRange.match(/^bytes[= ](\d+)-(\d+)\/(\d+)$/);
    if (!rangeMatch) {
      log.warn({ sessionId, contentRange }, "Invalid Content-Range format");
      return NextResponse.json(
        {
          error: "Invalid Content-Range format. Expected: bytes <start>-<end>/<total>",
        },
        { status: 400 },
      );
    }

    const rangeStart = parseInt(rangeMatch[1], 10);
    const rangeEnd = parseInt(rangeMatch[2], 10);
    const rangeTotal = parseInt(rangeMatch[3], 10);

    // Validate total matches session expectation
    if (rangeTotal !== session.expectedSize) {
      log.warn(
        { sessionId, rangeTotal, expectedSize: session.expectedSize },
        "Content-Range total mismatch — aborting session",
      );
      deleteSession(sessionId);
      return NextResponse.json(
        {
          error: `Content-Range total (${rangeTotal}) does not match expected size (${session.expectedSize})`,
        },
        { status: 400 },
      );
    }

    // 6. Read chunk body as Buffer
    const arrayBuffer = await request.arrayBuffer();
    const chunk = Buffer.from(arrayBuffer);

    // Validate chunk size matches range span
    const expectedChunkSize = rangeEnd - rangeStart + 1;
    if (chunk.length !== expectedChunkSize) {
      log.warn(
        { sessionId, chunkLength: chunk.length, expectedChunkSize },
        "Chunk size does not match Content-Range span",
      );
      return NextResponse.json(
        {
          error: `Chunk size (${chunk.length}) does not match Content-Range span (${expectedChunkSize})`,
        },
        { status: 400 },
      );
    }

    // 7. Append chunk
    try {
      appendChunk(sessionId, chunk, rangeStart, rangeEnd);
    } catch (err) {
      log.warn(
        { sessionId, err: (err as Error).message },
        "Failed to append chunk — aborting session",
      );
      deleteSession(sessionId);
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    log.info(
      {
        sessionId,
        rangeStart,
        rangeEnd,
        receivedBytes: session.receivedBytes,
        expectedSize: session.expectedSize,
        progress: `${Math.round((session.receivedBytes / session.expectedSize) * 100)}%`,
      },
      "Chunk received",
    );

    // 8. If not complete, confirm receipt and await more chunks
    if (!isComplete(sessionId)) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          Range: `bytes=0-${rangeEnd}`,
        },
      });
    }

    // 9. All chunks received — assemble and process
    log.info(
      { sessionId, totalBytes: session.receivedBytes },
      "All chunks received — assembling payload",
    );

    const jsonContent = assembleAndDelete(sessionId);

    // 10. Size limit check (belt + suspenders)
    const sizeRow = db.select().from(appConfig).where(eq(appConfig.key, "ingestMaxSizeMB")).get();
    const maxSizeMB = parseInt(sizeRow?.value ?? "50", 10);

    if (jsonContent.length > maxSizeMB * 1024 * 1024) {
      log.warn(
        { assembledSize: jsonContent.length, maxSizeMB },
        "Assembled payload exceeds size limit",
      );
      return NextResponse.json(
        { error: `Assembled payload exceeds ${maxSizeMB}MB limit` },
        { status: 413 },
      );
    }

    // 11. Validate (reuse existing pipeline)
    const validation = validateImportData(jsonContent, maxSizeMB);

    if (!validation.valid) {
      log.warn(
        { sessionId, errors: validation.errors, warnings: validation.warnings },
        "Assembled payload validation failed",
      );
      return NextResponse.json(
        {
          error: "Validation failed",
          summary: validation.summary,
          warnings: validation.warnings,
          errors: validation.errors,
        },
        { status: 422 },
      );
    }

    log.info(
      {
        sessionId,
        recordCount: validation.summary?.recordCount,
        customerCount: validation.summary?.customerCount,
        aircraftCount: validation.summary?.aircraftCount,
        warningCount: validation.warnings.length,
      },
      "Assembled payload validation passed",
    );

    // 12. Short-circuit for empty payloads
    if (!validation.records || validation.records.length === 0) {
      log.info({ sessionId }, "Chunked upload — no records to import (204)");
      return new NextResponse(null, {
        status: 204,
        headers: { Range: `bytes=0-${session.expectedSize - 1}` },
      });
    }

    // 13. Commit (UPSERT into work_packages by GUID)
    const result = await commitImportData({
      records: validation.records,
      source: "api",
      importedBy: getSystemUserId(),
      idempotencyKey: session.idempotencyKey || undefined,
    });

    log.info(
      {
        sessionId,
        logId: result.logId,
        recordCount: result.recordCount,
        newCount: result.newCount,
        changedCount: result.changedCount,
        skippedCount: result.skippedCount,
        upsertedCount: result.upsertedCount,
        success: result.success,
      },
      "Chunked upload import committed",
    );

    // 14. Response (include Range header — PA expects it on every PATCH response)
    return NextResponse.json(
      {
        success: true,
        logId: result.logId,
        summary: validation.summary,
        warnings: validation.warnings,
        counts: {
          total: result.recordCount,
          new: result.newCount,
          changed: result.changedCount,
          skipped: result.skippedCount,
          upserted: result.upsertedCount,
        },
      },
      {
        headers: {
          Range: `bytes=0-${session.expectedSize - 1}`,
        },
      },
    );
  } catch (error) {
    log.error({ err: error }, "Unhandled error in PATCH /api/ingest/chunks");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
