import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateImportData } from "@/lib/data/import-utils";
import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/import/validate");

/**
 * POST /api/admin/import/validate
 * Validate JSON content before import — returns summary + warnings + errors
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { jsonContent } = body;

    if (!jsonContent || typeof jsonContent !== "string") {
      return NextResponse.json(
        { valid: false, errors: ["jsonContent (string) is required"] },
        { status: 400 }
      );
    }

    // Load configurable size limit
    const sizeRow = db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "ingestMaxSizeMB"))
      .get();
    const maxSizeMB = parseInt(sizeRow?.value ?? "50", 10);

    const result = validateImportData(jsonContent, maxSizeMB);

    return NextResponse.json({
      valid: result.valid,
      summary: result.summary,
      warnings: result.warnings,
      errors: result.errors,
    });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
