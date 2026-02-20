import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ApiAuthResult {
  authenticated: boolean;
  keyHash?: string;
  error?: NextResponse;
}

/**
 * Verify Bearer token from Authorization header against the ingestApiKey
 * stored in app_config (SQLite). Uses constant-time comparison.
 *
 * Returns keyHash (sha256 of the token) on success for use as rate-limit bucket key.
 */
export function verifyApiKey(request: NextRequest): ApiAuthResult {
  // Read key from DB
  const row = db
    .select()
    .from(appConfig)
    .where(eq(appConfig.key, "ingestApiKey"))
    .get();

  const storedKey = row?.value ?? "";

  if (!storedKey) {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: "Ingress endpoint not configured" },
        { status: 503 }
      ),
    };
  }

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // Constant-time comparison
  const expected = Buffer.from(storedKey, "utf-8");
  const received = Buffer.from(token, "utf-8");

  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: "Invalid API key" },
        { status: 403 }
      ),
    };
  }

  // Hash the token for rate-limit bucket (never store raw key in memory)
  const keyHash = crypto.createHash("sha256").update(token).digest("hex");

  return { authenticated: true, keyHash };
}
