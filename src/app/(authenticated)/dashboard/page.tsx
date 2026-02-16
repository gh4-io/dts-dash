"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
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
import { useFilters } from "@/lib/hooks/use-filters";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useTransformedData } from "@/lib/hooks/use-transformed-data";
import { useEffect } from "react";

function DashboardPageInner() {
  const { workPackages, isLoading, error } = useWorkPackages();
  const { snapshots, isLoading: snapshotsLoading } = useHourlySnapshots();
  const { fetch: fetchCustomers } = useCustomers();
  const { timezone } = useFilters();
  const { timeFormat } = usePreferences();
  const [focusedOperator, setFocusedOperator] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Apply actions transforms (sort, status filter, etc.)
  const { data: transformedWps } = useTransformedData(workPackages);

  const displayWps = useMemo(() => {
    if (!focusedOperator) return transformedWps;
    return transformedWps.filter((wp) => wp.customer === focusedOperator);
  }, [transformedWps, focusedOperator]);

  const displaySnapshots = useMemo(() => {
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
        <TopMenuBar title="Dashboard" icon="fa-solid fa-chart-line" />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <TopMenuBar title="Dashboard" icon="fa-solid fa-chart-line" />

      {/* Data Freshness */}
      <DataFreshnessBadge />

      {isLoading || snapshotsLoading ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[250px_1fr_300px] gap-3 flex-1 min-h-[600px]">
          {/* Left: flex ratios — MH 65%, Type 30%, Total 5% of adjusted height */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="shrink-0">
              <AvgGroundTimeCard workPackages={displayWps} />
            </div>
            <MhByOperatorCard
              workPackages={displayWps}
              onOperatorClick={handleOperatorFromCard}
              className="flex-[13] min-h-[100px]"
            />
            <TotalAircraftCard
              workPackages={displayWps}
              className="flex-[1] min-h-[60px]"
            />
            <AircraftByTypeCard
              workPackages={displayWps}
              className="flex-[6] min-h-[80px]"
            />
          </div>

          {/* Center: chart + operator table — chart takes priority */}
          <div className="flex flex-col gap-3 min-h-0">
            <div className="rounded-lg border border-border bg-card p-3 flex-1 flex flex-col min-h-[200px]">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                <i className="fa-solid fa-chart-column" />
                Arrivals / Departures / On Ground
              </h3>
              <div className="flex-1 min-h-0">
                <CombinedChart snapshots={displaySnapshots} timezone={timezone} timeFormat={timeFormat} />
              </div>
            </div>
            <OperatorPerformance
              workPackages={workPackages}
              focusedOperator={focusedOperator}
              onOperatorClick={handleOperatorClick}
              className="flex-1 min-h-[150px]"
            />
          </div>

          {/* Right: Donut stretches to match full height */}
          <div className="rounded-lg border border-border bg-card p-3 flex flex-col">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
              <i className="fa-solid fa-chart-pie" />
              Aircraft By Customer
            </h3>
            <div className="flex-1">
              <CustomerDonut
                workPackages={displayWps}
                onCustomerClick={handleOperatorFromCard}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}
