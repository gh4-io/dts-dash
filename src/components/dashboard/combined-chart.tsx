"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
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
  ReferenceArea,
} from "recharts";

interface HourlySnapshot {
  hour: string;
  arrivalsCount: number;
  departuresCount: number;
  onGroundCount: number;
}

export interface ChartTimeRange {
  /** ISO string — start of first selected hour */
  start: string;
  /** ISO string — start of last selected hour (range covers through end of this hour) */
  end: string;
}

interface CombinedChartProps {
  snapshots: HourlySnapshot[];
  timezone?: string;
  timeFormat?: "12h" | "24h";
  onSelectionChange?: (range: ChartTimeRange | null) => void;
}

interface SelectionStats {
  hourCount: number;
  totalArrivals: number;
  totalDepartures: number;
  peakOnGround: number;
  startLabel: string;
  endLabel: string;
}

export function CombinedChart({
  snapshots,
  timezone = "UTC",
  timeFormat = "24h",
  onSelectionChange,
}: CombinedChartProps) {
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

  // Compute explicit tick positions aligned to multiples of (1,2,3,6,12) off 00:00
  // Always includes the first and last data points so the axis spans the full range
  const alignedTicks = useMemo(() => {
    if (chartData.length === 0) return [];

    // Pick step: aim for ~8-16 visible ticks
    const hours = chartData.length;
    let step: number;
    if (hours <= 12)
      step = 1; // ≤12h: every hour
    else if (hours <= 24)
      step = 2; // ≤1 day: every 2h
    else if (hours <= 48)
      step = 3; // ≤2 days: every 3h
    else if (hours <= 96)
      step = 6; // ≤4 days: every 6h
    else step = 12; // >4 days: every 12h

    const hourFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    });

    const first = chartData[0].hour;
    const last = chartData[chartData.length - 1].hour;

    const aligned = chartData
      .filter((d) => {
        const h = parseInt(hourFmt.format(new Date(d.hour)));
        return h % step === 0;
      })
      .map((d) => d.hour);

    // Ensure start and end are always present
    if (aligned[0] !== first) aligned.unshift(first);
    if (aligned[aligned.length - 1] !== last) aligned.push(last);

    return aligned;
  }, [chartData, timezone]);

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
      hour12: timeFormat === "12h",
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
  }, [timezone, timeFormat]);

  // --- Range selection state ---
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragCurrent, setDragCurrent] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ x1: string; x2: string } | null>(null);
  const didDragRef = useRef(false);

  // Returns [earlier, later] sorted by position in chartData (handles RTL drag)
  const sortedRange = useCallback(
    (a: string, b: string): [string, string] => {
      const ia = chartData.findIndex((d) => d.hour === a);
      const ib = chartData.findIndex((d) => d.hour === b);
      return ia <= ib ? [a, b] : [b, a];
    },
    [chartData],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseDown = useCallback((state: any) => {
    const label = state?.activeLabel as string | undefined;
    if (!label) return;
    setDragStart(label);
    setDragCurrent(label);
    setSelection(null);
    didDragRef.current = false;
  }, []);

  const handleMouseMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      if (!dragStart) return;
      const label = state?.activeLabel as string | undefined;
      if (!label) return;
      if (label !== dragStart) didDragRef.current = true;
      setDragCurrent(label);
    },
    [dragStart],
  );

  const handleMouseUp = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      if (!dragStart) return;
      const label = (state?.activeLabel as string | undefined) ?? dragCurrent;

      if (!didDragRef.current || !label || label === dragStart) {
        setSelection(null);
      } else {
        const [x1, x2] = sortedRange(dragStart, label);
        setSelection({ x1, x2 });
      }

      setDragStart(null);
      setDragCurrent(null);
      didDragRef.current = false;
    },
    [dragStart, dragCurrent, sortedRange],
  );

  const handleMouseLeave = useCallback(() => {
    if (dragStart && dragCurrent && didDragRef.current && dragStart !== dragCurrent) {
      const [x1, x2] = sortedRange(dragStart, dragCurrent);
      setSelection({ x1, x2 });
    } else if (dragStart) {
      setSelection(null);
    }
    setDragStart(null);
    setDragCurrent(null);
    didDragRef.current = false;
  }, [dragStart, dragCurrent, sortedRange]);

  // ESC to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setDragStart(null);
        setDragCurrent(null);
        didDragRef.current = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Notify parent of time-range selection changes (for cross-filtering)
  useEffect(() => {
    onSelectionChange?.(selection ? { start: selection.x1, end: selection.x2 } : null);
  }, [selection, onSelectionChange]);

  // Active selection bounds — live during drag, committed after release
  const activeSelectionBounds = useMemo((): { x1: string; x2: string } | null => {
    if (dragStart && dragCurrent && dragStart !== dragCurrent) {
      const [x1, x2] = sortedRange(dragStart, dragCurrent);
      return { x1, x2 };
    }
    return selection;
  }, [dragStart, dragCurrent, selection, sortedRange]);

  // Stats computed from committed selection only (not live drag)
  const selectionStats = useMemo((): SelectionStats | null => {
    if (!selection) return null;

    const startIdx = chartData.findIndex((d) => d.hour === selection.x1);
    const endIdx = chartData.findIndex((d) => d.hour === selection.x2);
    if (startIdx === -1 || endIdx === -1) return null;

    const slice = chartData.slice(startIdx, endIdx + 1);
    if (slice.length === 0) return null;

    return {
      hourCount: slice.length,
      totalArrivals: slice.reduce((sum, d) => sum + d.arrivals, 0),
      totalDepartures: slice.reduce((sum, d) => sum + d.departures, 0),
      peakOnGround: Math.max(...slice.map((d) => d.onGround)),
      startLabel: formatTick(selection.x1),
      endLabel: formatTick(selection.x2),
    };
  }, [selection, chartData, formatTick]);

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
    <>
      <div
        className={`flex items-center gap-3 px-2 py-1.5 mb-2 rounded-md text-xs transition-colors ${selectionStats ? "bg-primary/10 border border-primary/20" : "border border-transparent"}`}
      >
        {selectionStats ? (
          <>
            <i className="fa-solid fa-chart-area text-primary shrink-0" />
            <span className="text-muted-foreground shrink-0">
              {selectionStats.startLabel} – {selectionStats.endLabel}
            </span>
            <span>
              <span className="font-medium tabular-nums" style={{ color: "#3b82f6" }}>
                {selectionStats.totalArrivals}
              </span>{" "}
              arr
            </span>
            <span>
              <span className="font-medium tabular-nums" style={{ color: "#f43f5e" }}>
                {selectionStats.totalDepartures}
              </span>{" "}
              dep
            </span>
            <span>
              <span className="font-medium tabular-nums" style={{ color: "#eab308" }}>
                {selectionStats.peakOnGround}
              </span>{" "}
              peak
            </span>
            <span className="text-muted-foreground">{selectionStats.hourCount}h</span>
            <button
              onClick={() => setSelection(null)}
              className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Clear selection (ESC)"
            >
              <i className="fa-solid fa-xmark text-[10px]" />
              <span>Clear</span>
            </button>
          </>
        ) : (
          <span className="invisible">placeholder</span>
        )}
      </div>
      <ResponsiveContainer
        width="100%"
        height={340}
        className="[&]:outline-none [&_svg]:outline-none [&_*]:outline-none"
      >
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ userSelect: "none", outline: "none" }}
        >
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

          {/* Selection highlight overlay */}
          {activeSelectionBounds && (
            <ReferenceArea
              x1={activeSelectionBounds.x1}
              x2={activeSelectionBounds.x2}
              fill="hsl(var(--primary))"
              fillOpacity={0.12}
              stroke="none"
            />
          )}

          <XAxis
            dataKey="hour"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
            ticks={alignedTicks}
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
            active={dragStart ? false : undefined}
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
                hour12: timeFormat === "12h",
              });
              return `${datePart} ${timePart}`;
            }}
          />
          <Legend
            wrapperStyle={{
              fontSize: 11,
              paddingTop: 8,
              color: "hsl(var(--foreground))",
              pointerEvents: "none",
            }}
            formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
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
    </>
  );
}
