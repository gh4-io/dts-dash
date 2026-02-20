"use client";

import { useMemo } from "react";
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
import type { DailyDemand, DailyCapacity, DailyUtilization } from "@/types";

interface UtilizationChartProps {
  demand: DailyDemand[];
  capacity: DailyCapacity[];
  utilization: DailyUtilization[];
}

function getUtilizationColor(percent: number): string {
  if (percent > 120) return "#ef4444"; // red — critical
  if (percent > 100) return "#f59e0b"; // amber — overtime
  if (percent > 80) return "#3b82f6"; // blue — optimal
  return "#22c55e"; // green — under-utilized
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function UtilizationChart({
  demand,
  capacity,
  utilization,
}: UtilizationChartProps) {
  const chartData = useMemo(() => {
    const capMap = new Map(capacity.map((c) => [c.date, c]));
    const demandMap = new Map(demand.map((d) => [d.date, d]));

    return utilization.map((u) => {
      const cap = capMap.get(u.date);
      const dem = demandMap.get(u.date);
      return {
        date: u.date,
        label: formatDate(u.date),
        utilization: Math.round(u.utilizationPercent * 10) / 10,
        demandMH: dem ? Math.round(dem.totalDemandMH * 10) / 10 : 0,
        capacityMH: cap ? Math.round(cap.realCapacityMH * 10) / 10 : 0,
        aircraftCount: dem?.aircraftCount ?? 0,
        surplus: Math.round(u.surplusDeficitMH * 10) / 10,
      };
    });
  }, [demand, capacity, utilization]);

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
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          opacity={0.3}
        />
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
            if (name === "Utilization") return [`${value}%`, name];
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
        <Bar
          yAxisId="mh"
          dataKey="demandMH"
          name="Demand"
          radius={[2, 2, 0, 0]}
          barSize={20}
        >
          {chartData.map((entry, idx) => (
            <Cell
              key={idx}
              fill={getUtilizationColor(entry.utilization)}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
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
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
