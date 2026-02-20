import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { importLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/data-freshness");

/**
 * GET /api/data-freshness
 * Returns most recent import timestamp and age in hours
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const latest = db
      .select({ importedAt: importLog.importedAt })
      .from(importLog)
      .orderBy(desc(importLog.importedAt))
      .limit(1)
      .get();

    if (!latest) {
      return NextResponse.json({ importedAt: null, ageHours: null });
    }

    const importedAt = latest.importedAt;
    const ageMs = Date.now() - new Date(importedAt).getTime();
    const ageHours = Math.round((ageMs / 3600000) * 10) / 10;

    return NextResponse.json({ importedAt, ageHours });
  } catch (error) {
    log.error({ err: error }, "Error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
