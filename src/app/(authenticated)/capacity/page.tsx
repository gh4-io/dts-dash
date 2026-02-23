"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CapacityKpiStrip } from "@/components/capacity/capacity-kpi-strip";
import { CapacityHeatmap } from "@/components/capacity/capacity-heatmap";
import { CapacitySummaryChart } from "@/components/capacity/capacity-summary-chart";
import { ForecastPatternChart } from "@/components/capacity/forecast-pattern-chart";
import { CapacityPieCharts } from "@/components/capacity/capacity-pie-charts";
import { ShiftDrilldownDrawer } from "@/components/capacity/shift-drilldown-drawer";
import { CapacityTable } from "@/components/capacity/capacity-table";
import { LensSelector } from "@/components/capacity/lens-selector";
import { useCapacityV2 } from "@/lib/hooks/use-capacity-v2";
import { Button } from "@/components/ui/button";

function CapacityPageInner() {
  const {
    demand,
    capacity,
    utilization,
    summary,
    warnings,
    shifts,
    assumptions,
    contracts,
    flightEvents,
    coverageWindows,
    concurrencyBuckets,
    forecastRates,
    forecastModel,
    timeBookings,
    billingEntries,
    activeLens,
    availableLenses,
    setActiveLens,
    isLoading,
    error,
    refetch,
  } = useCapacityV2();

  // Warnings dismiss state — resets when data is refreshed
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const handleRefetch = useCallback(() => {
    setWarningsDismissed(false);
    refetch();
  }, [refetch]);

  // Drilldown drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const [drawerShift, setDrawerShift] = useState<string | null>(null);

  const handleCellClick = useCallback((date: string, shiftCode: string | null) => {
    setDrawerDate(date);
    setDrawerShift(shiftCode);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // Pre-compute event count by date for table (events lens)
  const eventCountByDate = useMemo(() => {
    if (!flightEvents || flightEvents.length === 0) return undefined;
    const map = new Map<string, number>();
    for (const e of flightEvents) {
      const eDate = (e.actualArrival ?? e.scheduledArrival ?? "")?.split("T")[0];
      map.set(eDate, (map.get(eDate) ?? 0) + 1);
    }
    return map;
  }, [flightEvents]);

  if (error) {
    return (
      <div className="space-y-3">
        <TopMenuBar title="Capacity Modeling" icon="fa-solid fa-gauge-high" />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
            <i className="fa-solid fa-rotate mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TopMenuBar
        title="Capacity Modeling"
        icon="fa-solid fa-gauge-high"
        actions={
          <div className="flex items-center gap-4">
            {/* Warning bell — only shown when warnings exist */}
            {warnings.length > 0 && (
              <button
                onClick={() => setWarningsDismissed(false)}
                disabled={!warningsDismissed}
                title={
                  warningsDismissed
                    ? `Show ${warnings.length} staffing warning${warnings.length !== 1 ? "s" : ""}`
                    : `${warnings.length} staffing warning${warnings.length !== 1 ? "s" : ""}`
                }
                className={`relative transition-opacity ${
                  warningsDismissed
                    ? "opacity-50 hover:opacity-75 cursor-pointer"
                    : "opacity-25 cursor-default"
                }`}
              >
                <i
                  className={`fa-solid fa-bell text-sm ${
                    (summary?.criticalDays ?? 0) > 0
                      ? "text-red-400"
                      : (summary?.overtimeDays ?? 0) > 0
                        ? "text-amber-400"
                        : "text-yellow-400"
                  }`}
                />
                {/* Badge */}
                <span
                  className={`absolute -top-1.5 -right-1.5 text-[8px] font-semibold leading-none rounded-full px-[3px] py-px min-w-[13px] text-center opacity-80 ${
                    (summary?.criticalDays ?? 0) > 0
                      ? "bg-red-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {warnings.length}
                </span>
              </button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefetch} disabled={isLoading}>
              <i className={`fa-solid fa-rotate mr-1.5 ${isLoading ? "fa-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <>
          {/* Lens selector */}
          <LensSelector
            activeLens={activeLens}
            availableLenses={availableLenses}
            onLensChange={setActiveLens}
          />

          {/* Warnings banner */}
          {warnings.length > 0 && !warningsDismissed && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-medium text-amber-400">
                    Staffing Warnings ({warnings.length})
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {warnings.length > 5 && (
                      <li className="text-amber-400">...and {warnings.length - 5} more</li>
                    )}
                  </ul>
                </div>
                <button
                  onClick={() => setWarningsDismissed(true)}
                  className="shrink-0 text-amber-400/60 hover:text-amber-400 transition-colors ml-1"
                  aria-label="Dismiss warnings"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>
            </div>
          )}

          {/* KPI Strip */}
          {summary && (
            <CapacityKpiStrip
              summary={summary}
              dayCount={utilization.length}
              activeLens={activeLens}
              demand={demand}
              flightEvents={flightEvents}
              coverageWindows={coverageWindows}
            />
          )}

          {/* Main 2-column grid: chart left (full height), heatmap + pies right */}
          <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-3">
            {/* Left: stretches to match right column height */}
            <div className="flex flex-col min-h-0">
              {activeLens === "forecast" ? (
                <ForecastPatternChart
                  demand={demand}
                  capacity={capacity}
                  shifts={shifts}
                  fillHeight
                />
              ) : (
                <CapacitySummaryChart
                  capacity={capacity}
                  demand={demand}
                  utilization={utilization}
                  shifts={shifts}
                  activeLens={activeLens}
                  fillHeight
                />
              )}
            </div>

            {/* Right column: heatmap top, 3 pies bottom */}
            <div className="flex flex-col gap-3">
              {/* Right top: Shift Utilization Heatmap */}
              <div className="overflow-x-auto">
                <CapacityHeatmap
                  capacity={capacity}
                  demand={demand}
                  utilization={utilization}
                  shifts={shifts}
                  activeLens={activeLens}
                  onCellClick={handleCellClick}
                />
              </div>

              {/* Right bottom: 3 demand breakdown pies */}
              <CapacityPieCharts
                demand={demand}
                utilization={utilization}
                shifts={shifts}
                activeLens={activeLens}
              />
            </div>
          </div>

          {/* Detail Table (V2 direct) */}
          <CapacityTable
            demand={demand}
            capacity={capacity}
            utilization={utilization}
            activeLens={activeLens}
            eventCountByDate={eventCountByDate}
          />

          {/* Drilldown drawer */}
          <ShiftDrilldownDrawer
            open={drawerOpen}
            onClose={handleDrawerClose}
            date={drawerDate}
            shiftCode={drawerShift}
            capacity={capacity}
            demand={demand}
            utilization={utilization}
            shifts={shifts}
            assumptions={assumptions}
            activeLens={activeLens}
            contracts={contracts}
            flightEvents={flightEvents}
            timeBookings={timeBookings}
            billingEntries={billingEntries}
            forecastRates={forecastRates}
            forecastModel={forecastModel}
            concurrencyBuckets={concurrencyBuckets}
          />
        </>
      )}
    </div>
  );
}

export default function CapacityPage() {
  return (
    <Suspense fallback={null}>
      <CapacityPageInner />
    </Suspense>
  );
}
