"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CapacityKpiStrip } from "@/components/capacity/capacity-kpi-strip";
import { CapacityHeatmap } from "@/components/capacity/capacity-heatmap";
import { CapacitySummaryChart } from "@/components/capacity/capacity-summary-chart";
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
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <i className={`fa-solid fa-rotate mr-1.5 ${isLoading ? "fa-spin" : ""}`} />
            Refresh
          </Button>
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
          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5" />
                <div className="space-y-1">
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

          {/* Heatmap */}
          <CapacityHeatmap
            capacity={capacity}
            demand={demand}
            utilization={utilization}
            shifts={shifts}
            activeLens={activeLens}
            onCellClick={handleCellClick}
          />

          {/* Chart */}
          <CapacitySummaryChart
            capacity={capacity}
            demand={demand}
            utilization={utilization}
            shifts={shifts}
            activeLens={activeLens}
          />

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
