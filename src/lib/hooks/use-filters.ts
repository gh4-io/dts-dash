"use client";

import { create } from "zustand";
import type { FilterState, FilterActions } from "@/types";

/**
 * Re-interpret a UTC ISO date string from one timezone to another.
 * Extracts the wall-clock time in fromTz, returns the UTC ISO string
 * for that same wall-clock time in toTz.
 */
function reinterpretDate(isoStr: string, fromTz: string, toTz: string): string {
  if (!isoStr || fromTz === toTz) return isoStr;

  const date = new Date(isoStr);

  // Extract wall-clock components in the source timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: fromTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const wallStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;

  // Treat wall-clock as tentative UTC
  const tentativeUtc = new Date(wallStr + "Z");

  // See what that tentative UTC looks like in the target timezone
  const toParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: toTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(tentativeUtc);

  const toGet = (type: string) => toParts.find((p) => p.type === type)?.value ?? "00";
  const toWallStr = `${toGet("year")}-${toGet("month")}-${toGet("day")}T${toGet("hour")}:${toGet("minute")}:${toGet("second")}`;
  const toWallUtc = new Date(toWallStr + "Z");

  // Offset = tentativeUtc - toWallUtc; correct UTC = tentativeUtc + offset
  const offset = tentativeUtc.getTime() - toWallUtc.getTime();
  return new Date(tentativeUtc.getTime() + offset).toISOString();
}

const RANGE_DAYS: Record<string, number> = { "1d": 1, "3d": 3, "1w": 7 };

/** Compute midnight in a timezone as a UTC ISO string */
function midnightInTz(date: Date, tz: string): string {
  // Get today's date components in the target timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const y = parseInt(get("year"));
  const m = parseInt(get("month")) - 1;
  const d = parseInt(get("day"));

  // Convert wall-clock midnight in tz → UTC
  const tentative = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const check = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(tentative);
  const cGet = (type: string) => check.find((p) => p.type === type)?.value ?? "00";
  const wallStr = `${cGet("year")}-${cGet("month")}-${cGet("day")}T${cGet("hour")}:${cGet("minute")}:${cGet("second")}`;
  const wallAsUtc = new Date(wallStr + "Z");
  const offset = tentative.getTime() - wallAsUtc.getTime();
  return new Date(tentative.getTime() + offset).toISOString();
}

function computeDateRange(rangeName: string, tz: string): { start: string; end: string } {
  const days = RANGE_DAYS[rangeName] ?? 3;
  const startIso = midnightInTz(new Date(), tz);
  const endDate = new Date(startIso);
  endDate.setUTCDate(endDate.getUTCDate() + days);
  return { start: startIso, end: endDate.toISOString() };
}

/**
 * Compute an asymmetric date range from now using day offsets.
 * startOffset may be negative or fractional (e.g. -0.5 = 12 hours ago from now).
 * Base is the current time (rolling), not midnight — so the window always
 * reflects the last N hours relative to right now.
 * Results are floored to the nearest hour for clean boundary alignment.
 */
function computeOffsetRange(
  startOffset: number,
  endOffset: number,
): { start: string; end: string } {
  const MS_PER_DAY = 86400000;
  const MS_PER_HOUR = 3600000;
  const now = Date.now();
  const floorHour = (ms: number) => Math.floor(ms / MS_PER_HOUR) * MS_PER_HOUR;
  return {
    start: new Date(floorHour(now + startOffset * MS_PER_DAY)).toISOString(),
    end: new Date(floorHour(now + endOffset * MS_PER_DAY)).toISOString(),
  };
}

/**
 * Read YAML timeline defaults injected by TimelineScript into <head>.
 * Falls back to hardcoded values matching loader.ts DEFAULT_TIMELINE.
 */
function getTimelineFromWindow(): {
  startOffset: number;
  endOffset: number;
  defaultTimezone: string;
} {
  if (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__TIMELINE_DEFAULTS__
  ) {
    const tl = (window as unknown as Record<string, unknown>).__TIMELINE_DEFAULTS__ as {
      startOffset: number;
      endOffset: number;
      defaultTimezone: string;
    };
    return tl;
  }
  // Hardcoded fallback — must match DEFAULT_TIMELINE in loader.ts
  return { startOffset: -0.5, endOffset: 2.5, defaultTimezone: "America/New_York" };
}

function getDefaults(): FilterState {
  const tl = getTimelineFromWindow();
  const { start, end } = computeOffsetRange(tl.startOffset, tl.endOffset);

  return {
    start,
    end,
    timezone: tl.defaultTimezone,
    operators: [],
    aircraft: [],
    types: [],
  };
}

export const useFilters = create<FilterState & FilterActions>()((set) => ({
  ...getDefaults(),

  setStart: (v: string) => set({ start: v }),
  setEnd: (v: string) => set({ end: v }),
  setTimezone: (newTz: string) =>
    set((state) => {
      if (state.timezone === newTz) return { timezone: newTz };
      return {
        timezone: newTz,
        start: reinterpretDate(state.start, state.timezone, newTz),
        end: reinterpretDate(state.end, state.timezone, newTz),
      };
    }),
  setOperators: (v: string[]) => set({ operators: v }),
  setAircraft: (v: string[]) => set({ aircraft: v }),
  setTypes: (v: string[]) => set({ types: v }),
  reset: () => set(getDefaults()),
  hydrate: (params: Partial<FilterState>) => set(params),
  hydrateDefaults: (dateRange: string, tz: string) => {
    const { start, end } = computeDateRange(dateRange, tz);
    set({ start, end, timezone: tz });
  },
  hydrateFromPreferences: (prefs: {
    defaultDateRange: string | null;
    defaultStartOffset: number;
    defaultEndOffset: number;
    defaultTimezone: string;
  }) => {
    if (prefs.defaultDateRange) {
      const { start, end } = computeDateRange(prefs.defaultDateRange, prefs.defaultTimezone);
      set({ start, end, timezone: prefs.defaultTimezone });
    } else {
      const { start, end } = computeOffsetRange(prefs.defaultStartOffset, prefs.defaultEndOffset);
      set({ start, end, timezone: prefs.defaultTimezone });
    }
  },
}));
