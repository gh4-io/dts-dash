"use client";

import { create } from "zustand";
import type { AircraftType, FilterState, FilterActions } from "@/types";

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
    setTimezone: (v: string) => set({ timezone: v }),
    setOperators: (v: string[]) => set({ operators: v }),
    setAircraft: (v: string[]) => set({ aircraft: v }),
    setTypes: (v: AircraftType[]) => set({ types: v }),
    reset: () => set(getDefaults()),
    hydrate: (params: Partial<FilterState>) => set(params),
  })
);
