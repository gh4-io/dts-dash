"use client";

import { create } from "zustand";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ColorMode = "light" | "dark" | "system";
export type ThemePreset =
  | "neutral"
  | "ocean"
  | "purple"
  | "black"
  | "vitepress"
  | "dusk"
  | "catppuccin"
  | "solar"
  | "emerald"
  | "ruby"
  | "aspen";

export type TimeFormat = "12h" | "24h";

export interface UserPreferences {
  colorMode: ColorMode;
  themePreset: ThemePreset;
  accentColor: string | null;
  compactMode: boolean;
  defaultTimezone: string;
  defaultDateRange: "1d" | "3d" | "1w";
  timeFormat: TimeFormat;
  tablePageSize: number;
}

interface PreferencesState extends UserPreferences {
  loaded: boolean;
  loading: boolean;
  fetch: () => Promise<void>;
  update: (partial: Partial<UserPreferences>) => Promise<void>;
  applyTheme: () => void;
}

// ─── Theme Application ──────────────────────────────────────────────────────

const THEME_PRESETS: ThemePreset[] = [
  "neutral",
  "ocean",
  "purple",
  "black",
  "vitepress",
  "dusk",
  "catppuccin",
  "solar",
  "emerald",
  "ruby",
  "aspen",
];

function applyThemeToDOM(preset: ThemePreset, accentColor: string | null) {
  if (typeof document === "undefined") return;

  const html = document.documentElement;

  // Remove all theme-* classes, then add the current one
  THEME_PRESETS.forEach((t) => html.classList.remove(`theme-${t}`));
  html.classList.add(`theme-${preset}`);

  // Apply accent color override
  if (accentColor) {
    html.style.setProperty("--accent", accentColor);
    html.style.setProperty("--ring", accentColor);
  } else {
    html.style.removeProperty("--accent");
    html.style.removeProperty("--ring");
  }

  // Cache in localStorage for FOUC prevention
  localStorage.setItem("theme-preset", preset);
  if (accentColor) {
    localStorage.setItem("accent-color", accentColor);
  } else {
    localStorage.removeItem("accent-color");
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────

const defaults: UserPreferences = {
  colorMode: "dark",
  themePreset: "neutral",
  accentColor: null,
  compactMode: false,
  defaultTimezone: "UTC",
  defaultDateRange: "3d",
  timeFormat: "24h",
  tablePageSize: 30,
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...defaults,
  loaded: false,
  loading: false,

  fetch: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/account/preferences");
      if (res.ok) {
        const data = await res.json();
        set({
          colorMode: data.colorMode ?? defaults.colorMode,
          themePreset: data.themePreset ?? defaults.themePreset,
          accentColor: data.accentColor ?? null,
          compactMode: data.compactMode ?? false,
          defaultTimezone: data.defaultTimezone ?? defaults.defaultTimezone,
          defaultDateRange: data.defaultDateRange ?? defaults.defaultDateRange,
          timeFormat: data.timeFormat ?? defaults.timeFormat,
          tablePageSize: data.tablePageSize ?? defaults.tablePageSize,
          loaded: true,
          loading: false,
        });
        get().applyTheme();
      } else {
        set({ loaded: true, loading: false });
      }
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  update: async (partial) => {
    const prev = get();
    // Optimistic update
    set({ ...partial });

    if (partial.themePreset !== undefined || partial.accentColor !== undefined) {
      get().applyTheme();
    }

    try {
      const res = await fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colorMode: partial.colorMode ?? prev.colorMode,
          themePreset: partial.themePreset ?? prev.themePreset,
          accentColor:
            partial.accentColor !== undefined
              ? partial.accentColor
              : prev.accentColor,
          compactMode: partial.compactMode ?? prev.compactMode,
          defaultTimezone: partial.defaultTimezone ?? prev.defaultTimezone,
          defaultDateRange: partial.defaultDateRange ?? prev.defaultDateRange,
          timeFormat: partial.timeFormat ?? prev.timeFormat,
          tablePageSize: partial.tablePageSize ?? prev.tablePageSize,
        }),
      });

      if (!res.ok) {
        // Revert on failure
        set({
          colorMode: prev.colorMode,
          themePreset: prev.themePreset,
          accentColor: prev.accentColor,
          compactMode: prev.compactMode,
          defaultTimezone: prev.defaultTimezone,
          defaultDateRange: prev.defaultDateRange,
          timeFormat: prev.timeFormat,
          tablePageSize: prev.tablePageSize,
        });
        get().applyTheme();
      }
    } catch {
      // Revert on network error
      set({
        colorMode: prev.colorMode,
        themePreset: prev.themePreset,
        accentColor: prev.accentColor,
        compactMode: prev.compactMode,
        defaultTimezone: prev.defaultTimezone,
        defaultDateRange: prev.defaultDateRange,
        timeFormat: prev.timeFormat,
        tablePageSize: prev.tablePageSize,
      });
      get().applyTheme();
    }
  },

  applyTheme: () => {
    const { themePreset, accentColor } = get();
    applyThemeToDOM(themePreset, accentColor);
  },
}));
