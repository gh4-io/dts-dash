"use client";

import { Suspense, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AvgGroundTimeCard } from "@/components/dashboard/avg-ground-time-card";
import { MhByOperatorCard } from "@/components/dashboard/mh-by-operator-card";
import { TotalAircraftCard } from "@/components/dashboard/total-aircraft-card";
import { AircraftByTypeCard } from "@/components/dashboard/aircraft-by-type-card";
import { CombinedChart, type ChartTimeRange } from "@/components/dashboard/combined-chart";
import { CustomerDonut } from "@/components/dashboard/customer-donut";
import { OperatorPerformance } from "@/components/dashboard/operator-performance";
import { useWorkPackages } from "@/lib/hooks/use-work-packages";
import { useHourlySnapshots } from "@/lib/hooks/use-hourly-snapshots";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFilters } from "@/lib/hooks/use-filters";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useTransformedData } from "@/lib/hooks/use-transformed-data";
import { PrintButton } from "@/components/shared/print-button";
import { useDeviceType } from "@/lib/hooks/use-device-type";

function DashboardPageInner() {
  const { workPackages, isLoading, error } = useWorkPackages();
  const { snapshots, isLoading: snapshotsLoading } = useHourlySnapshots();
  const { fetch: fetchCustomers } = useCustomers();
  const { start, end, timezone } = useFilters();
  const device = useDeviceType();
  const { timeFormat } = usePreferences();
  const [focusedOperator, setFocusedOperator] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<ChartTimeRange | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Apply actions transforms (sort, status filter, etc.)
  const { data: transformedWps } = useTransformedData(workPackages);

  // Operator-only filter — feeds the chart (chart must NOT filter itself)
  const operatorFilteredWps = useMemo(() => {
    if (!focusedOperator) return transformedWps;
    return transformedWps.filter((wp) => wp.customer === focusedOperator);
  }, [transformedWps, focusedOperator]);

  // Operator + time-range filter — feeds all side panels
  const displayWps = useMemo(() => {
    if (!timeRange) return operatorFilteredWps;
    const rangeStart = new Date(timeRange.start).getTime();
    const rangeEnd = new Date(timeRange.end).getTime() + 3_600_000; // end is start of last hour, extend to cover it
    return operatorFilteredWps.filter((wp) => {
      const arr = new Date(wp.arrival).getTime();
      const dep = new Date(wp.departure).getTime();
      // WP overlaps the selected time window
      return arr < rangeEnd && dep > rangeStart;
    });
  }, [operatorFilteredWps, timeRange]);

  // Snapshots for chart — reflects operator filter only (not time range)
  const displaySnapshots = useMemo(() => {
    if (!focusedOperator || snapshots.length === 0) return snapshots;
    return snapshots.map((snapshot) => {
      const hourStart = new Date(snapshot.hour).getTime();
      const hourEnd = hourStart + 3_600_000;
      const arrivals = operatorFilteredWps.filter((wp) => {
        const t = new Date(wp.arrival).getTime();
        return t >= hourStart && t < hourEnd;
      }).length;
      const departures = operatorFilteredWps.filter((wp) => {
        const t = new Date(wp.departure).getTime();
        return t >= hourStart && t < hourEnd;
      }).length;
      const onGround = operatorFilteredWps.filter((wp) => {
        return (
          new Date(wp.arrival).getTime() < hourEnd && new Date(wp.departure).getTime() > hourStart
        );
      }).length;
      return {
        ...snapshot,
        arrivalsCount: arrivals,
        departuresCount: departures,
        onGroundCount: onGround,
      };
    });
  }, [snapshots, focusedOperator, operatorFilteredWps]);

  const handleOperatorClick = useCallback((operator: string | null) => {
    setFocusedOperator(operator);
  }, []);

  const handleOperatorFromCard = useCallback((operator: string) => {
    setFocusedOperator((prev) => (prev === operator ? null : operator));
  }, []);

  const handleTimeRangeChange = useCallback((range: ChartTimeRange | null) => {
    setTimeRange(range);
  }, []);

  const handleBeforePrint = useCallback(async () => {
    // flushSync forces a synchronous React render so the print layout is in the DOM.
    // The setTimeout gives Recharts time to complete its componentDidMount → setState →
    // re-render cycle, which runs after the flushSync batch and computes bar heights /
    // line paths. Without this, react-to-print captures the DOM before that second
    // render finishes and the chart appears blank.
    flushSync(() => setPrintMode(true));
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
  }, []);

  const handleAfterPrint = useCallback(() => {
    setPrintMode(false);
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
    <div className="flex flex-col gap-3 min-h-full">
      <TopMenuBar
        title="Dashboard"
        icon="fa-solid fa-chart-line"
        actions={
          <PrintButton
            contentRef={printRef}
            documentTitle="Dashboard — CVG Line Maintenance"
            onBeforePrint={handleBeforePrint}
            onAfterPrint={handleAfterPrint}
          />
        }
      />

      {isLoading || snapshotsLoading ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <div ref={printRef} className="flex-1">
          {printMode ? (
            // ── Print layout: full-width chart → 3-col KPI row → full-width table ──
            <div className="flex flex-col gap-2">
              {/* Row 1: Arrivals / Departures / On Ground — full page width */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-chart-column" />
                  Arrivals / Departures / On Ground
                  <span className="ml-auto">{timezone === "UTC" ? "UTC" : "Eastern (ET)"}</span>
                </h3>
                <CombinedChart
                  snapshots={displaySnapshots}
                  timezone={timezone}
                  timeFormat={timeFormat}
                  height={200}
                  width={928}
                />
              </div>

              {/* Row 2: Average Ground Time | Aircraft & Turns | Total Aircraft By Type */}
              <div className="grid grid-cols-3 gap-2">
                <AvgGroundTimeCard workPackages={displayWps} />
                <TotalAircraftCard
                  workPackages={displayWps}
                  filterStart={start}
                  filterEnd={end}
                  timezone={timezone}
                />
                <AircraftByTypeCard workPackages={displayWps} />
              </div>

              {/* Row 3: Operator Performance — full width so table columns have room */}
              <OperatorPerformance
                workPackages={displayWps}
                focusedOperator={null}
                onOperatorClick={() => {}}
              />
            </div>
          ) : // ── Normal layout: 3-column grid ────────────────────────────────────
          device.type === "phone" ? (
            // Phone: chart on top, then KPI cards, then donut, then operator table
            <div className="flex flex-col gap-3 flex-1">
              {/* Chart first on phone */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-chart-column" />
                  Arrivals / Departures / On Ground
                  <span className="ml-auto">{timezone === "UTC" ? "UTC" : "Eastern (ET)"}</span>
                </h3>
                <div className="min-h-[250px]">
                  <CombinedChart
                    snapshots={displaySnapshots}
                    timezone={timezone}
                    timeFormat={timeFormat}
                    onSelectionChange={handleTimeRangeChange}
                  />
                </div>
              </div>

              {/* KPI cards */}
              <AvgGroundTimeCard workPackages={displayWps} />
              <MhByOperatorCard
                workPackages={displayWps}
                onOperatorClick={handleOperatorFromCard}
              />
              <TotalAircraftCard
                workPackages={displayWps}
                filterStart={start}
                filterEnd={end}
                timezone={timezone}
              />
              <AircraftByTypeCard workPackages={displayWps} />

              {/* Donut */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                  <i className="fa-solid fa-chart-pie" />
                  Aircraft By Customer
                </h3>
                <CustomerDonut workPackages={displayWps} onCustomerClick={handleOperatorFromCard} />
              </div>

              {/* Operator table */}
              <OperatorPerformance
                workPackages={displayWps}
                focusedOperator={focusedOperator}
                onOperatorClick={handleOperatorClick}
              />
            </div>
          ) : (
            // Tablet (2-col) / Desktop (3-col fixed) grid
            // Phone is handled above; the else here catches tablet + desktop
            <div
              className={
                device.type === "desktop"
                  ? "grid grid-cols-[250px_1fr_300px] gap-3 flex-1"
                  : "grid grid-cols-2 gap-3 flex-1"
              }
            >
              {/* Left: flex ratios — MH 65%, Type 32% of remaining */}
              <div className="flex flex-col gap-3">
                <div className="shrink-0">
                  <AvgGroundTimeCard workPackages={displayWps} />
                </div>
                <MhByOperatorCard
                  workPackages={displayWps}
                  onOperatorClick={handleOperatorFromCard}
                  className="flex-[2]"
                />
                <div className="shrink-0">
                  <TotalAircraftCard
                    workPackages={displayWps}
                    filterStart={start}
                    filterEnd={end}
                    timezone={timezone}
                  />
                </div>
                <AircraftByTypeCard workPackages={displayWps} className="flex-[3]" />
              </div>

              {/* Center: chart + operator table */}
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-border bg-card p-4 flex-1 flex flex-col">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-chart-column" />
                    Arrivals / Departures / On Ground
                    <span className="ml-auto">{timezone === "UTC" ? "UTC" : "Eastern (ET)"}</span>
                  </h3>
                  <div className="flex-1 min-h-[250px]">
                    <CombinedChart
                      snapshots={displaySnapshots}
                      timezone={timezone}
                      timeFormat={timeFormat}
                      onSelectionChange={handleTimeRangeChange}
                    />
                  </div>
                </div>
                <OperatorPerformance
                  workPackages={displayWps}
                  focusedOperator={focusedOperator}
                  onOperatorClick={handleOperatorClick}
                  className="flex-1"
                />
              </div>

              {/* Right: Donut stretches to match full height */}
              <div className="rounded-lg border border-border bg-card p-4 flex flex-col">
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
