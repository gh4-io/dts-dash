import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db/client";
import { isGroundEventType } from "@/lib/utils/ground-events";
import { invalidateCache } from "@/lib/data/reader";
import { createChildLogger } from "@/lib/logger";
import { getSessionUserId } from "@/lib/utils/session-helpers";
import { broadcastNotification } from "@/lib/notifications/create";

const log = createChildLogger("api/work-packages/ground-event");

/** Resolve sp_id (client-facing) to internal auto-increment id */
function resolveWpId(spId: number): number | null {
  const row = sqlite.prepare("SELECT id FROM work_packages WHERE sp_id = ?").get(spId) as
    | { id: number }
    | undefined;
  return row?.id ?? null;
}

/**
 * PATCH /api/work-packages/[id]/ground-event
 * Set or clear ground event flags on a work package.
 * Body: { groundEventTypes: GroundEventType[] }
 * Empty array clears all flags.
 * Admin or superadmin only.
 *
 * Note: [id] is the SharePoint ID (sp_id), not the internal DB id.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const spId = Number(id);
    if (isNaN(spId) || spId < 1) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const internalId = resolveWpId(spId);
    if (!internalId) {
      return NextResponse.json({ error: "Work package not found" }, { status: 404 });
    }

    const json = await request.json();
    const types = json.groundEventTypes;

    if (!Array.isArray(types)) {
      return NextResponse.json({ error: "groundEventTypes must be an array" }, { status: 400 });
    }

    // Validate each entry
    const invalid = types.filter((t: unknown) => typeof t !== "string" || !isGroundEventType(t));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid ground event type(s): ${invalid.join(", ")}` },
        { status: 400 },
      );
    }

    // Store as JSON string or null
    const value = types.length > 0 ? JSON.stringify(types) : null;

    sqlite
      .prepare("UPDATE work_packages SET ground_event_types = ? WHERE id = ?")
      .run(value, internalId);

    // Invalidate cached reader data so next API call reflects the change
    invalidateCache();

    // Notify all users about the flag change
    if (types.length > 0) {
      try {
        const adminUserId = getSessionUserId(session);
        const wp = sqlite
          .prepare("SELECT aircraft_reg FROM work_packages WHERE id = ?")
          .get(internalId) as { aircraft_reg: string } | undefined;
        const reg = wp?.aircraft_reg ?? "aircraft";

        broadcastNotification({
          type: "flag",
          category: "aircraft",
          title: `Flag updated on ${reg}`,
          message: types.join(", "),
          metadata: { groundEventTypes: types, workPackageId: internalId, spId },
          actionUrl: "/flight-board",
          excludeUserId: adminUserId,
        });
      } catch (notifErr) {
        log.warn({ err: notifErr }, "Failed to create flag notifications");
      }
    }

    return NextResponse.json({ success: true, groundEventTypes: types });
  } catch (error) {
    log.error({ err: error }, "PATCH error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
