"use client";

import { create } from "zustand";
import { useFilters } from "./use-filters";
import { useEffect } from "react";
import type {
  DailyDemandV2,
  DailyCapacityV2,
  DailyUtilizationV2,
  CapacitySummary,
  CapacityShift,
  CapacityAssumptions,
  CapacityOverviewResponse,
} from "@/types";

interface CapacityV2State {
  demand: DailyDemandV2[];
  capacity: DailyCapacityV2[];
  utilization: DailyUtilizationV2[];
  summary: CapacitySummary | null;
  warnings: string[];
  shifts: CapacityShift[];
  assumptions: CapacityAssumptions | null;
  isLoading: boolean;
  error: string | null;
  fetchOverview: (filters: Record<string, string>) => Promise<void>;
}

export const useCapacityV2Store = create<CapacityV2State>()((set) => ({
  demand: [],
  capacity: [],
  utilization: [],
  summary: null,
  warnings: [],
  shifts: [],
  assumptions: null,
  isLoading: false,
  error: null,

  fetchOverview: async (filters: Record<string, string>) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/capacity/overview?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch capacity data" }));
        throw new Error(data.error ?? "Failed to fetch capacity data");
      }
      const json: CapacityOverviewResponse = await res.json();
      set({
        demand: json.demand,
        capacity: json.capacity,
        utilization: json.utilization,
        summary: json.summary,
        warnings: json.warnings,
        shifts: json.shifts,
        assumptions: json.assumptions,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
}));

/**
 * Hook that auto-fetches V2 capacity overview when filters change.
 * Uses the new /api/capacity/overview endpoint with per-shift drilldown data.
 */
export function useCapacityV2() {
  const { start, end, operators, aircraft, types } = useFilters();
  const store = useCapacityV2Store();

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (start) filters.start = start;
    if (end) filters.end = end;
    if (operators.length > 0) filters.operators = operators.join(",");
    if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
    if (types.length > 0) filters.types = types.join(",");

    store.fetchOverview(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, operators, aircraft, types]);

  return {
    demand: store.demand,
    capacity: store.capacity,
    utilization: store.utilization,
    summary: store.summary,
    warnings: store.warnings,
    shifts: store.shifts,
    assumptions: store.assumptions,
    isLoading: store.isLoading,
    error: store.error,
    refetch: () => {
      const filters: Record<string, string> = {};
      if (start) filters.start = start;
      if (end) filters.end = end;
      if (operators.length > 0) filters.operators = operators.join(",");
      if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
      if (types.length > 0) filters.types = types.join(",");
      store.fetchOverview(filters);
    },
  };
}
