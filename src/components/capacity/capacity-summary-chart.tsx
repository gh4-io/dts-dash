"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type {
  DailyCapacityV2,
  DailyDemandV2,
  DailyUtilizationV2,
  CapacityShift,
  CapacityLensId,
} from "@/types";

interface CapacitySummaryChartProps {
  capacity: DailyCapacityV2[];
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  activeLens: CapacityLensId;
}

type ViewMode = "stacked" | "total";

function getUtilizationColor(percent: number | null): string {
  if (percent === null) return "#6b7280";
  if (percent > 120) return "#ef4444";
  if (percent > 100) return "#f59e0b";
  if (percent > 80) return "#3b82f6";
  return "#22c55e";
}

const SHIFT_BAR_COLORS: Record<string, string> = {
  DAY: "#f59e0b",
  SWING: "#f97316",
  NIGHT: "#6366f1",
};

// Lens overlay line config (only MH-compatible lenses)
const LENS_LINE_CONFIG: Record<string, { stroke: string; dash: string; name: string }> = {
  allocated: { stroke: "#f59e0b", dash: "6 3", name: "Allocated" },
  forecast: { stroke: "#14b8a6", dash: "3 3", name: "Forecast" },
  worked: { stroke: "#22c55e", dash: "", name: "Worked" },
  billed: { stroke: "#6366f1", dash: "", name: "Billed" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function CapacitySummaryChart({
  capacity,
  demand,
  utilization,
  shifts,
  activeLens,
}: CapacitySummaryChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("stacked");

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  const lensLineConfig = activeLens !== "planned" ? LENS_LINE_CONFIG[activeLens] : null;

  const chartData = useMemo(() => {
    const capMap = new Map(capacity.map((c) => [c.date, c]));
    const demMap = new Map(demand.map((d) => [d.date, d]));

    return utilization.map((u) => {
      const cap = capMap.get(u.date);
      const dem = demMap.get(u.date);
      const label = formatDate(u.date);

      // Compute lens overlay value
      let lensOverlayMH: number | null = null;
      if (lensLineConfig && dem) {
        switch (activeLens) {
          case "allocated":
            lensOverlayMH = dem.totalAllocatedDemandMH ?? null;
            break;
          case "forecast":
            lensOverlayMH = dem.totalForecastedDemandMH ?? null;
            break;
          case "worked":
            lensOverlayMH = dem.totalWorkedMH ?? null;
            break;
          case "billed":
            lensOverlayMH = dem.totalBilledMH ?? null;
            break;
        }
      }

      if (viewMode === "total") {
        return {
          date: u.date,
          label,
          demandMH: Math.round(u.totalDemandMH * 10) / 10,
          capacityMH: Math.round(u.totalProductiveMH * 10) / 10,
          utilization:
            u.utilizationPercent !== null ? Math.round(u.utilizationPercent * 10) / 10 : null,
          aircraftCount: dem?.aircraftCount ?? 0,
          ...(lensOverlayMH != null ? { lensOverlayMH: Math.round(lensOverlayMH * 10) / 10 } : {}),
        };
      }

      // Stacked mode: per-shift demand bars
      const row: Record<string, unknown> = {
        date: u.date,
        label,
        capacityMH: Math.round(u.totalProductiveMH * 10) / 10,
        utilization:
          u.utilizationPercent !== null ? Math.round(u.utilizationPercent * 10) / 10 : null,
        aircraftCount: dem?.aircraftCount ?? 0,
        ...(lensOverlayMH != null ? { lensOverlayMH: Math.round(lensOverlayMH * 10) / 10 } : {}),
      };

      for (const shift of activeShifts) {
        const sd = dem?.byShift.find((s) => s.shiftCode === shift.code);
        row[`demand_${shift.code}`] = Math.round((sd?.demandMH ?? 0) * 10) / 10;

        const sc = cap?.byShift.find((s) => s.shiftCode === shift.code);
        row[`capacity_${shift.code}`] = Math.round((sc?.productiveMH ?? 0) * 10) / 10;
      }

      return row;
    });
  }, [demand, capacity, utilization, activeShifts, viewMode, activeLens, lensLineConfig]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <i className="fa-solid fa-chart-bar text-3xl mb-2 block" />
          <p className="text-sm">No capacity data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-chart-bar" />
          Demand vs Capacity
        </h3>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              viewMode === "stacked"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("stacked")}
          >
            By Shift
          </button>
          <button
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              viewMode === "total"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("total")}
          >
            Total
          </button>
        </div>
      </div>

      <div className="p-3">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              yAxisId="mh"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Man-Hours",
                angle: -90,
                position: "insideLeft",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
                offset: 10,
              }}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: "Utilization %",
                angle: 90,
                position: "insideRight",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
                offset: 10,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--popover-foreground))",
                fontSize: 12,
              }}
              formatter={(value, name) => {
                if (name === "Utilization") return [value !== null ? `${value}%` : "N/A", name];
                return [`${value} MH`, name];
              }}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                if (!item) return "";
                return `${item.label} — ${item.aircraftCount} aircraft`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <ReferenceLine
              yAxisId="pct"
              y={120}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: "CRITICAL",
                position: "right",
                fill: "#ef4444",
                fontSize: 10,
              }}
            />
            <ReferenceLine
              yAxisId="pct"
              y={100}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "100%",
                position: "right",
                fill: "#f59e0b",
                fontSize: 10,
              }}
            />

            {viewMode === "total" ? (
              <Bar yAxisId="mh" dataKey="demandMH" name="Demand" radius={[2, 2, 0, 0]} barSize={20}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={getUtilizationColor(entry.utilization as number | null)}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            ) : (
              activeShifts.map((shift) => (
                <Bar
                  key={shift.code}
                  yAxisId="mh"
                  dataKey={`demand_${shift.code}`}
                  name={`${shift.name} Demand`}
                  stackId="demand"
                  fill={SHIFT_BAR_COLORS[shift.code] ?? "#6b7280"}
                  fillOpacity={0.8}
                  radius={[0, 0, 0, 0]}
                  barSize={20}
                />
              ))
            )}

            <Line
              yAxisId="mh"
              dataKey="capacityMH"
              name="Capacity"
              type="monotone"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Line
              yAxisId="pct"
              dataKey="utilization"
              name="Utilization"
              type="monotone"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
            />

            {/* Lens overlay line (MH-compatible lenses only) */}
            {lensLineConfig && (
              <Line
                yAxisId="mh"
                dataKey="lensOverlayMH"
                name={lensLineConfig.name}
                type="monotone"
                stroke={lensLineConfig.stroke}
                strokeWidth={2}
                strokeDasharray={lensLineConfig.dash || undefined}
                dot={{ r: 3, fill: lensLineConfig.stroke, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
