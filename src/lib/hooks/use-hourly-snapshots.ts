"use client";

import { create } from "zustand";
import { useFilters } from "./use-filters";
import { useEffect } from "react";

export interface SerializedHourlySnapshot {
  hour: string;
  arrivalsCount: number;
  departuresCount: number;
  onGroundCount: number;
}

interface SnapshotState {
  snapshots: SerializedHourlySnapshot[];
  isLoading: boolean;
  error: string | null;
  fetchSnapshots: (filters: Record<string, string>) => Promise<void>;
}

export const useSnapshotStore = create<SnapshotState>()((set) => ({
  snapshots: [],
  isLoading: false,
  error: null,

  fetchSnapshots: async (filters: Record<string, string>) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/hourly-snapshots?${params}`);
      if (!res.ok) throw new Error("Failed to fetch hourly snapshots");
      const json = await res.json();
      set({ snapshots: json.data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
}));

/**
 * Hook that auto-fetches hourly snapshots when filters change
 */
export function useHourlySnapshots() {
  const { start, end, timezone, operators, aircraft, types } = useFilters();
  const { snapshots, isLoading, error, fetchSnapshots } = useSnapshotStore();

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (start) filters.start = start;
    if (end) filters.end = end;
    if (timezone) filters.timezone = timezone;
    if (operators.length > 0) filters.operators = operators.join(",");
    if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
    if (types.length > 0) filters.types = types.join(",");

    fetchSnapshots(filters);
  }, [start, end, timezone, operators, aircraft, types, fetchSnapshots]);

  return { snapshots, isLoading, error };
}
