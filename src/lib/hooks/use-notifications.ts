"use client";

import { create } from "zustand";
import type { AppNotification } from "@/types";

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  error: string | null;

  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: (page?: number) => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotifications = create<NotificationsState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  isLoading: false,
  error: null,

  fetchUnreadCount: async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (!res.ok) return;
      const data = await res.json();
      set({ unreadCount: data.count });
    } catch {
      // silent — badge polling should not disrupt UX
    }
  },

  fetchNotifications: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/notifications?page=${page}&limit=20`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        total: data.total,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  markRead: async (id: number) => {
    const prev = get().notifications;
    const wasUnread = prev.find((n) => n.id === id && !n.readAt);

    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: wasUnread ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
    }));

    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      // Revert on failure
      set({ notifications: prev, unreadCount: get().unreadCount + (wasUnread ? 1 : 0) });
    }
  },

  markAllRead: async () => {
    const prev = get().notifications;
    const prevCount = get().unreadCount;

    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) => ({
        ...n,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }));

    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
    } catch {
      set({ notifications: prev, unreadCount: prevCount });
    }
  },
}));
