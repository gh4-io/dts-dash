"use client";

import { create } from "zustand";
import type { AircraftType, FilterState, FilterActions } from "@/types";

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

function getDefaults(): FilterState {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: "UTC",
    operators: [],
    aircraft: [],
    types: [],
  };
}

export const useFilters = create<FilterState & FilterActions>()(
  (set) => ({
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
    setTypes: (v: AircraftType[]) => set({ types: v }),
    reset: () => set(getDefaults()),
    hydrate: (params: Partial<FilterState>) => set(params),
  })
);
