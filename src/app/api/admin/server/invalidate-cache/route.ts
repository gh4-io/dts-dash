import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { invalidateCache } from "@/lib/data/reader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/server/invalidate-cache");

// ─── POST — Invalidate data caches ─────────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    invalidateTransformerCache();
    invalidateCache();

    log.info({ userId: session.user.id, userEmail: session.user.email }, "Data caches invalidated");

    return NextResponse.json({ message: "All caches invalidated successfully" });
  } catch (error) {
    log.error({ error }, "Failed to invalidate caches");
    return NextResponse.json({ error: "Failed to invalidate caches" }, { status: 500 });
  }
}
