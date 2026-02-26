"use client";

import { useMemo, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "next-themes";
import type {
  DailyDemandV2,
  DailyUtilizationV2,
  CapacityShift,
  CapacityLensId,
  MonthlyRollupResult,
} from "@/types";
import type { ForecastPatternResult } from "@/lib/capacity/forecast-pattern-engine";

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

interface CapacityPieChartsProps {
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  activeLens: CapacityLensId;
  viewAggregation?: "daily" | "weekly-pattern" | "monthly";
  patternResult?: ForecastPatternResult | null;
  monthlyRollup?: MonthlyRollupResult | null;
}

const SHIFT_COLORS: Record<string, string> = {
  DAY: "#f59e0b",
  SWING: "#f97316",
  NIGHT: "#6366f1",
};

const CUSTOMER_PALETTE = [
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#a78bfa",
  "#2dd4bf",
  "#fb923c",
  "#facc15",
  "#94a3b8",
  "#e879f9",
  "#4ade80",
  "#38bdf8",
  "#c084fc",
];

const UTIL_ZONE_COLORS = {
  critical: "#ef4444",
  over: "#f59e0b",
  high: "#3b82f6",
  normal: "#22c55e",
};

const LENS_LABELS: Record<CapacityLensId, string> = {
  planned: "Planned",
  allocated: "Allocated",
  events: "Events",
  forecast: "Forecast",
  worked: "Worked",
  billed: "Billed",
  concurrent: "Concurrent",
};

function getLensTotalMH(d: DailyDemandV2, lens: CapacityLensId): number {
  switch (lens) {
    case "allocated":
      return d.totalAllocatedDemandMH ?? d.totalDemandMH;
    case "forecast":
      return d.totalForecastedDemandMH ?? d.totalDemandMH;
    case "worked":
      return d.totalWorkedMH ?? d.totalDemandMH;
    case "billed":
      return d.totalBilledMH ?? d.totalDemandMH;
    default:
      return d.totalDemandMH;
  }
}

function getShiftLensMH(sd: DailyDemandV2["byShift"][number], lens: CapacityLensId): number {
  switch (lens) {
    case "allocated":
      return sd.allocatedDemandMH ?? sd.demandMH;
    case "forecast":
      return sd.forecastedDemandMH ?? sd.demandMH;
    case "worked":
      return sd.workedMH ?? sd.demandMH;
    case "billed":
      return sd.billedMH ?? sd.demandMH;
    default:
      return sd.demandMH;
  }
}

export function CapacityPieCharts({
  demand,
  utilization,
  shifts,
  activeLens,
  viewAggregation = "daily",
  patternResult,
  monthlyRollup,
}: CapacityPieChartsProps) {
  const ref1 = useRef<ReactEChartsCore>(null);
  const ref2 = useRef<ReactEChartsCore>(null);
  const ref3 = useRef<ReactEChartsCore>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // ── Shared tooltip style ────────────────────────────────────────────────
  const tooltipStyle = useMemo(
    () => ({
      confine: true,
      backgroundColor: isDark ? "hsl(240 10% 12%)" : "hsl(0 0% 98%)",
      borderColor: isDark ? "hsl(240 6% 24%)" : "hsl(214 32% 86%)",
      borderWidth: 1,
      padding: [7, 11],
      textStyle: {
        color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
        fontSize: 11,
      },
    }),
    [isDark],
  );

  // ── Chart 1: Customer Demand Donut ─────────────────────────────────────
  // Donut/ring — best for many-item parts-of-whole breakdown
  const customerDonutOption = useMemo(() => {
    const totals = new Map<string, number>();

    if (viewAggregation === "weekly-pattern" && patternResult) {
      // Sum avgDemandByCustomerByShift across all shifts × 7 DOWs
      for (const p of patternResult.pattern) {
        for (const customers of Object.values(p.avgDemandByCustomerByShift)) {
          for (const [customer, mh] of Object.entries(customers)) {
            totals.set(customer, (totals.get(customer) ?? 0) + mh);
          }
        }
      }
    } else if (viewAggregation === "monthly" && monthlyRollup) {
      // Sum bucket.byCustomer across all months
      for (const bucket of monthlyRollup.buckets) {
        for (const [customer, mh] of Object.entries(bucket.byCustomer)) {
          totals.set(customer, (totals.get(customer) ?? 0) + mh);
        }
      }
    } else {
      // Daily mode — existing logic
      for (const day of demand) {
        const mh = getLensTotalMH(day, activeLens);
        if (mh <= 0) continue;
        const rawTotal = Object.values(day.byCustomer).reduce((s, v) => s + v, 0);
        for (const [customer, rawMH] of Object.entries(day.byCustomer)) {
          const scaled = rawTotal > 0 ? (rawMH / rawTotal) * mh : rawMH;
          totals.set(customer, (totals.get(customer) ?? 0) + scaled);
        }
      }
    }

    const sortedEntries = Array.from(totals.entries())
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    const colorMap = new Map(
      sortedEntries.map(([name], i) => [name, CUSTOMER_PALETTE[i % CUSTOMER_PALETTE.length]]),
    );

    const data = sortedEntries.map(([name, value]) => ({
      name,
      value: Math.round(value * 10) / 10,
      itemStyle: { color: colorMap.get(name)! },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        ...tooltipStyle,
        trigger: "item",
        formatter: (p: { name: string; value: number; percent: number }) =>
          `<b>${p.name}</b><br/>${p.value} MH (${p.percent.toFixed(1)}%)`,
      },
      series: [
        {
          type: "pie",
          radius: ["38%", "70%"],
          center: ["50%", "54%"],
          data,
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.4)" },
            label: {
              show: true,
              fontSize: 10,
              color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
              formatter: "{b}",
            },
          },
        },
      ],
    };
  }, [demand, activeLens, tooltipStyle, isDark, viewAggregation, patternResult, monthlyRollup]);

  // ── Chart 2: Utilization Zone Distribution ─────────────────────────────
  // Standard pie — 4 clear health-band segments
  const utilizationZoneOption = useMemo(() => {
    const zones = { critical: 0, over: 0, high: 0, normal: 0 };

    if (viewAggregation === "weekly-pattern" && patternResult) {
      // Classify each (DOW × shift) avg utilization
      const activeShifts = shifts.filter((s) => s.isActive);
      for (const p of patternResult.pattern) {
        for (const shift of activeShifts) {
          const dem = p.avgDemandByShift[shift.code] ?? 0;
          const cap = p.avgCapacityByShift[shift.code] ?? 0;
          if (cap === 0) continue;
          const u = (dem / cap) * 100;
          if (u > 120) zones.critical++;
          else if (u > 100) zones.over++;
          else if (u > 80) zones.high++;
          else zones.normal++;
        }
      }
    } else if (viewAggregation === "monthly" && monthlyRollup) {
      // Classify each (month × shift) avg utilization
      for (const bucket of monthlyRollup.buckets) {
        for (const sb of bucket.byShift) {
          if (sb.avgUtilization === null) continue;
          const u = sb.avgUtilization;
          if (u > 120) zones.critical++;
          else if (u > 100) zones.over++;
          else if (u > 80) zones.high++;
          else zones.normal++;
        }
      }
    } else {
      // Daily mode — existing logic
      for (const day of utilization) {
        for (const s of day.byShift) {
          if (s.noCoverage || s.utilization === null) continue;
          const u = s.utilization;
          if (u > 120) zones.critical++;
          else if (u > 100) zones.over++;
          else if (u > 80) zones.high++;
          else zones.normal++;
        }
      }
    }

    const data = [
      {
        name: "Critical >120%",
        value: zones.critical,
        itemStyle: { color: UTIL_ZONE_COLORS.critical },
      },
      { name: "Over 100–120%", value: zones.over, itemStyle: { color: UTIL_ZONE_COLORS.over } },
      { name: "High 80–100%", value: zones.high, itemStyle: { color: UTIL_ZONE_COLORS.high } },
      { name: "Normal <80%", value: zones.normal, itemStyle: { color: UTIL_ZONE_COLORS.normal } },
    ].filter((d) => d.value > 0);

    return {
      backgroundColor: "transparent",
      tooltip: {
        ...tooltipStyle,
        trigger: "item",
        formatter: (p: { name: string; value: number; percent: number }) =>
          `<b>${p.name}</b><br/>${p.value} shift-days (${p.percent.toFixed(1)}%)`,
      },
      series: [
        {
          type: "pie",
          radius: ["0%", "70%"],
          center: ["50%", "54%"],
          data,
          itemStyle: { borderWidth: 1.5, borderColor: isDark ? "#1a1a2e" : "#f8f8f8" },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.4)" },
            label: {
              show: true,
              fontSize: 9,
              color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
              formatter: "{b}",
            },
          },
        },
      ],
    };
  }, [utilization, tooltipStyle, isDark, viewAggregation, patternResult, monthlyRollup, shifts]);

  // ── Chart 3: Shift Load Nightingale Rose ───────────────────────────────
  // Rose chart (roseType: 'area') — radius encodes magnitude, best for
  // comparing a small number of categories (DAY / SWING / NIGHT)
  const shiftRoseOption = useMemo(() => {
    const activeShifts = shifts.filter((s) => s.isActive);
    const shiftMH = new Map<string, number>(activeShifts.map((s) => [s.code, 0]));

    if (viewAggregation === "weekly-pattern" && patternResult) {
      // Sum avgDemandByShift[code] across 7 DOWs
      for (const p of patternResult.pattern) {
        for (const [code, mh] of Object.entries(p.avgDemandByShift)) {
          shiftMH.set(code, (shiftMH.get(code) ?? 0) + mh);
        }
      }
    } else if (viewAggregation === "monthly" && monthlyRollup) {
      // Sum byShift[].totalDemandMH across months
      for (const bucket of monthlyRollup.buckets) {
        for (const sb of bucket.byShift) {
          shiftMH.set(sb.shiftCode, (shiftMH.get(sb.shiftCode) ?? 0) + sb.totalDemandMH);
        }
      }
    } else {
      // Daily mode — existing logic
      for (const day of demand) {
        for (const sd of day.byShift) {
          const mh = getShiftLensMH(sd, activeLens);
          shiftMH.set(sd.shiftCode, (shiftMH.get(sd.shiftCode) ?? 0) + mh);
        }
      }
    }

    const data = activeShifts
      .map((shift) => ({
        name: shift.name ?? shift.code,
        value: Math.round((shiftMH.get(shift.code) ?? 0) * 10) / 10,
        itemStyle: { color: SHIFT_COLORS[shift.code] ?? "#6b7280" },
      }))
      .filter((d) => d.value > 0);

    return {
      backgroundColor: "transparent",
      tooltip: {
        ...tooltipStyle,
        trigger: "item",
        formatter: (p: { name: string; value: number; percent: number }) =>
          `<b>${p.name}</b><br/>${p.value} MH (${p.percent.toFixed(1)}%)`,
      },
      series: [
        {
          type: "pie",
          roseType: "area",
          radius: ["12%", "72%"],
          center: ["50%", "54%"],
          data,
          itemStyle: { borderWidth: 1.5, borderColor: isDark ? "#1a1a2e" : "#f8f8f8" },
          label: {
            show: true,
            fontSize: 10,
            color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)",
            formatter: "{b}",
            position: "outside",
          },
          labelLine: { length: 6, length2: 4 },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.4)" } },
        },
      ],
    };
  }, [
    demand,
    shifts,
    activeLens,
    tooltipStyle,
    isDark,
    viewAggregation,
    patternResult,
    monthlyRollup,
  ]);

  const hasData = demand.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-chart-pie" />
          Demand Breakdown
        </h3>
        <span className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
          {LENS_LABELS[activeLens]}
        </span>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
          <div className="text-center">
            <i className="fa-solid fa-chart-pie text-3xl mb-2 block opacity-40" />
            <p className="text-sm">No demand data</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-border">
          {/* Donut — Customer */}
          <div className="flex flex-col">
            <p className="text-[10px] font-medium text-muted-foreground text-center pt-2 px-2">
              By Customer
            </p>
            <ReactEChartsCore
              ref={ref1}
              echarts={echarts}
              option={customerDonutOption}
              style={{ height: 180 }}
              notMerge
              lazyUpdate={false}
              theme={isDark ? "dark" : undefined}
            />
          </div>

          {/* Standard Pie — Utilization Zones */}
          <div className="flex flex-col">
            <p className="text-[10px] font-medium text-muted-foreground text-center pt-2 px-2">
              Util. Zones
            </p>
            <ReactEChartsCore
              ref={ref2}
              echarts={echarts}
              option={utilizationZoneOption}
              style={{ height: 180 }}
              notMerge
              lazyUpdate={false}
              theme={isDark ? "dark" : undefined}
            />
          </div>

          {/* Nightingale Rose — Shift Load */}
          <div className="flex flex-col">
            <p className="text-[10px] font-medium text-muted-foreground text-center pt-2 px-2">
              Shift Load
            </p>
            <ReactEChartsCore
              ref={ref3}
              echarts={echarts}
              option={shiftRoseOption}
              style={{ height: 180 }}
              notMerge
              lazyUpdate={false}
              theme={isDark ? "dark" : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
