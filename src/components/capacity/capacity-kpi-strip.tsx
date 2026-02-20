"use client";

import type { CapacitySummary } from "@/types";

interface CapacityKpiStripProps {
  summary: CapacitySummary;
  dayCount: number;
}

function getUtilColor(val: number | null): string {
  if (val === null) return "text-muted-foreground";
  if (val > 120) return "text-red-400";
  if (val > 100) return "text-amber-400";
  if (val > 80) return "text-blue-400";
  return "text-emerald-400";
}

function KpiCard({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="flex-1 min-w-[140px] rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <i className={`fa-solid ${icon} text-[9px]`} />
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${color ?? ""}`}>{value}</div>
      {subValue && <div className="text-[10px] text-muted-foreground">{subValue}</div>}
    </div>
  );
}

export function CapacityKpiStrip({ summary, dayCount }: CapacityKpiStripProps) {
  const avgUtil = summary.avgUtilization;
  const peakUtil = summary.peakUtilization;
  const gap = summary.totalCapacityMH - summary.totalDemandMH;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <KpiCard
        icon="fa-chart-line"
        label="Avg Utilization"
        value={avgUtil !== null ? `${avgUtil.toFixed(1)}%` : "N/A"}
        subValue={`${dayCount} days`}
        color={getUtilColor(avgUtil)}
      />
      <KpiCard
        icon="fa-arrow-up"
        label="Peak Utilization"
        value={peakUtil !== null ? `${peakUtil.toFixed(1)}%` : "N/A"}
        subValue={
          summary.worstDeficit
            ? `${summary.worstDeficit.date} ${summary.worstDeficit.shift}`
            : undefined
        }
        color={getUtilColor(peakUtil)}
      />
      <KpiCard
        icon="fa-hammer"
        label="Total Demand"
        value={`${summary.totalDemandMH.toFixed(0)} MH`}
      />
      <KpiCard
        icon="fa-people-group"
        label="Total Capacity"
        value={`${summary.totalCapacityMH.toFixed(0)} MH`}
        subValue={`Gap: ${gap >= 0 ? "+" : ""}${gap.toFixed(0)} MH`}
        color={gap < 0 ? "text-red-400" : "text-emerald-400"}
      />
      {summary.criticalDays > 0 && (
        <KpiCard
          icon="fa-triangle-exclamation"
          label="Critical Days"
          value={String(summary.criticalDays)}
          subValue=">120% utilization"
          color="text-red-400"
        />
      )}
      {summary.overtimeDays > 0 && (
        <KpiCard
          icon="fa-clock"
          label="Overtime Days"
          value={String(summary.overtimeDays)}
          subValue=">100% utilization"
          color="text-amber-400"
        />
      )}
      {summary.noCoverageDays > 0 && (
        <KpiCard
          icon="fa-ban"
          label="No Coverage"
          value={String(summary.noCoverageDays)}
          subValue="Shift slots with 0 heads"
          color="text-muted-foreground"
        />
      )}
    </div>
  );
}
