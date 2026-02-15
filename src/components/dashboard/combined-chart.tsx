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
} from "recharts";

interface HourlySnapshot {
  hour: string;
  arrivalsCount: number;
  departuresCount: number;
  onGroundCount: number;
}

interface CombinedChartProps {
  snapshots: HourlySnapshot[];
  timezone?: string;
}

export function CombinedChart({ snapshots, timezone = "UTC" }: CombinedChartProps) {
  const chartData = useMemo(() => {
    return snapshots.map((s) => ({
      hour: s.hour,
      arrivals: s.arrivalsCount,
      departures: s.departuresCount,
      onGround: s.onGroundCount,
    }));
  }, [snapshots]);

  // Find midnight ISO strings for day separator reference lines
  const midnightHours = useMemo(() => {
    if (chartData.length === 0) return [];
    const hourFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    });
    const dateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return chartData
      .filter((d) => {
        const h = parseInt(hourFmt.format(new Date(d.hour)));
        return h === 0;
      })
      .map((d) => ({
        hour: d.hour,
        dateLabel: dateFmt.format(new Date(d.hour)),
      }));
  }, [chartData, timezone]);

  // Determine smart tick interval based on data size
  const tickInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 48) return 3;       // ≤2 days: every 3h
    if (len <= 96) return 6;       // ≤4 days: every 6h
    if (len <= 168) return 12;     // ≤7 days: every 12h
    if (len <= 720) return 24;     // ≤30 days: every 24h (daily)
    return 48;                     // >30 days: every 2 days
  }, [chartData.length]);

  // Format x-axis ticks — show date at midnight, time otherwise
  const formatTick = useMemo(() => {
    const hourFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    });
    const timeFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: true,
    });
    const dateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    });

    return (isoStr: string) => {
      const d = new Date(isoStr);
      const h = parseInt(hourFmt.format(d));
      if (h === 0) {
        return dateFmt.format(d);
      }
      return timeFmt.format(d);
    };
  }, [timezone]);

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

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--muted-foreground))"
          opacity={0.2}
          horizontal={true}
          vertical={false}
        />

        {/* Day separator lines at midnight */}
        {midnightHours.map((m) => (
          <ReferenceLine
            key={m.hour}
            x={m.hour}
            stroke="hsl(var(--foreground))"
            strokeWidth={1}
            strokeDasharray="6 3"
            opacity={0.5}
            label={{
              value: m.dateLabel,
              position: "insideTopRight",
              fill: "hsl(var(--foreground))",
              fontSize: 10,
              fontWeight: 700,
              offset: 4,
            }}
          />
        ))}

        <XAxis
          dataKey="hour"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          interval={tickInterval}
          tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
          axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
          tickFormatter={formatTick}
        />
        <YAxis
          tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={35}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            color: "hsl(var(--popover-foreground))",
            fontSize: 12,
          }}
          labelFormatter={(isoStr) => {
            const d = new Date(isoStr);
            const datePart = d.toLocaleDateString("en-US", {
              timeZone: timezone,
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const timePart = d.toLocaleTimeString("en-US", {
              timeZone: timezone,
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
            return `${datePart} ${timePart}`;
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
