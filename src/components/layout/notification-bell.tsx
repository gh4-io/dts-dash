"use client";

import { useEffect, useCallback } from "react";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { NotificationDropdown } from "./notification-dropdown";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const { unreadCount, fetchUnreadCount, fetchNotifications } = useNotifications();

  // Poll for unread count
  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        fetchNotifications();
      }
    },
    [fetchNotifications],
  );

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Notifications"
        >
          <i className="fa-solid fa-bell" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 md:right-1.5 md:top-1.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-80">
        <NotificationDropdown onClose={() => {}} />
      </PopoverContent>
    </Popover>
  );
}
