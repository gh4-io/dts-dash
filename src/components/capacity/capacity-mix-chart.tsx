"use client";

import { useMemo, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { SunburstChart } from "echarts/charts";
import { TooltipComponent, TitleComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "next-themes";
import type { DailyDemandV2, CapacityShift, CapacityLensId, ShiftDemandV2 } from "@/types";

echarts.use([SunburstChart, TooltipComponent, TitleComponent, CanvasRenderer]);

interface CapacityMixChartProps {
  demand: DailyDemandV2[];
  shifts: CapacityShift[];
  activeLens: CapacityLensId;
}

// Shift palette — inner ring
const SHIFT_PALETTE: Record<string, string> = {
  DAY: "#f59e0b",
  SWING: "#f97316",
  NIGHT: "#6366f1",
};

// Customer palette for outer ring
const CUSTOMER_COLORS = [
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

const LENS_LABELS: Record<CapacityLensId, string> = {
  planned: "Planned",
  allocated: "Allocated",
  events: "Events",
  forecast: "Forecast",
  worked: "Worked",
  billed: "Billed",
  concurrent: "Concurrent",
};

/** Return the lens-appropriate MH for a shift demand row */
function getShiftLensMH(sd: ShiftDemandV2, lens: CapacityLensId): number {
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

export function CapacityMixChart({ demand, shifts, activeLens }: CapacityMixChartProps) {
  const chartRef = useRef<ReactEChartsCore>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Build sunburst data: inner = shifts, outer = customers per shift
  const sunburstData = useMemo(() => {
    if (!demand.length) return [];

    const activeShifts = shifts.filter((s) => s.isActive);

    // Aggregate per-shift per-customer demand from wpContributions
    const shiftCustomerMH = new Map<string, Map<string, number>>();
    const shiftTotalMH = new Map<string, number>();

    for (const s of activeShifts) {
      shiftCustomerMH.set(s.code, new Map());
      shiftTotalMH.set(s.code, 0);
    }

    for (const day of demand) {
      for (const shiftDemand of day.byShift) {
        const custMap = shiftCustomerMH.get(shiftDemand.shiftCode);
        if (!custMap) continue;

        const mh = getShiftLensMH(shiftDemand, activeLens);
        shiftTotalMH.set(
          shiftDemand.shiftCode,
          (shiftTotalMH.get(shiftDemand.shiftCode) ?? 0) + mh,
        );

        // Accumulate customer breakdown from wpContributions
        for (const contrib of shiftDemand.wpContributions) {
          custMap.set(contrib.customer, (custMap.get(contrib.customer) ?? 0) + contrib.allocatedMH);
        }
      }
    }

    // Build stable customer color map
    const allCustomers = new Set<string>();
    for (const custMap of shiftCustomerMH.values()) {
      for (const c of custMap.keys()) allCustomers.add(c);
    }
    const customerColorMap = new Map<string, string>();
    Array.from(allCustomers)
      .sort()
      .forEach((c, i) => {
        customerColorMap.set(c, CUSTOMER_COLORS[i % CUSTOMER_COLORS.length]);
      });

    return activeShifts
      .map((shift) => {
        const custMap = shiftCustomerMH.get(shift.code)!;
        const totalMH = shiftTotalMH.get(shift.code) ?? 0;

        const customerChildren = Array.from(custMap.entries())
          .sort((a, b) => b[1] - a[1])
          .filter(([, mh]) => mh > 0)
          .map(([customer, mh]) => ({
            name: customer,
            value: Math.round(mh * 10) / 10,
            itemStyle: { color: customerColorMap.get(customer)!, opacity: 0.75 },
          }));

        return {
          name: shift.name ?? shift.code,
          value: Math.round(totalMH * 10) / 10,
          itemStyle: { color: SHIFT_PALETTE[shift.code] ?? "#6b7280" },
          children: customerChildren.length > 0 ? customerChildren : undefined,
        };
      })
      .filter((s) => s.value > 0);
  }, [demand, shifts, activeLens]);

  const option = useMemo(() => {
    const textColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
    const boldColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)";
    const tooltipBg = isDark ? "hsl(240 10% 12%)" : "hsl(0 0% 98%)";
    const tooltipBorder = isDark ? "hsl(240 6% 24%)" : "hsl(214 32% 86%)";
    const tooltipText = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";

    const totalMH = sunburstData.reduce((sum, s) => sum + (s.value ?? 0), 0);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: tooltipText, fontSize: 12 },
        formatter: (params: {
          name: string;
          value: number;
          treePathInfo: Array<{ name: string }>;
        }) => {
          const path = params.treePathInfo
            .slice(1)
            .map((p) => p.name)
            .join(" › ");
          const pct = totalMH > 0 ? ((params.value / totalMH) * 100).toFixed(1) : "0";
          return `<b>${path || params.name}</b><br/>${params.value} MH &nbsp;(${pct}% of total)`;
        },
      },
      series: [
        {
          type: "sunburst",
          data: sunburstData,
          radius: ["20%", "82%"],
          center: ["50%", "52%"],
          sort: undefined,
          emphasis: {
            focus: "ancestor",
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.4)" },
          },
          label: {
            show: true,
            fontSize: 10,
            color: textColor,
            minAngle: 15,
            overflow: "truncate",
            ellipsis: "…",
          },
          levels: [
            {},
            {
              // Inner ring: shifts
              r0: "20%",
              r: "48%",
              label: { rotate: "radial", fontSize: 11, fontWeight: "bold", color: boldColor },
              itemStyle: { borderWidth: 2, borderColor: isDark ? "#1a1a2e" : "#f8f8f8" },
            },
            {
              // Outer ring: customers
              r0: "50%",
              r: "82%",
              label: { rotate: "tangential", fontSize: 10, color: textColor },
              itemStyle: { borderWidth: 1, borderColor: isDark ? "#1a1a2e" : "#f8f8f8" },
            },
          ],
        },
      ],
    };
  }, [sunburstData, isDark]);

  if (sunburstData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <i className="fa-solid fa-chart-pie" />
            Demand Mix — Shift &amp; Customer
          </h3>
        </div>
        <div className="flex items-center justify-center h-[220px] text-muted-foreground">
          <div className="text-center">
            <i className="fa-solid fa-chart-pie text-3xl mb-2 block opacity-40" />
            <p className="text-sm">No demand data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-chart-pie" />
          Demand Mix — Shift &amp; Customer
        </h3>
        <span className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
          {LENS_LABELS[activeLens]}
        </span>
      </div>
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={option}
        style={{ height: 260 }}
        notMerge
        lazyUpdate={false}
        theme={isDark ? "dark" : undefined}
      />
    </div>
  );
}
