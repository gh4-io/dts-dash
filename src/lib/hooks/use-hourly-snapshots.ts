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

/** Module-level abort controller — ensures only the latest fetch wins. */
let activeAbort: AbortController | null = null;

export const useSnapshotStore = create<SnapshotState>()((set) => ({
  snapshots: [],
  isLoading: false,
  error: null,

  fetchSnapshots: async (filters: Record<string, string>) => {
    // Cancel any request still in flight. Without this the dashboard chart
    // raced itself on every load: one fetch went out with the pre-hydration
    // default range and another with the URL's range, and whichever landed
    // last won. The default usually won, so the chart drew a window around
    // "now" no matter what dates were selected (OI-124).
    if (activeAbort) activeAbort.abort();
    const abort = new AbortController();
    activeAbort = abort;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/hourly-snapshots?${params}`, { signal: abort.signal });
      if (abort.signal.aborted) return;
      if (!res.ok) throw new Error("Failed to fetch hourly snapshots");
      const json = await res.json();
      if (abort.signal.aborted) return;
      set({ snapshots: json.data, isLoading: false });
    } catch (err) {
      if (abort.signal.aborted || (err as Error).name === "AbortError") return;
      set({ error: (err as Error).message, isLoading: false });
    }
  },
}));

/**
 * Hook that auto-fetches hourly snapshots when filters change.
 *
 * Waits for `_urlSynced` before firing, matching `useCapacityV2` and
 * `useWorkPackages`. The filter store starts on defaults and is only then
 * hydrated from the URL, so fetching before that point requests the wrong
 * range — and the abort controller above is what stops that stale response
 * from overwriting the right one.
 */
export function useHourlySnapshots() {
  const { start, end, timezone, operators, aircraft, types } = useFilters();
  const urlSynced = useFilters((s) => s._urlSynced);
  const { snapshots, isLoading, error, fetchSnapshots } = useSnapshotStore();

  useEffect(() => {
    if (!urlSynced) return;

    const filters: Record<string, string> = {};
    if (start) filters.start = start;
    if (end) filters.end = end;
    if (timezone) filters.timezone = timezone;
    if (operators.length > 0) filters.operators = operators.join(",");
    if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
    if (types.length > 0) filters.types = types.join(",");

    fetchSnapshots(filters);
  }, [urlSynced, start, end, timezone, operators, aircraft, types, fetchSnapshots]);

  return { snapshots, isLoading: isLoading || !urlSynced, error };
}
