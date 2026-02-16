import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateCache } from "@/lib/data/reader";
import { db } from "@/lib/db/client";
import { importLog } from "@/lib/db/schema";
import fs from "fs/promises";
import path from "path";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/import/reset");

/**
 * POST /api/admin/import/reset
 * Clears event data (input.json) while preserving system data.
 * Creates backup before reset.
 * Admin/superadmin only.
 */
export async function POST() {
  const session = await auth();

  // Auth check
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role check
  if (session.user.role !== "admin" && session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dataPath = path.join(process.cwd(), "data", "input.json");
    const backupDir = path.join(process.cwd(), "data", "backups");

    // Check if input.json exists
    let currentRecordCount = 0;
    try {
      const currentData = await fs.readFile(dataPath, "utf-8");
      const parsed = JSON.parse(currentData);
      const records = Array.isArray(parsed) ? parsed : parsed.value ?? [];
      currentRecordCount = records.length;
    } catch {
      // File doesn't exist or is invalid — nothing to reset
      return NextResponse.json({
        success: true,
        message: "No data to reset",
        recordCount: 0,
      });
    }

    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });

    // Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `input_${timestamp}.json`);
    await fs.copyFile(dataPath, backupPath);

    // Reset input.json to empty array
    await fs.writeFile(dataPath, "[]", "utf-8");

    // Invalidate cache
    invalidateCache();

    // Log the reset action
    const logId = crypto.randomUUID();
    try {
      db.insert(importLog)
        .values({
          id: logId,
          importedAt: new Date().toISOString(),
          recordCount: 0,
          source: "api",
          fileName: "RESET",
          importedBy: session.user.id,
          status: "success",
          errors: null,
          idempotencyKey: null,
        })
        .run();
    } catch (logErr) {
      log.error({ err: logErr }, "Failed to log reset");
    }

    return NextResponse.json({
      success: true,
      message: `Reset complete. Cleared ${currentRecordCount} records.`,
      recordCount: currentRecordCount,
      backupPath: `data/backups/input_${timestamp}.json`,
    });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      {
        error: "Failed to reset event data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
