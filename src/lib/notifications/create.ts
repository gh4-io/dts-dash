import { db } from "@/lib/db/client";
import { notifications, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import type { NotificationType, NotificationCategory } from "@/types";

const log = createChildLogger("notifications");

interface NotificationOpts {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  actionUrl?: string | null;
  expiresAt?: string | null;
}

/**
 * Create notifications for specific users.
 * Inserts one row per user ID. Silently skips if userIds is empty.
 */
export function createNotification(userIds: number[], opts: NotificationOpts): void {
  if (userIds.length === 0) return;

  const now = new Date().toISOString();
  const metadataStr = opts.metadata ? JSON.stringify(opts.metadata) : null;

  for (const uid of userIds) {
    db.insert(notifications)
      .values({
        userId: uid,
        type: opts.type,
        category: opts.category,
        title: opts.title,
        message: opts.message?.trim() || null,
        metadata: metadataStr,
        actionUrl: opts.actionUrl || null,
        expiresAt: opts.expiresAt || null,
        createdAt: now,
      })
      .run();
  }

  log.info(
    { type: opts.type, category: opts.category, targetCount: userIds.length },
    "Notifications created",
  );
}

/**
 * Broadcast a notification to all active users.
 * Optionally exclude a specific user (e.g. the actor who triggered it).
 */
export function broadcastNotification(opts: NotificationOpts & { excludeUserId?: number }): void {
  const allUsers = db.select({ id: users.id }).from(users).where(eq(users.isActive, true)).all();

  const targetIds = opts.excludeUserId
    ? allUsers.map((u) => u.id).filter((id) => id !== opts.excludeUserId)
    : allUsers.map((u) => u.id);

  createNotification(targetIds, opts);
}
