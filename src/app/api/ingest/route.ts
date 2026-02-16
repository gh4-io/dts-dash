import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/utils/api-auth";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { validateImportData, commitImportData } from "@/lib/data/import-utils";
import { db } from "@/lib/db/client";
import { appConfig, importLog } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * POST /api/ingest
 *
 * External data ingestion endpoint for Power Automate / automation systems.
 * Auth: Bearer token (configured in Admin Settings)
 * Rate limit: configurable (default 60s between requests)
 * Idempotency: optional Idempotency-Key header prevents duplicate imports
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate via Bearer token
    const authResult = verifyApiKey(request);
    if (!authResult.authenticated) {
      return authResult.error!;
    }

    // 2. Rate limit (keyed by sha256 hash of API key)
    const rateLimitRow = db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "ingestRateLimitSeconds"))
      .get();
    const rateLimitMs = (parseInt(rateLimitRow?.value ?? "60", 10)) * 1000;

    const rateResult = checkRateLimit(authResult.keyHash!, rateLimitMs);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateResult.retryAfterSeconds),
          },
        }
      );
    }

    // 3. Check Idempotency-Key header for duplicate prevention
    const idempotencyKey = request.headers.get("idempotency-key");

    if (idempotencyKey) {
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const existing = db
        .select()
        .from(importLog)
        .where(
          and(
            eq(importLog.idempotencyKey, idempotencyKey),
            gt(importLog.importedAt, twentyFourHoursAgo)
          )
        )
        .get();

      if (existing) {
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

    // 4. Read raw body
    let jsonContent: string;
    try {
      jsonContent = await request.text();
    } catch {
      return NextResponse.json(
        { error: "Failed to read request body" },
        { status: 400 }
      );
    }

    if (!jsonContent || jsonContent.trim().length === 0) {
      return NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 }
      );
    }

    // 5. Load configurable size limit and validate
    const sizeRow = db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "ingestMaxSizeMB"))
      .get();
    const maxSizeMB = parseInt(sizeRow?.value ?? "50", 10);

    // Check size before full validation (early exit for oversized payloads)
    if (jsonContent.length > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Payload exceeds ${maxSizeMB}MB limit` },
        { status: 413 }
      );
    }

    const validation = validateImportData(jsonContent, maxSizeMB);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          summary: validation.summary,
          warnings: validation.warnings,
          errors: validation.errors,
        },
        { status: 422 }
      );
    }

    // 6. Commit
    const result = await commitImportData({
      jsonContent,
      records: validation.records!,
      source: "api",
      importedBy: SYSTEM_USER_ID,
      idempotencyKey: idempotencyKey || undefined,
    });

    // 7. Response
    return NextResponse.json({
      success: true,
      logId: result.logId,
      summary: validation.summary,
      warnings: validation.warnings,
    });
  } catch (error) {
    console.error("[api/ingest] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
