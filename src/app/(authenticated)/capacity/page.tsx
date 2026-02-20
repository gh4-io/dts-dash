"use client";

import { Suspense, useMemo } from "react";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { ConfigPanel } from "@/components/capacity/config-panel";
import { UtilizationChart } from "@/components/capacity/utilization-chart";
import { CapacityTable } from "@/components/capacity/capacity-table";
import { useCapacity } from "@/lib/hooks/use-capacity";

function CapacityPageInner() {
  const {
    demand,
    capacity,
    utilization,
    config,
    isLoading,
    isConfigLoading,
    error,
    updateConfig,
    refetch,
  } = useCapacity();

  const summary = useMemo(() => {
    if (utilization.length === 0) return null;
    const avgUtil = utilization.reduce((s, u) => s + u.utilizationPercent, 0) / utilization.length;
    const criticalDays = utilization.filter((u) => u.criticalFlag).length;
    const overtimeDays = utilization.filter((u) => u.overtimeFlag && !u.criticalFlag).length;
    const totalDemand = demand.reduce((s, d) => s + d.totalDemandMH, 0);
    const totalCapacity = capacity.reduce((s, c) => s + c.realCapacityMH, 0);
    return { avgUtil, criticalDays, overtimeDays, totalDemand, totalCapacity };
  }, [demand, capacity, utilization]);

  if (error) {
    return (
      <div className="space-y-3">
        <TopMenuBar title="Capacity Modeling" icon="fa-solid fa-gauge-high" />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TopMenuBar title="Capacity Modeling" icon="fa-solid fa-gauge-high" />

      {isLoading || isConfigLoading ? (
        <LoadingSkeleton variant="page" />
      ) : (
        <>
          {/* Summary KPI pills */}
          {summary && (
            <div className="flex flex-wrap gap-2">
              <SummaryPill
                icon="fa-chart-line"
                label="Avg Utilization"
                value={`${summary.avgUtil.toFixed(1)}%`}
                color={
                  summary.avgUtil > 120
                    ? "text-red-500"
                    : summary.avgUtil > 100
                      ? "text-amber-500"
                      : summary.avgUtil > 80
                        ? "text-blue-500"
                        : "text-green-500"
                }
              />
              <SummaryPill
                icon="fa-calendar-days"
                label="Days"
                value={String(utilization.length)}
              />
              <SummaryPill
                icon="fa-hammer"
                label="Total Demand"
                value={`${summary.totalDemand.toFixed(0)} MH`}
              />
              <SummaryPill
                icon="fa-people-group"
                label="Total Capacity"
                value={`${summary.totalCapacity.toFixed(0)} MH`}
              />
              {summary.criticalDays > 0 && (
                <SummaryPill
                  icon="fa-triangle-exclamation"
                  label="Critical Days"
                  value={String(summary.criticalDays)}
                  color="text-red-500"
                />
              )}
              {summary.overtimeDays > 0 && (
                <SummaryPill
                  icon="fa-clock"
                  label="Overtime Days"
                  value={String(summary.overtimeDays)}
                  color="text-yellow-500"
                />
              )}
            </div>
          )}

          {/* Config Panel */}
          {config && (
            <ConfigPanel
              key={`${config.defaultMH}:${config.wpMHMode}:${JSON.stringify(config.shifts)}`}
              config={config}
              onConfigChange={updateConfig}
              onRefetch={refetch}
            />
          )}

          {/* Utilization Chart */}
          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
              <i className="fa-solid fa-chart-bar" />
              Daily Utilization
            </h3>
            <UtilizationChart demand={demand} capacity={capacity} utilization={utilization} />
          </div>

          {/* Detail Table */}
          <CapacityTable demand={demand} capacity={capacity} utilization={utilization} />
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

function SummaryPill({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
      <i className={`fa-solid ${icon} text-[10px] text-muted-foreground`} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${color ?? ""}`}>{value}</span>
    </div>
  );
}
