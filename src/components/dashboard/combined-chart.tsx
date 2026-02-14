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
} from "recharts";

interface HourlySnapshot {
  hour: string;
  arrivalsCount: number;
  departuresCount: number;
  onGroundCount: number;
}

interface CombinedChartProps {
  snapshots: HourlySnapshot[];
}

function formatHourLabel(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: "UTC",
  });
}

function formatDayLabel(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function CombinedChart({ snapshots }: CombinedChartProps) {
  const chartData = useMemo(() => {
    return snapshots.map((s) => ({
      hour: s.hour,
      label: formatHourLabel(s.hour),
      dayLabel: formatDayLabel(s.hour),
      arrivals: s.arrivalsCount,
      departures: s.departuresCount,
      onGround: s.onGroundCount,
    }));
  }, [snapshots]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <i className="fa-solid fa-chart-column text-3xl mb-2 block" />
          <p className="text-sm">No hourly data available</p>
        </div>
      </div>
    );
  }

  // Calculate tick indices for midnight markers (day separators)
  const midnightIndices = chartData
    .map((d, i) => ({ i, hour: new Date(d.hour).getUTCHours() }))
    .filter((d) => d.hour === 0)
    .map((d) => d.i);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          opacity={0.3}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={{ stroke: "hsl(var(--border))" }}
          // Show midnight ticks as day labels
          ticks={midnightIndices.map((i) => chartData[i]?.label)}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            color: "hsl(var(--popover-foreground))",
            fontSize: 12,
          }}
          labelFormatter={(_, payload) => {
            if (payload?.[0]?.payload?.dayLabel) {
              return `${payload[0].payload.dayLabel} ${payload[0].payload.label}`;
            }
            return "";
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Bar
          dataKey="arrivals"
          name="Arrivals"
          fill="#3b82f6"
          radius={[2, 2, 0, 0]}
          barSize={8}
        />
        <Bar
          dataKey="departures"
          name="Departures"
          fill="#f43f5e"
          radius={[2, 2, 0, 0]}
          barSize={8}
        />
        <Line
          dataKey="onGround"
          name="On Ground"
          type="monotone"
          stroke="#eab308"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
