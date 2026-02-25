"use client";

import { useMemo } from "react";
import type {
  CapacitySummary,
  CapacityLensId,
  DailyDemandV2,
  FlightEvent,
  EventCoverageWindow,
  GapSummary,
  CustomerEventSummary,
} from "@/types";
// Direct import — NOT barrel (D-047: barrel re-exports server-only modules)
import { CAPACITY_LENSES } from "@/lib/capacity/lens-config";

interface CapacityKpiStripProps {
  summary: CapacitySummary;
  dayCount: number;
  activeLens: CapacityLensId;
  demand: DailyDemandV2[];
  flightEvents?: FlightEvent[];
  coverageWindows?: EventCoverageWindow[];
  gapSummary?: GapSummary | null;
  activeScenarioLabel?: string;
  customerEventSummary?: CustomerEventSummary[];
  /** Secondary lens for cross-lens comparison (G-07 session 2) */
  secondaryLens?: CapacityLensId | null;
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

const GAP_CLASS_CONFIG: Record<GapSummary["classification"], { color: string; icon: string }> = {
  surplus: { color: "text-emerald-400", icon: "fa-scale-balanced" },
  balanced: { color: "text-blue-400", icon: "fa-scale-balanced" },
  tight: { color: "text-amber-400", icon: "fa-scale-unbalanced" },
  deficit: { color: "text-red-400", icon: "fa-scale-unbalanced" },
};

export function CapacityKpiStrip({
  summary,
  dayCount,
  activeLens,
  demand,
  flightEvents,
  coverageWindows,
  gapSummary,
  activeScenarioLabel,
  customerEventSummary,
  secondaryLens,
}: CapacityKpiStripProps) {
  const avgUtil = summary.avgUtilization;
  const peakUtil = summary.peakUtilization;
  const gap = summary.totalCapacityMH - summary.totalDemandMH;

  const lensKpis = useMemo(() => {
    switch (activeLens) {
      case "allocated": {
        const total = demand.reduce((s, d) => s + (d.totalAllocatedDemandMH ?? 0), 0);
        return [
          {
            icon: "fa-handshake",
            label: "Allocated Demand",
            value: `${total.toFixed(0)} MH`,
            color: "text-amber-400",
          },
        ];
      }
      case "forecast": {
        const total = demand.reduce((s, d) => s + (d.totalForecastedDemandMH ?? 0), 0);
        return [
          {
            icon: "fa-chart-line",
            label: "Forecasted Demand",
            value: `${total.toFixed(0)} MH`,
            color: "text-teal-400",
          },
        ];
      }
      case "worked": {
        const totalWorked = demand.reduce((s, d) => s + (d.totalWorkedMH ?? 0), 0);
        const totalDemand = summary.totalDemandMH;
        const variance = totalDemand > 0 ? ((totalDemand - totalWorked) / totalDemand) * 100 : 0;
        return [
          {
            icon: "fa-stopwatch",
            label: "Total Worked",
            value: `${totalWorked.toFixed(0)} MH`,
            color: "text-green-400",
          },
          {
            icon: "fa-scale-balanced",
            label: "Plan vs Actual",
            value: `${variance >= 0 ? "+" : ""}${variance.toFixed(1)}%`,
            color: Math.abs(variance) > 20 ? "text-amber-400" : "text-green-400",
            subValue: "Positive = under actual",
          },
        ];
      }
      case "billed": {
        const totalBilled = demand.reduce((s, d) => s + (d.totalBilledMH ?? 0), 0);
        const totalWorked = demand.reduce((s, d) => s + (d.totalWorkedMH ?? 0), 0);
        const cards: {
          icon: string;
          label: string;
          value: string;
          color?: string;
          subValue?: string;
        }[] = [
          {
            icon: "fa-file-invoice-dollar",
            label: "Total Billed",
            value: `${totalBilled.toFixed(0)} MH`,
            color: "text-indigo-400",
          },
        ];
        if (totalWorked > 0) {
          const variance = ((totalWorked - totalBilled) / totalWorked) * 100;
          cards.push({
            icon: "fa-scale-balanced",
            label: "Worked vs Billed",
            value: `${variance >= 0 ? "+" : ""}${variance.toFixed(1)}%`,
            color: Math.abs(variance) > 20 ? "text-amber-400" : "text-indigo-400",
            subValue: "Positive = under-billed",
          });
        }
        return cards;
      }
      case "events": {
        const cards: {
          icon: string;
          label: string;
          value: string;
          color?: string;
          subValue?: string;
        }[] = [
          {
            icon: "fa-plane-arrival",
            label: "Flight Events",
            value: String(flightEvents?.length ?? 0),
            color: "text-sky-400",
          },
        ];
        if (coverageWindows && coverageWindows.length > 0) {
          cards.push({
            icon: "fa-clock",
            label: "Coverage Windows",
            value: String(coverageWindows.length),
            color: "text-sky-400",
          });
        }
        // Top 3 customers by event count (G-10)
        if (customerEventSummary && customerEventSummary.length > 0) {
          const sorted = [...customerEventSummary].sort((a, b) => b.eventCount - a.eventCount);
          const top3 = sorted.slice(0, 3);
          for (const c of top3) {
            cards.push({
              icon: "fa-building",
              label: c.customer,
              value: `${c.eventCount} events`,
              color: "text-sky-300",
            });
          }
          if (sorted.length > 3) {
            cards.push({
              icon: "fa-ellipsis",
              label: "More Customers",
              value: `+${sorted.length - 3} more`,
              color: "text-muted-foreground",
            });
          }
        }
        return cards;
      }
      case "concurrent": {
        const peakConc = demand.reduce((m, d) => Math.max(m, d.peakConcurrency ?? 0), 0);
        const concDays = demand.filter((d) => (d.avgConcurrency ?? 0) > 0);
        const avgConc =
          concDays.length > 0
            ? concDays.reduce((s, d) => s + (d.avgConcurrency ?? 0), 0) / concDays.length
            : 0;
        return [
          {
            icon: "fa-layer-group",
            label: "Peak Concurrent",
            value: String(peakConc),
            color: "text-purple-400",
          },
          {
            icon: "fa-chart-area",
            label: "Avg Concurrent",
            value: avgConc.toFixed(1),
            color: "text-purple-400",
          },
        ];
      }
      default:
        return [];
    }
  }, [
    activeLens,
    demand,
    summary.totalDemandMH,
    flightEvents,
    coverageWindows,
    customerEventSummary,
  ]);

  // Cross-lens comparison delta (G-07 session 2)
  const comparisonKpi = useMemo(() => {
    if (!secondaryLens || secondaryLens === activeLens) return null;

    const getLensTotalMH = (lens: CapacityLensId): number | null => {
      switch (lens) {
        case "allocated":
          return demand.reduce((s, d) => s + (d.totalAllocatedDemandMH ?? 0), 0) || null;
        case "forecast":
          return demand.reduce((s, d) => s + (d.totalForecastedDemandMH ?? 0), 0) || null;
        case "worked":
          return demand.reduce((s, d) => s + (d.totalWorkedMH ?? 0), 0) || null;
        case "billed":
          return demand.reduce((s, d) => s + (d.totalBilledMH ?? 0), 0) || null;
        case "planned":
          return summary.totalDemandMH || null;
        default:
          return null;
      }
    };

    const primaryTotal = getLensTotalMH(activeLens);
    const secondaryTotal = getLensTotalMH(secondaryLens);

    if (primaryTotal == null || secondaryTotal == null || dayCount === 0) return null;

    const primaryAvg = primaryTotal / dayCount;
    const secondaryAvg = secondaryTotal / dayCount;
    const delta = primaryAvg - secondaryAvg;

    const primaryLabel = CAPACITY_LENSES.find((l) => l.id === activeLens)?.label ?? activeLens;
    const secondaryLabel =
      CAPACITY_LENSES.find((l) => l.id === secondaryLens)?.label ?? secondaryLens;

    return {
      icon: "fa-code-compare",
      label: `${primaryLabel} vs ${secondaryLabel}`,
      value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} MH/day`,
      color: Math.abs(delta) > 5 ? "text-amber-400" : "text-muted-foreground",
      subValue: `Avg daily: ${primaryAvg.toFixed(1)} vs ${secondaryAvg.toFixed(1)}`,
    };
  }, [activeLens, secondaryLens, demand, summary.totalDemandMH, dayCount]);

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
      {gapSummary && (
        <KpiCard
          icon={GAP_CLASS_CONFIG[gapSummary.classification].icon}
          label={`Gap Status${activeScenarioLabel && activeScenarioLabel !== "Baseline" ? ` (${activeScenarioLabel})` : ""}`}
          value={
            gapSummary.classification.charAt(0).toUpperCase() + gapSummary.classification.slice(1)
          }
          subValue={`${gapSummary.deficitDays}/${dayCount} deficit days`}
          color={GAP_CLASS_CONFIG[gapSummary.classification].color}
        />
      )}
      {lensKpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
      {comparisonKpi && <KpiCard key="comparison" {...comparisonKpi} />}
    </div>
  );
}
