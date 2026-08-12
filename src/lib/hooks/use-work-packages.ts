"use client";

import { create } from "zustand";
import { useFilters } from "./use-filters";
import { useEffect } from "react";
import { buildFilterQuery, type Facets } from "@/lib/utils/filter-helpers";

// Serialized work package from API (dates come as strings over JSON)
export interface SerializedWorkPackage {
  id: number;
  documentSetId: number;
  aircraftReg: string;
  aircraftId: number;
  customer: string;
  flightId: string | null;
  arrival: string;
  departure: string;
  totalMH: number | null;
  groundHours: number;
  status: string;
  hasWorkpackage: boolean;
  workpackageNo: string | null;
  calendarComments: string | null;
  isActive: boolean;
  effectiveMH: number;
  mhSource: string;
  manualMHOverride: number | null;
  inferredType: string;
  groundEventTypes: string[] | null;
  _commentCount: number;
}

interface WorkPackagesState {
  workPackages: SerializedWorkPackage[];
  facets: Facets;
  isLoading: boolean;
  error: string | null;
  total: number;
  fetchAll: (filters: Record<string, string>) => Promise<void>;
  /** Fetch ONLY the filter option lists — no rows. Used by the TopMenuBar so
   *  the Columns filter dialog has values on every page, not just the two that
   *  load work packages. */
  fetchFacets: (filters: Record<string, string>) => Promise<void>;
}

const EMPTY_FACETS: Facets = { customer: [], aircraftReg: [], inferredType: [], status: [] };

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

/** Module-level abort controller — ensures only the latest fetchAll wins */
let activeAbort: AbortController | null = null;
/** Separate controller for facet-only fetches so the two never cancel each other */
let facetsAbort: AbortController | null = null;

export const useWorkPackagesStore = create<WorkPackagesState>()((set) => ({
  workPackages: [],
  facets: EMPTY_FACETS,
  isLoading: false,
  error: null,
  total: 0,

  fetchAll: async (filters: Record<string, string>) => {
    // Cancel any in-flight request (including its retries)
    if (activeAbort) activeAbort.abort();
    const abort = new AbortController();
    activeAbort = abort;

    set({ isLoading: true, error: null });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (abort.signal.aborted) return;
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/work-packages/all?${params}`, {
          signal: abort.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch work packages");
        const json = await res.json();
        if (abort.signal.aborted) return;
        set({
          workPackages: json.data,
          facets: json.facets ?? EMPTY_FACETS,
          total: json.total,
          isLoading: false,
        });
        return;
      } catch (err) {
        if (abort.signal.aborted || (err as Error).name === "AbortError") return;
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * (attempt + 1)));
          if (abort.signal.aborted) return;
          continue;
        }
        set({ error: (err as Error).message, isLoading: false });
      }
    }
  },

  fetchFacets: async (filters: Record<string, string>) => {
    if (facetsAbort) facetsAbort.abort();
    const abort = new AbortController();
    facetsAbort = abort;

    try {
      const params = new URLSearchParams({ ...filters, facetsOnly: "1" });
      const res = await fetch(`/api/work-packages/all?${params}`, { signal: abort.signal });
      if (!res.ok) return; // option lists are non-critical — fail quietly
      const json = await res.json();
      if (abort.signal.aborted) return;
      set({ facets: json.facets ?? EMPTY_FACETS });
    } catch {
      // aborted or offline — leave the previous facets in place
    }
  },
}));

/**
 * Hook that auto-fetches work packages when filters change.
 * Waits for URL → store sync before the first fetch to prevent
 * a wasted request with computed default filters.
 */
export function useWorkPackages() {
  const {
    start,
    end,
    operators,
    aircraft,
    types,
    excludeOperators,
    excludeAircraft,
    excludeTypes,
  } = useFilters();
  const urlSynced = useFilters((s) => s._urlSynced);
  const { workPackages, isLoading, error, total, fetchAll } = useWorkPackagesStore();

  useEffect(() => {
    if (!urlSynced) return; // wait for useFilterUrlSync to finish

    fetchAll(
      buildFilterQuery({
        start,
        end,
        operators,
        aircraft,
        types,
        excludeOperators,
        excludeAircraft,
        excludeTypes,
      }),
    );
  }, [
    urlSynced,
    start,
    end,
    operators,
    aircraft,
    types,
    excludeOperators,
    excludeAircraft,
    excludeTypes,
    fetchAll,
  ]);

  return { workPackages, isLoading, error, total };
}
