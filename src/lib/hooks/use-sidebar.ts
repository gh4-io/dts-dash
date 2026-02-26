"use client";

import { create } from "zustand";
import { useEffect } from "react";

export type SidebarMode = "expanded" | "icons" | "collapsed";

interface SidebarState {
  mode: SidebarMode;
  hydrated: boolean;
  setMode: (mode: SidebarMode) => void;
  cycleMode: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = "sidebar-mode";

export const useSidebar = create<SidebarState>((set, get) => ({
  // SSR default: expanded (prevents hydration mismatch)
  mode: "expanded",
  hydrated: false,

  setMode: (mode) => {
    set({ mode });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  },

  cycleMode: () => {
    const current = get().mode;
    const next: SidebarMode =
      current === "expanded" ? "icons" : current === "icons" ? "collapsed" : "expanded";
    get().setMode(next);
  },

  hydrate: () => {
    if (get().hydrated) return;
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY) as SidebarMode | null;
      if (stored && ["expanded", "icons", "collapsed"].includes(stored)) {
        set({ mode: stored, hydrated: true });
        return;
      }
    }
    set({ hydrated: true });
  },
}));

/** Hook to hydrate sidebar state from localStorage on mount */
export function useSidebarHydration() {
  const hydrate = useSidebar((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
}
