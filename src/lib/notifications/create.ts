import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import { insertNotifications, type CreateNotificationOpts } from "@/lib/messages/repository";

const log = createChildLogger("notifications");

export type NotificationOpts = CreateNotificationOpts;

/**
 * Create notifications for specific users.
 * Inserts one row per user ID. Silently skips if userIds is empty.
 *
 * Since v1.0.0 the rows land in `messages` with kind = 'notification' and
 * recipient_id set (OI-099). The fan-out is unchanged — one row per recipient,
 * because read_at on the recipient's own row is the dismissal state.
 */
export function createNotification(userIds: number[], opts: NotificationOpts): void {
  if (userIds.length === 0) return;

  insertNotifications(userIds, opts);

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
