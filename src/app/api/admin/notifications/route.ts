import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createChildLogger } from "@/lib/logger";
import { createNotification, broadcastNotification } from "@/lib/notifications/create";
import type { NotificationType, NotificationCategory } from "@/types";

const log = createChildLogger("api/admin/notifications");

const VALID_TYPES: NotificationType[] = ["system", "comment", "flag", "update"];
const VALID_CATEGORIES: NotificationCategory[] = [
  "aircraft",
  "flight",
  "import",
  "admin",
  "general",
];

/**
 * POST /api/admin/notifications
 * Create notification(s) — broadcast to all users or target specific user IDs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.id ||
      !["admin", "superadmin"].includes((session.user as { role?: string }).role ?? "")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      type = "system",
      category = "general",
      title,
      message,
      metadata,
      actionUrl,
      expiresAt,
      targetUserIds,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 },
      );
    }

    const opts = {
      type,
      category,
      title: title.trim(),
      message: message?.trim() || null,
      metadata: metadata || null,
      actionUrl: actionUrl || null,
      expiresAt: expiresAt || null,
    };

    if (Array.isArray(targetUserIds)) {
      const validIds = targetUserIds.filter(
        (id: unknown) => typeof id === "number" && Number.isInteger(id) && id > 0,
      );
      if (validIds.length === 0) {
        return NextResponse.json({ created: 0 });
      }
      createNotification(validIds, opts);
      return NextResponse.json({ created: validIds.length }, { status: 201 });
    }

    // Default: broadcast to all active users
    broadcastNotification(opts);
    return NextResponse.json({ created: "all" }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "POST error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
