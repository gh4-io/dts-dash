"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import { FilterBar } from "@/components/shared/filter-bar";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import { AvgGroundTimeCard } from "@/components/dashboard/avg-ground-time-card";
import { MhByOperatorCard } from "@/components/dashboard/mh-by-operator-card";
import { TotalAircraftCard } from "@/components/dashboard/total-aircraft-card";
import { AircraftByTypeCard } from "@/components/dashboard/aircraft-by-type-card";
import { CombinedChart } from "@/components/dashboard/combined-chart";
import { CustomerDonut } from "@/components/dashboard/customer-donut";
import { OperatorPerformance } from "@/components/dashboard/operator-performance";
import { useWorkPackages } from "@/lib/hooks/use-work-packages";
import { useHourlySnapshots } from "@/lib/hooks/use-hourly-snapshots";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useEffect } from "react";

export default function DashboardPage() {
  const { workPackages, isLoading, error } = useWorkPackages();
  const { snapshots, isLoading: snapshotsLoading } = useHourlySnapshots();
  const { fetch: fetchCustomers } = useCustomers();
  const [focusedOperator, setFocusedOperator] = useState<string | null>(null);

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Cross-filter: when an operator is focused, filter WPs to that operator
  const displayWps = useMemo(() => {
    if (!focusedOperator) return workPackages;
    return workPackages.filter((wp) => wp.customer === focusedOperator);
  }, [workPackages, focusedOperator]);

  // Filtered snapshots for the combined chart (client-side cross-filter)
  const displaySnapshots = useMemo(() => {
    // Cross-filtering snapshots would require re-computing from WPs client-side.
    // For now, show all snapshots (they already reflect global FilterBar).
    // Operator focus only dims the performance table and donut — chart stays global.
    return snapshots;
  }, [snapshots]);

  const handleOperatorClick = useCallback((operator: string | null) => {
    setFocusedOperator(operator);
  }, []);

  const handleOperatorFromCard = useCallback((operator: string) => {
    setFocusedOperator((prev) => (prev === operator ? null : operator));
  }, []);

  if (error) {
    return (
      <div className="space-y-3">
        <PageHeader />
        <Suspense fallback={null}>
          <FilterBar />
        </Suspense>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader />

      {/* Filter Bar */}
      <Suspense fallback={null}>
        <FilterBar />
      </Suspense>

      {isLoading || snapshotsLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* KPI Cards + Combined Chart + Donut - Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_300px] gap-3">
            {/* Left: KPI cards stacked */}
            <div className="space-y-3 xl:col-span-1">
              <AvgGroundTimeCard workPackages={displayWps} />
              <MhByOperatorCard
                workPackages={displayWps}
                onOperatorClick={handleOperatorFromCard}
              />
              <TotalAircraftCard workPackages={displayWps} />
              <AircraftByTypeCard workPackages={displayWps} />
            </div>

            {/* Center: Combined chart */}
            <div className="rounded-lg border border-border bg-card p-3 xl:col-span-1">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                <i className="fa-solid fa-chart-column" />
                Arrivals / Departures / On Ground
              </h3>
              <CombinedChart snapshots={displaySnapshots} />
            </div>

            {/* Right: Donut */}
            <div className="rounded-lg border border-border bg-card p-3 xl:col-span-1">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                <i className="fa-solid fa-chart-pie" />
                Aircraft By Customer
              </h3>
              <CustomerDonut
                workPackages={displayWps}
                onCustomerClick={handleOperatorFromCard}
              />
            </div>
          </div>

          {/* Operator Performance Table */}
          <OperatorPerformance
            workPackages={workPackages}
            focusedOperator={focusedOperator}
            onOperatorClick={handleOperatorClick}
          />
        </>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-bold">
        <i className="fa-solid fa-chart-line mr-2" />
        Dashboard
      </h1>
      <DataFreshnessBadge />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_300px] gap-3">
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 h-28 animate-pulse" />
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-4 h-[380px] animate-pulse" />
      <div className="rounded-lg border border-border bg-card p-4 h-[300px] animate-pulse" />
    </div>
  );
}
