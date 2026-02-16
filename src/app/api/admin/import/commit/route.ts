import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { validateImportData, commitImportData } from "@/lib/data/import-utils";
import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/admin/import/commit
 * Write validated JSON data to data/input.json and log the import
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { jsonContent, source, fileName } = body as {
      jsonContent: string;
      source: "file" | "paste";
      fileName?: string;
    };

    if (!jsonContent || typeof jsonContent !== "string") {
      return NextResponse.json(
        { error: "jsonContent is required" },
        { status: 400 }
      );
    }

    if (!source || !["file", "paste"].includes(source)) {
      return NextResponse.json(
        { error: "source must be 'file' or 'paste'" },
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

    // Re-validate the JSON
    const validation = validateImportData(jsonContent, maxSizeMB);
    if (!validation.valid || !validation.records) {
      return NextResponse.json(
        { error: validation.errors[0] || "No valid records found" },
        { status: 400 }
      );
    }

    // Commit
    const result = await commitImportData({
      jsonContent,
      records: validation.records,
      source,
      fileName,
      importedBy: session.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/admin/import/commit] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
