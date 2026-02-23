"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "recharts";
import type { DailyCapacityV2, DailyDemandV2, CapacityShift } from "@/types";
// Direct import — NOT barrel (D-047: barrel re-exports server-only modules)
import { computeDayOfWeekPattern } from "@/lib/capacity/forecast-pattern-engine";
import { useCustomers } from "@/lib/hooks/use-customers";

type ViewMode = "byShift" | "byCustomer" | "total";

interface ForecastPatternChartProps {
  demand: DailyDemandV2[];
  capacity: DailyCapacityV2[];
  shifts: CapacityShift[];
  /** When true, fills parent container height instead of using a fixed 340px */
  fillHeight?: boolean;
}

const SHIFT_BAR_COLORS: Record<string, string> = {
  DAY: "#f59e0b",
  SWING: "#f97316",
  NIGHT: "#6366f1",
};

export function ForecastPatternChart({
  demand,
  capacity,
  shifts,
  fillHeight = false,
}: ForecastPatternChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("byShift");
  const { getColor, fetch: fetchCustomers } = useCustomers();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  const patternResult = useMemo(
    () => computeDayOfWeekPattern(demand, capacity),
    [demand, capacity],
  );

  const hasForecast = useMemo(
    () => patternResult.pattern.some((p) => p.avgForecastedMH !== null),
    [patternResult],
  );

  const allCustomers = useMemo(() => {
    const names = new Set<string>();
    for (const p of patternResult.pattern) {
      for (const name of Object.keys(p.avgDemandByCustomer)) {
        names.add(name);
      }
    }
    return Array.from(names).sort();
  }, [patternResult]);

  const chartData = useMemo(() => {
    return patternResult.pattern.map((p) => {
      const row: Record<string, unknown> = {
        label: p.label,
        dayOfWeek: p.dayOfWeek,
        avgCapacityMH: p.avgCapacityMH,
        sampleCount: p.sampleCount,
      };

      if (viewMode === "total") {
        row.avgDemandMH = p.avgDemandMH;
      } else if (viewMode === "byCustomer") {
        for (const customer of allCustomers) {
          row[`demand_${customer}`] = p.avgDemandByCustomer[customer] ?? 0;
        }
      } else {
        // byShift
        for (const shift of activeShifts) {
          row[`demand_${shift.code}`] = p.avgDemandByShift[shift.code] ?? 0;
        }
      }

      // Forecast overlay
      if (hasForecast && p.avgForecastedMH !== null) {
        row.avgForecastedMH = p.avgForecastedMH;
      }

      return row;
    });
  }, [patternResult, activeShifts, allCustomers, viewMode, hasForecast]);

  if (demand.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <i className="fa-solid fa-chart-line text-3xl mb-2 block" />
          <p className="text-sm">No data available for forecast pattern</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border bg-card${fillHeight ? " flex flex-col h-full" : ""}`}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-chart-line" />
          Typical Week Pattern
          <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {patternResult.totalWeeks} wk{patternResult.totalWeeks !== 1 ? "s" : ""}
          </span>
        </h3>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {(["byShift", "byCustomer", "total"] as const).map((mode) => (
            <button
              key={mode}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === mode
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode === "byShift" ? "By Shift" : mode === "byCustomer" ? "By Customer" : "Total"}
            </button>
          ))}
        </div>
      </div>

      <div className={`p-3${fillHeight ? " flex-1 min-h-0" : ""}`}>
        <ResponsiveContainer width="100%" height={fillHeight ? "100%" : 340}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              yAxisId="mh"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Avg Man-Hours",
                angle: -90,
                position: "insideLeft",
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
              formatter={(value, name) => [`${value} MH`, name]}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                if (!item) return "";
                const samples = item.sampleCount ?? 0;
                return `${item.label} — avg of ${samples} ${samples === 1 ? "day" : "days"}`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

            {/* Demand bars: by mode */}
            {viewMode === "total" ? (
              <Bar
                yAxisId="mh"
                dataKey="avgDemandMH"
                name="Avg Demand"
                fill="#3b82f6"
                fillOpacity={0.8}
                radius={[2, 2, 0, 0]}
                barSize={20}
              />
            ) : viewMode === "byCustomer" ? (
              allCustomers.map((customer) => (
                <Bar
                  key={customer}
                  yAxisId="mh"
                  dataKey={`demand_${customer}`}
                  name={customer}
                  fill={getColor(customer)}
                  fillOpacity={0.8}
                  radius={[2, 2, 0, 0]}
                  barSize={Math.max(8, Math.floor(40 / allCustomers.length))}
                />
              ))
            ) : (
              activeShifts.map((shift) => (
                <Bar
                  key={shift.code}
                  yAxisId="mh"
                  dataKey={`demand_${shift.code}`}
                  name={`${shift.name} Demand`}
                  fill={SHIFT_BAR_COLORS[shift.code] ?? "#6b7280"}
                  fillOpacity={0.8}
                  radius={[2, 2, 0, 0]}
                  barSize={16}
                />
              ))
            )}

            {/* Capacity reference line */}
            <Line
              yAxisId="mh"
              dataKey="avgCapacityMH"
              name="Avg Capacity"
              type="monotone"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />

            {/* Forecast overlay line (conditional) */}
            {hasForecast && (
              <Line
                yAxisId="mh"
                dataKey="avgForecastedMH"
                name="Avg Forecast"
                type="monotone"
                stroke="#14b8a6"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={{ r: 3, fill: "#14b8a6", strokeWidth: 0 }}
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
