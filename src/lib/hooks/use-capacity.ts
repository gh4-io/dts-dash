"use client";

import { create } from "zustand";
import { useFilters } from "./use-filters";
import { useEffect } from "react";
import type {
  DailyDemand,
  DailyCapacity,
  DailyUtilization,
  AppConfig,
} from "@/types";

interface CapacityData {
  demand: DailyDemand[];
  capacity: DailyCapacity[];
  utilization: DailyUtilization[];
}

interface CapacityState {
  demand: DailyDemand[];
  capacity: DailyCapacity[];
  utilization: DailyUtilization[];
  config: AppConfig | null;
  isLoading: boolean;
  isConfigLoading: boolean;
  error: string | null;
  fetchCapacity: (filters: Record<string, string>) => Promise<void>;
  fetchConfig: () => Promise<void>;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
}

export const useCapacityStore = create<CapacityState>()((set, get) => ({
  demand: [],
  capacity: [],
  utilization: [],
  config: null,
  isLoading: false,
  isConfigLoading: false,
  error: null,

  fetchCapacity: async (filters: Record<string, string>) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/capacity?${params}`);
      if (!res.ok) throw new Error("Failed to fetch capacity data");
      const json: CapacityData = await res.json();
      set({
        demand: json.demand,
        capacity: json.capacity,
        utilization: json.utilization,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchConfig: async () => {
    set({ isConfigLoading: true });
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      const json: AppConfig = await res.json();
      set({ config: json, isConfigLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isConfigLoading: false });
    }
  },

  updateConfig: async (updates: Partial<AppConfig>) => {
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update config");

      // Update local config state
      const currentConfig = get().config;
      if (currentConfig) {
        set({ config: { ...currentConfig, ...updates } });
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));

/**
 * Hook that auto-fetches capacity data when filters or config change
 */
export function useCapacity() {
  const { start, end, operators, aircraft, types } = useFilters();
  const {
    demand,
    capacity,
    utilization,
    config,
    isLoading,
    isConfigLoading,
    error,
    fetchCapacity,
    fetchConfig,
    updateConfig,
  } = useCapacityStore();

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Fetch capacity data when filters change
  useEffect(() => {
    const filters: Record<string, string> = {};
    if (start) filters.start = start;
    if (end) filters.end = end;
    if (operators.length > 0) filters.operators = operators.join(",");
    if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
    if (types.length > 0) filters.types = types.join(",");

    fetchCapacity(filters);
  }, [start, end, operators, aircraft, types, fetchCapacity]);

  return {
    demand,
    capacity,
    utilization,
    config,
    isLoading,
    isConfigLoading,
    error,
    updateConfig,
    refetch: () => {
      const filters: Record<string, string> = {};
      if (start) filters.start = start;
      if (end) filters.end = end;
      if (operators.length > 0) filters.operators = operators.join(",");
      if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
      if (types.length > 0) filters.types = types.join(",");
      fetchCapacity(filters);
    },
  };
}
