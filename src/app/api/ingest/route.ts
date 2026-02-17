import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/utils/api-auth";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { createChunkSession } from "@/lib/utils/chunk-session";
import { validateImportData, commitImportData } from "@/lib/data/import-utils";
import { db } from "@/lib/db/client";
import { appConfig, importLog } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/ingest");

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * POST /api/ingest
 *
 * External data ingestion endpoint for Power Automate / automation systems.
 * Auth: Bearer token (configured in Admin Settings)
 * Rate limit: configurable (default 60s between requests)
 * Idempotency: optional Idempotency-Key header prevents duplicate imports
 *
 * Supports Microsoft Power Automate chunked uploads:
 * When x-ms-transfer-mode: chunked is detected, returns a Location header
 * for the client to send chunks via PATCH requests.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate via Bearer token
    const authResult = verifyApiKey(request);
    if (!authResult.authenticated) {
      log.warn("Authentication failed");
      return authResult.error!;
    }

    log.info({ keyHash: authResult.keyHash!.slice(0, 8) }, "Ingest request authenticated");

    // 2. Rate limit (keyed by sha256 hash of API key)
    const rateLimitRow = db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "ingestRateLimitSeconds"))
      .get();
    const rateLimitMs = parseInt(rateLimitRow?.value ?? "60", 10) * 1000;

    const rateResult = checkRateLimit(authResult.keyHash!, rateLimitMs);
    if (!rateResult.allowed) {
      log.warn({ retryAfter: rateResult.retryAfterSeconds }, "Rate limit exceeded");
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateResult.retryAfterSeconds),
          },
        },
      );
    }

    // 3. Check Idempotency-Key header for duplicate prevention
    const idempotencyKey = request.headers.get("idempotency-key");

    if (idempotencyKey) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const existing = db
        .select()
        .from(importLog)
        .where(
          and(
            eq(importLog.idempotencyKey, idempotencyKey),
            gt(importLog.importedAt, twentyFourHoursAgo),
          ),
        )
        .get();

      if (existing) {
        log.info(
          { logId: existing.id, idempotencyKey },
          "Idempotent replay — returning cached result",
        );
        return NextResponse.json({
          success: true,
          logId: existing.id,
          summary: {
            recordCount: existing.recordCount,
          },
          warnings: [],
          idempotent: true,
        });
      }
    }

    // 4. Check for Microsoft Power Automate chunked transfer
    const transferMode = request.headers.get("x-ms-transfer-mode");
    if (transferMode?.toLowerCase() === "chunked") {
      const contentLengthStr = request.headers.get("x-ms-content-length");
      if (!contentLengthStr) {
        log.warn("Chunked transfer missing x-ms-content-length header");
        return NextResponse.json(
          { error: "x-ms-content-length header required for chunked transfer" },
          { status: 400 },
        );
      }

      const expectedSize = parseInt(contentLengthStr, 10);
      if (isNaN(expectedSize) || expectedSize <= 0) {
        log.warn({ value: contentLengthStr }, "Invalid x-ms-content-length");
        return NextResponse.json({ error: "Invalid x-ms-content-length value" }, { status: 400 });
      }

      // Validate against size limit
      const sizeRow = db.select().from(appConfig).where(eq(appConfig.key, "ingestMaxSizeMB")).get();
      const maxSizeMB = parseInt(sizeRow?.value ?? "50", 10);

      if (expectedSize > maxSizeMB * 1024 * 1024) {
        log.warn({ expectedSize, maxSizeMB }, "Chunked transfer exceeds size limit");
        return NextResponse.json(
          { error: `Payload exceeds ${maxSizeMB}MB limit` },
          { status: 413 },
        );
      }

      // Load chunk session timeout
      const timeoutRow = db
        .select()
        .from(appConfig)
        .where(eq(appConfig.key, "ingestChunkTimeoutSeconds"))
        .get();
      const timeoutMs = parseInt(timeoutRow?.value ?? "300", 10) * 1000;

      // Create session
      const session = createChunkSession(
        expectedSize,
        authResult.keyHash!,
        idempotencyKey,
        timeoutMs,
      );

      const baseUrl = request.nextUrl.origin;
      const location = `${baseUrl}/api/ingest/chunks/${session.id}`;

      log.info(
        { sessionId: session.id, expectedSize, location },
        "Chunked upload session created — awaiting chunks",
      );

      return new NextResponse(null, {
        status: 200,
        headers: {
          Location: location,
          "x-ms-chunk-size": String(5 * 1024 * 1024), // 5MB suggested
        },
      });
    }

    // 5. Read raw body (standard non-chunked flow)
    let jsonContent: string;
    try {
      jsonContent = await request.text();
    } catch {
      log.warn("Failed to read request body");
      return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
    }

    if (!jsonContent || jsonContent.trim().length === 0) {
      log.warn("Request body is empty");
      return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    }

    log.info({ bodySize: jsonContent.length }, "Request body received");

    // 6. Load configurable size limit and validate
    const sizeRow = db.select().from(appConfig).where(eq(appConfig.key, "ingestMaxSizeMB")).get();
    const maxSizeMB = parseInt(sizeRow?.value ?? "50", 10);

    // Check size before full validation (early exit for oversized payloads)
    if (jsonContent.length > maxSizeMB * 1024 * 1024) {
      log.warn({ bodySize: jsonContent.length, maxSizeMB }, "Payload exceeds size limit");
      return NextResponse.json({ error: `Payload exceeds ${maxSizeMB}MB limit` }, { status: 413 });
    }

    const validation = validateImportData(jsonContent, maxSizeMB);

    if (!validation.valid) {
      log.warn({ errors: validation.errors, warnings: validation.warnings }, "Validation failed");
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
        recordCount: validation.summary?.recordCount,
        customerCount: validation.summary?.customerCount,
        aircraftCount: validation.summary?.aircraftCount,
        warningCount: validation.warnings.length,
      },
      "Validation passed",
    );

    // 7. Short-circuit for empty payloads (nothing to commit)
    if (!validation.records || validation.records.length === 0) {
      log.info("Empty payload — no records to import (204)");
      return new NextResponse(null, { status: 204 });
    }

    // 8. Commit (UPSERT into work_packages by GUID)
    const result = await commitImportData({
      records: validation.records,
      source: "api",
      importedBy: SYSTEM_USER_ID,
      idempotencyKey: idempotencyKey || undefined,
    });

    log.info(
      {
        logId: result.logId,
        recordCount: result.recordCount,
        upsertedCount: result.upsertedCount,
        success: result.success,
      },
      "Import committed",
    );

    // 9. Response
    return NextResponse.json({
      success: true,
      logId: result.logId,
      summary: validation.summary,
      warnings: validation.warnings,
    });
  } catch (error) {
    log.error({ err: error }, "Unhandled error in POST /api/ingest");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
