"use client";

import { create } from "zustand";
import { useFilters } from "./use-filters";
import { useEffect } from "react";

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
}

interface WorkPackagesState {
  workPackages: SerializedWorkPackage[];
  isLoading: boolean;
  error: string | null;
  total: number;
  fetchAll: (filters: Record<string, string>) => Promise<void>;
}

export const useWorkPackagesStore = create<WorkPackagesState>()((set) => ({
  workPackages: [],
  isLoading: false,
  error: null,
  total: 0,

  fetchAll: async (filters: Record<string, string>) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams(filters);
      const res = await fetch(`/api/work-packages/all?${params}`);
      if (!res.ok) throw new Error("Failed to fetch work packages");
      const json = await res.json();
      set({
        workPackages: json.data,
        total: json.total,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
}));

/**
 * Hook that auto-fetches work packages when filters change
 */
export function useWorkPackages() {
  const { start, end, operators, aircraft, types } = useFilters();
  const { workPackages, isLoading, error, total, fetchAll } =
    useWorkPackagesStore();

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (start) filters.start = start;
    if (end) filters.end = end;
    if (operators.length > 0) filters.operators = operators.join(",");
    if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
    if (types.length > 0) filters.types = types.join(",");

    fetchAll(filters);
  }, [start, end, operators, aircraft, types, fetchAll]);

  return { workPackages, isLoading, error, total };
}
