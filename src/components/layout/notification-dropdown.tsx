"use client";

import { useNotifications } from "@/lib/hooks/use-notifications";
import { NotificationItem } from "./notification-item";

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { notifications, unreadCount, isLoading, markAllRead } = useNotifications();

  return (
    <div className="w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <i className="fa-solid fa-spinner fa-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <i className="fa-solid fa-bell-slash text-2xl mb-2" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onClose={onClose} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
