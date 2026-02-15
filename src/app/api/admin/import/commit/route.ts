import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { importLog } from "@/lib/db/schema";
import { invalidateCache } from "@/lib/data/reader";
import fs from "fs/promises";
import path from "path";

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

    // Re-validate the JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    const records = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>).value ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "No valid records found" },
        { status: 400 }
      );
    }

    // Write to data/input.json
    const dataPath = path.join(process.cwd(), "data", "input.json");
    try {
      await fs.writeFile(dataPath, jsonContent, "utf-8");
    } catch (writeErr) {
      console.error("[api/admin/import/commit] Failed to write input.json:", writeErr);
      return NextResponse.json(
        { error: "Failed to write data file" },
        { status: 500 }
      );
    }

    // Log to import_log
    const logId = crypto.randomUUID();
    try {
      db.insert(importLog)
        .values({
          id: logId,
          importedAt: new Date().toISOString(),
          recordCount: records.length,
          source,
          fileName: fileName || null,
          importedBy: session.user.id,
          status: "success",
          errors: null,
        })
        .run();
    } catch (logErr) {
      console.error("[api/admin/import/commit] Failed to log import:", logErr);
      // If logging fails due to stale user ID, still return success but warn
      if ((logErr as Error).message?.includes("FOREIGN KEY")) {
        console.warn("[api/admin/import/commit] Stale user session - import succeeded but logging failed. User should log out and back in.");
      }
    }

    // Invalidate reader cache
    invalidateCache();

    console.warn(`[import] Committed ${records.length} records from ${source}, logId=${logId}`);

    return NextResponse.json({ success: true, logId, recordCount: records.length });
  } catch (error) {
    console.error("[api/admin/import/commit] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
