"use client";

import type { AppNotification } from "@/types";
import { formatRelativeTime } from "@/lib/utils/relative-time";
import { useNotifications } from "@/lib/hooks/use-notifications";

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  system: { icon: "fa-solid fa-circle-info", color: "text-blue-400" },
  comment: { icon: "fa-solid fa-comment", color: "text-emerald-400" },
  flag: { icon: "fa-solid fa-flag", color: "text-amber-400" },
  update: { icon: "fa-solid fa-rotate", color: "text-purple-400" },
};

interface NotificationItemProps {
  notification: AppNotification;
  onClose: () => void;
}

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const markRead = useNotifications((s) => s.markRead);
  const isUnread = !notification.readAt;
  const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.system;

  const handleClick = () => {
    if (isUnread) {
      markRead(notification.id);
    }
    if (notification.actionUrl) {
      onClose();
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50 ${
        isUnread ? "bg-accent/20" : ""
      }`}
    >
      <i className={`${config.icon} ${config.color} mt-0.5 w-4 text-center shrink-0`} />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate ${isUnread ? "font-medium text-foreground" : "text-muted-foreground"}`}
        >
          {notification.title}
        </p>
        {notification.message && (
          <p className="truncate text-xs text-muted-foreground mt-0.5">{notification.message}</p>
        )}
        <p className="text-xs text-muted-foreground/60 mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
      {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
    </button>
  );
}
