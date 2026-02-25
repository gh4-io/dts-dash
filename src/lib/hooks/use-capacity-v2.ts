"use client";

import { create } from "zustand";
import { useFilters } from "./use-filters";
import { useEffect } from "react";
import { getAvailableLenses } from "@/lib/capacity/lens-config";
import type {
  DailyDemandV2,
  DailyCapacityV2,
  DailyUtilizationV2,
  CapacitySummary,
  CapacityShift,
  CapacityAssumptions,
  CapacityOverviewResponse,
  CapacityLensId,
  CapacityComputeMode,
  ResolvedShiftInfo,
  DemandContract,
  FlightEvent,
  EventCoverageWindow,
  ConcurrencyBucket,
  ForecastRate,
  ForecastModel,
  TimeBooking,
  BillingEntry,
} from "@/types";

interface CapacityV2State {
  demand: DailyDemandV2[];
  capacity: DailyCapacityV2[];
  utilization: DailyUtilizationV2[];
  summary: CapacitySummary | null;
  warnings: string[];
  shifts: CapacityShift[];
  assumptions: CapacityAssumptions | null;
  // Compute metadata
  computeMode: CapacityComputeMode;
  autoMode: CapacityComputeMode;
  modeWarning: string | null;
  resolvedShifts: ResolvedShiftInfo[];
  activeStaffingConfigName: string | null;
  // Phase 2 overlay collections
  contracts: DemandContract[];
  flightEvents: FlightEvent[];
  coverageWindows: EventCoverageWindow[];
  concurrencyBuckets: ConcurrencyBucket[];
  forecastRates: ForecastRate[];
  forecastModel: ForecastModel | null;
  timeBookings: TimeBooking[];
  billingEntries: BillingEntry[];
  // Lens state
  activeLens: CapacityLensId;
  availableLenses: Set<CapacityLensId>;
  setActiveLens: (lens: CapacityLensId) => void;
  // Fetch state
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
  // Compute metadata
  computeMode: "headcount" as CapacityComputeMode,
  autoMode: "headcount" as CapacityComputeMode,
  modeWarning: null,
  resolvedShifts: [],
  activeStaffingConfigName: null,
  // Phase 2 overlay collections
  contracts: [],
  flightEvents: [],
  coverageWindows: [],
  concurrencyBuckets: [],
  forecastRates: [],
  forecastModel: null,
  timeBookings: [],
  billingEntries: [],
  // Lens state
  activeLens: "planned" as CapacityLensId,
  availableLenses: new Set<CapacityLensId>(["planned"]),
  setActiveLens: (lens: CapacityLensId) => set({ activeLens: lens }),
  // Fetch state
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
      const available = getAvailableLenses(json);
      set((state) => ({
        demand: json.demand,
        capacity: json.capacity,
        utilization: json.utilization,
        summary: json.summary,
        warnings: json.warnings,
        shifts: json.shifts,
        assumptions: json.assumptions,
        computeMode: json.computeMode ?? "headcount",
        autoMode: json.autoMode ?? "headcount",
        modeWarning: json.modeWarning ?? null,
        resolvedShifts: json.resolvedShifts ?? [],
        activeStaffingConfigName: json.activeStaffingConfigName ?? null,
        contracts: json.contracts ?? [],
        flightEvents: json.flightEvents ?? [],
        coverageWindows: json.coverageWindows ?? [],
        concurrencyBuckets: json.concurrencyBuckets ?? [],
        forecastRates: json.forecastRates ?? [],
        forecastModel: json.forecastModel ?? null,
        timeBookings: json.timeBookings ?? [],
        billingEntries: json.billingEntries ?? [],
        availableLenses: available,
        // Reset to planned if active lens is no longer available
        activeLens: available.has(state.activeLens) ? state.activeLens : "planned",
        isLoading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
}));

/**
 * Hook that auto-fetches V2 capacity overview when filters change.
 * Uses the new /api/capacity/overview endpoint with per-shift drilldown data.
 */
export function useCapacityV2(modeOverride?: CapacityComputeMode | null) {
  const { start, end, operators, aircraft, types } = useFilters();
  const store = useCapacityV2Store();

  useEffect(() => {
    const filters: Record<string, string> = {};
    if (start) filters.start = start;
    if (end) filters.end = end;
    if (operators.length > 0) filters.operators = operators.join(",");
    if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
    if (types.length > 0) filters.types = types.join(",");
    if (modeOverride) filters.mode = modeOverride;

    store.fetchOverview(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, operators, aircraft, types, modeOverride]);

  return {
    demand: store.demand,
    capacity: store.capacity,
    utilization: store.utilization,
    summary: store.summary,
    warnings: store.warnings,
    shifts: store.shifts,
    assumptions: store.assumptions,
    computeMode: store.computeMode,
    autoMode: store.autoMode,
    modeWarning: store.modeWarning,
    resolvedShifts: store.resolvedShifts,
    activeStaffingConfigName: store.activeStaffingConfigName,
    contracts: store.contracts,
    flightEvents: store.flightEvents,
    coverageWindows: store.coverageWindows,
    concurrencyBuckets: store.concurrencyBuckets,
    forecastRates: store.forecastRates,
    forecastModel: store.forecastModel,
    timeBookings: store.timeBookings,
    billingEntries: store.billingEntries,
    activeLens: store.activeLens,
    availableLenses: store.availableLenses,
    setActiveLens: store.setActiveLens,
    isLoading: store.isLoading,
    error: store.error,
    refetch: () => {
      const filters: Record<string, string> = {};
      if (start) filters.start = start;
      if (end) filters.end = end;
      if (operators.length > 0) filters.operators = operators.join(",");
      if (aircraft.length > 0) filters.aircraft = aircraft.join(",");
      if (types.length > 0) filters.types = types.join(",");
      if (modeOverride) filters.mode = modeOverride;
      store.fetchOverview(filters);
    },
  };
}
