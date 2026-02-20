"use client";

import { Suspense, useState, useCallback } from "react";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CapacityKpiStrip } from "@/components/capacity/capacity-kpi-strip";
import { CapacityHeatmap } from "@/components/capacity/capacity-heatmap";
import { CapacitySummaryChart } from "@/components/capacity/capacity-summary-chart";
import { ShiftDrilldownDrawer } from "@/components/capacity/shift-drilldown-drawer";
import { CapacityTable } from "@/components/capacity/capacity-table";
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

  // Build legacy-compatible data for the CapacityTable (backwards compat)
  const legacyDemand = demand.map((d) => ({
    date: d.date,
    totalDemandMH: d.totalDemandMH,
    aircraftCount: d.aircraftCount,
    byCustomer: d.byCustomer,
  }));

  const legacyCapacity = capacity.map((c) => ({
    date: c.date,
    theoreticalCapacityMH: c.totalPaidMH,
    realCapacityMH: c.totalProductiveMH,
    byShift: c.byShift.map((s) => ({
      shift: s.shiftName,
      headcount: s.effectiveHeadcount,
      theoreticalMH: s.paidMH,
      realMH: s.productiveMH,
    })),
  }));

  const legacyUtilization = utilization.map((u) => ({
    date: u.date,
    utilizationPercent: u.utilizationPercent ?? 0,
    surplusDeficitMH: u.gapMH,
    overtimeFlag: u.overtimeFlag,
    criticalFlag: u.criticalFlag,
  }));

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
          {summary && <CapacityKpiStrip summary={summary} dayCount={utilization.length} />}

          {/* Heatmap */}
          <CapacityHeatmap
            capacity={capacity}
            demand={demand}
            utilization={utilization}
            shifts={shifts}
            onCellClick={handleCellClick}
          />

          {/* Chart */}
          <CapacitySummaryChart
            capacity={capacity}
            demand={demand}
            utilization={utilization}
            shifts={shifts}
          />

          {/* Detail Table (using legacy-compatible wrapper) */}
          <CapacityTable
            demand={legacyDemand}
            capacity={legacyCapacity}
            utilization={legacyUtilization}
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
