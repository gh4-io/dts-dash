"use client";

import { useMemo, useCallback, useRef, useImperativeHandle, forwardRef, useEffect, useState } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { CustomChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkLineComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "next-themes";
import { useCustomers } from "@/lib/hooks/use-customers";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { formatFlightTooltip } from "./flight-tooltip";
import { cn } from "@/lib/utils";
import { BREAK_PREFIX } from "@/lib/hooks/use-transformed-data";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from "echarts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RenderGroup = any;

// Register ECharts components (tree-shaking)
echarts.use([
  CustomChart,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkLineComponent,
  GraphicComponent,
  CanvasRenderer,
]);

/**
 * Find midnight boundaries for the filter range in the given timezone
 * Returns [firstMidnight, lastMidnight] where:
 * - firstMidnight is the midnight AT OR BEFORE filterStart
 * - lastMidnight is the midnight AT OR AFTER filterEnd
 */
function findFilterMidnights(filterStart: string, filterEnd: string, tz: string): { first: number; last: number; all: number[] } {
  const startTs = new Date(filterStart).getTime();
  const endTs = new Date(filterEnd).getTime();

  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hourCycle: "h23",
  });

  // Scan backwards from start to find first midnight AT OR BEFORE
  let firstMidnight = startTs;
  for (let ts = startTs; ts >= startTs - 86400000; ts -= 3600000) {
    if (parseInt(hourFmt.format(new Date(ts))) === 0) {
      firstMidnight = ts;
      break;
    }
  }

  // Scan forwards from end to find last midnight AT OR AFTER
  let lastMidnight = endTs;
  for (let ts = endTs; ts <= endTs + 86400000; ts += 3600000) {
    if (parseInt(hourFmt.format(new Date(ts))) === 0) {
      lastMidnight = ts;
      break;
    }
  }

  // Collect all midnights in the range
  const all: number[] = [];
  for (let ts = firstMidnight; ts <= lastMidnight; ts += 86400000) {
    if (parseInt(hourFmt.format(new Date(ts))) === 0) {
      all.push(ts);
    }
  }

  return { first: firstMidnight, last: lastMidnight, all };
}

export interface FlightBoardChartHandle {
  getZoomRange: () => { start: number; end: number } | null;
  dispatchZoom: (start: number, end: number) => void;
}

interface FlightBoardChartProps {
  workPackages: SerializedWorkPackage[];
  zoomLevel: string;
  timezone: string;
  filterStart: string;
  filterEnd: string;
  isExpanded: boolean;
  onBarClick?: (wp: SerializedWorkPackage) => void;
  /** If provided, used instead of computing registrations internally */
  transformedRegistrations?: string[];
  /** Map of WP index → highlight hex color (overrides customer color) */
  highlightMap?: Map<number, string>;
  /** Group-by result for collapsing rows */
  groups?: { groupedRegistrations: string[]; wpToGroupIndex: Map<number, number> } | null;
  /** When true, click+drag on body chart pans instead of selecting bars */
  panMode?: boolean;
}

// Data array format: [regIndex, arrivalTs, departureTs, customer, registration, flightId, wpIndex]
type GanttDataItem = [
  number,        // 0: regIndex (Y category)
  number,        // 1: arrival timestamp
  number,        // 2: departure timestamp
  string,        // 3: customer name
  string,        // 4: registration
  string | null, // 5: flightId
  number,        // 6: original index in workPackages
];

export const FlightBoardChart = forwardRef<FlightBoardChartHandle, FlightBoardChartProps>(
  function FlightBoardChart({ workPackages, zoomLevel, timezone, filterStart, filterEnd, isExpanded, onBarClick, transformedRegistrations, highlightMap, groups, panMode }, ref) {
  const headerChartRef = useRef<ReactEChartsCore>(null);
  const bodyChartRef = useRef<ReactEChartsCore>(null);
  const syncLock = useRef(false);
  // ✅ NEW: Track real dataZoom state (for adaptive tick interval)
  const realZoomState = useRef<{ start: number; end: number }>({ start: 0, end: 100 });
  const [tickRecalcTrigger, setTickRecalcTrigger] = useState(0);
  // ─── NOW timestamp — initialized on mount, updated every 60s (used by NOW line rendering)
  const [nowTimestamp, setNowTimestamp] = useState(0);
  const { getColor } = useCustomers();
  const { timeFormat } = usePreferences();
  const { resolvedTheme } = useTheme();
  const echartsTheme = resolvedTheme === "dark" ? "dark" : undefined;

  // Resolve CSS variables to concrete colors for ECharts canvas (canvas can't parse var())
  const cc = useMemo(() => {
    if (typeof document === "undefined") {
      // SSR fallback — dark defaults
      return { fg: "#e5e5e5", mutedFg: "#a1a1aa", border: "#27272a", popover: "#18181b", popoverFg: "#fafafa", primary15: "rgba(59,130,246,0.15)" };
    }
    const s = getComputedStyle(document.documentElement);
    const v = (name: string) => {
      const raw = s.getPropertyValue(name).trim();
      return raw ? `hsl(${raw})` : "#888";
    };
    return {
      fg: v("--foreground"),
      mutedFg: v("--muted-foreground"),
      border: v("--border"),
      popover: v("--popover"),
      popoverFg: v("--popover-foreground"),
      primary15: (() => {
        const raw = s.getPropertyValue("--primary").trim();
        return raw ? `hsla(${raw}, 0.15)` : "rgba(59,130,246,0.15)";
      })(),
    };
  }, [resolvedTheme]);

  // Expose zoom read/write for parent toolbar handlers
  useImperativeHandle(ref, () => ({
    getZoomRange: () => {
      const instance = headerChartRef.current?.getEchartsInstance();
      if (!instance) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = instance.getOption() as any;
      const dz = opt?.dataZoom?.[0];
      return dz ? { start: dz.start ?? 0, end: dz.end ?? 100 } : null;
    },
    dispatchZoom: (start: number, end: number) => {
      [headerChartRef, bodyChartRef].forEach((r) => {
        r.current?.getEchartsInstance()?.dispatchAction({ type: "dataZoom", start, end });
      });
    },
  }));

  // ─── Compute chart data + time bounds ───
  // ✅ Note: minTime/maxTime still computed for chart data but not used for zoom (now using filter bounds)
  const { registrations, chartData, colorMap, allWps } = useMemo(() => {
    if (workPackages.length === 0) {
      return {
        registrations: [] as string[],
        chartData: [] as GanttDataItem[],
        colorMap: {} as Record<string, string>,
        allWps: workPackages,
        minTime: 0,
        maxTime: 0,
      };
    }

    // Use transformed registrations if provided, otherwise compute
    let regs: string[];
    if (transformedRegistrations && transformedRegistrations.length > 0) {
      regs = transformedRegistrations;
    } else {
      const sorted = [...workPackages].sort(
        (a, b) => new Date(a.arrival).getTime() - new Date(b.arrival).getTime()
      );
      const regSet = new Set<string>();
      sorted.forEach((wp) => regSet.add(wp.aircraftReg));
      regs = Array.from(regSet);
    }

    const colors: Record<string, string> = {};
    workPackages.forEach((wp) => {
      if (!colors[wp.customer]) colors[wp.customer] = getColor(wp.customer);
    });

    // If group-by is active, map WPs to group indices
    const wpToGroup = groups?.wpToGroupIndex;
    const groupRegs = groups?.groupedRegistrations;

    const data: GanttDataItem[] = workPackages.map((wp, idx) => {
      let regIndex: number;
      if (wpToGroup && groupRegs) {
        regIndex = wpToGroup.get(idx) ?? 0;
      } else {
        regIndex = regs.indexOf(wp.aircraftReg);
      }
      return [
        regIndex,
        new Date(wp.arrival).getTime(),
        new Date(wp.departure).getTime(),
        wp.customer,
        wp.aircraftReg,
        wp.flightId,
        idx,
      ];
    });

    const allTimes = workPackages.flatMap((wp) => [
      new Date(wp.arrival).getTime(),
      new Date(wp.departure).getTime(),
    ]);

    // Use grouped registrations for Y-axis if grouping is active
    const yRegs = groupRegs ?? regs;

    return {
      registrations: yRegs,
      chartData: data,
      colorMap: colors,
      allWps: workPackages,
      minTime: Math.min(...allTimes),
      maxTime: Math.max(...allTimes),
    };
  }, [workPackages, getColor, transformedRegistrations, groups]);

  // ─── Zoom range for the dataZoom (only recalculates on preset/filter change) ───
  const zoomRange = useMemo(() => {
    if (workPackages.length === 0) return { start: 0, end: 100 };

    const filterStartMs = new Date(filterStart).getTime();
    const filterEndMs = new Date(filterEnd).getTime();
    const totalMs = filterEndMs - filterStartMs || 86400000;

    const zoomHours: Record<string, number> = {
      "6h": 6, "12h": 12, "1d": 24, "3d": 72, "1w": 168
    };
    const hours = zoomHours[zoomLevel];
    if (!hours) return { start: 0, end: 100 };

    const rangeMs = hours * 3600000;
    const span = Math.min(100, (rangeMs / totalMs) * 100);

    // Clamp: if preset exceeds filter span, show full range
    if (span >= 99) {
      return { start: 0, end: 100 };
    }

    // Smart anchor: center on "now" if within filter range, else center of filter
    const now = Date.now();
    const centerMs = (now >= filterStartMs && now <= filterEndMs)
      ? now
      : filterStartMs + totalMs / 2;

    const centerPct = ((centerMs - filterStartMs) / totalMs) * 100;
    const start = Math.max(0, Math.min(100 - span, centerPct - span / 2));
    const end = start + span;
    return { start, end };
  }, [workPackages.length, filterStart, filterEnd, zoomLevel]);

  // ─── Filter-based midnight boundaries (TZ-aware) ───
  const { midnightTimestamps, timeGrid } = useMemo(() => {
    if (workPackages.length === 0 || !filterStart || !filterEnd) {
      return {
        midnightTimestamps: [] as number[],
        timeGrid: { intervalMs: 21600000, axisMin: 0, axisMax: 0, ticks: [] as number[] },
      };
    }

    const { first, last, all } = findFilterMidnights(filterStart, filterEnd, timezone);
    const axisMin = first;
    const axisMax = last;
    const totalMs = axisMax - axisMin || 86400000;
    const totalHours = totalMs / 3600000;

    // Compute visible hours from zoom preset for tick density
    const zoomHoursMap: Record<string, number> = { "6h": 6, "12h": 12, "1d": 24, "3d": 72, "1w": 168 };
    const visibleHours = zoomHoursMap[zoomLevel] ?? totalHours;
    const effectiveHours = Math.min(visibleHours, totalHours);

    // Pick interval based on visible window, not full range
    let intervalHours: number;
    if (effectiveHours <= 6) intervalHours = 0.25;       // 15 min
    else if (effectiveHours <= 12) intervalHours = 0.5;  // 30 min
    else if (effectiveHours <= 24) intervalHours = 1;    // 1h
    else if (effectiveHours <= 72) intervalHours = 3;    // 3h
    else intervalHours = 6;                               // 6h

    const intervalMs = intervalHours * 3600000;

    // Generate tick positions — step by interval or 1h, whichever is smaller
    const hourFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    });
    const minFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      minute: "numeric",
    });

    const stepMs = Math.min(intervalMs, 3600000);
    const ticks: number[] = [];
    for (let ts = axisMin; ts <= axisMax; ts += stepMs) {
      const h = parseInt(hourFmt.format(new Date(ts)));
      const m = parseInt(minFmt.format(new Date(ts)));
      if (intervalHours >= 1) {
        if (h % intervalHours === 0 && m === 0) ticks.push(ts);
      } else {
        const intervalMins = intervalHours * 60;
        if (m % intervalMins === 0) ticks.push(ts);
      }
    }

    return {
      midnightTimestamps: all,
      timeGrid: { intervalMs, axisMin, axisMax, ticks },
    };
  }, [workPackages.length, filterStart, filterEnd, timezone, zoomLevel]);

  // ─── Update NOW timestamp every 60s ───
  useEffect(() => {
    const tid = setTimeout(() => setNowTimestamp(Date.now()), 0);
    const id = setInterval(() => setNowTimestamp(Date.now()), 60000);
    return () => { clearTimeout(tid); clearInterval(id); };
  }, []);

  // ─── TZ-aware time formatter (reused in renderItem) ───
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat("en-US", {
      hour: "2-digit", minute: "2-digit",
      hourCycle: timeFormat === "12h" ? "h12" : "h23",
      timeZone: timezone,
    }),
    [timezone, timeFormat]
  );

  // ✅ STEP 3: Adaptive tick interval based on real visible window
  useEffect(() => {
    const { start, end } = realZoomState.current;
    const filterStartMs = new Date(filterStart).getTime();
    const filterEndMs = new Date(filterEnd).getTime();
    const totalMs = filterEndMs - filterStartMs || 86400000;
    const visibleMs = ((end - start) / 100) * totalMs;
    const visibleHours = visibleMs / 3600000;

    let intervalHours: number;
    if (visibleHours <= 6) intervalHours = 0.25;       // 15 min
    else if (visibleHours <= 12) intervalHours = 0.5;  // 30 min
    else if (visibleHours <= 24) intervalHours = 1;    // 1h
    else if (visibleHours <= 72) intervalHours = 3;    // 3h
    else intervalHours = 6;                             // 6h

    const intervalMs = intervalHours * 3600000;

    // Update header chart — 2 axes (bottom hidden for sync + top day names)
    const headerInstance = headerChartRef.current?.getEchartsInstance();
    if (headerInstance) {
      try {
        headerInstance.setOption({
          xAxis: [
            {
              // Bottom axis (hidden, for dataZoom sync) — update interval
              type: "value",
              position: "bottom",
              interval: intervalMs,
            },
            {
              // Top axis (day labels) — always 24h interval
              type: "value",
              position: "top",
              interval: 86400000,
              axisLabel: { show: true },
            },
          ],
        });
      } catch (err) {
        console.warn("[Adaptive Ticks] header setOption error:", err);
      }
    }

    // Update body chart — single axis (top, time labels)
    const bodyInstance = bodyChartRef.current?.getEchartsInstance();
    if (bodyInstance) {
      try {
        bodyInstance.setOption({
          xAxis: {
            type: "value",
            position: "top",
            interval: intervalMs,
            axisLabel: { show: true },
          },
        });
      } catch (err) {
        console.warn("[Adaptive Ticks] body setOption error:", err);
      }
    }

    console.log(`[Adaptive Ticks] Visible: ${visibleHours.toFixed(1)}h → Interval: ${intervalHours}h`);
  }, [filterStart, filterEnd, zoomLevel, tickRecalcTrigger, workPackages.length]);

  // ✅ STEP 3b: Update visible window start date label
  useEffect(() => {
    const { start } = realZoomState.current;
    const filterStartMs = new Date(filterStart).getTime();
    const filterEndMs = new Date(filterEnd).getTime();
    const totalMs = filterEndMs - filterStartMs || 86400000;

    // Compute visible window start timestamp
    const visibleStartMs = filterStartMs + (start / 100) * totalMs;
    const dateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "numeric",
      day: "numeric",
    });
    const dateStr = dateFmt.format(new Date(visibleStartMs));

    // Update header chart graphic
    const headerInstance = headerChartRef.current?.getEchartsInstance();
    if (headerInstance) {
      try {
        headerInstance.setOption({
          graphic: [
            {
              id: "visibleStartDate",
              style: { text: dateStr },
            },
          ],
        });
      } catch (err) {
        console.warn("[Date Anchor] setOption error:", err);
      }
    }
  }, [filterStart, filterEnd, timezone, tickRecalcTrigger]);

  // ─── renderItem for custom flight bars ───
  const renderFlightBar = useCallback(
    (params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
      const regIndex = api.value(0) as number;
      const arrivalTs = api.value(1) as number;
      const departureTs = api.value(2) as number;
      const customer = api.value(3) as string;
      const registration = api.value(4) as string;
      const flightId = api.value(5) as string | null;
      const wpIndex = api.value(6) as number;

      // Check if this row is a break separator — render as thick band
      if (registrations[regIndex]?.startsWith(BREAK_PREFIX)) {
        const coordSys = (params as unknown as { coordSys?: { x: number; y: number; width: number; height: number } }).coordSys;
        if (!coordSys) return;
        const breakLabel = registrations[regIndex].slice(BREAK_PREFIX.length);
        const yPos = api.coord([0, regIndex]);
        if (!yPos) return;
        const centerY = yPos[1];
        const bandHeight = 24;
        const bandTop = centerY - bandHeight / 2;
        return {
          type: "group",
          children: [
            // Background band
            { type: "rect", shape: { x: coordSys.x, y: bandTop, width: coordSys.width, height: bandHeight }, style: { fill: "rgba(128,128,128,0.15)" } },
            // Top border line
            { type: "line", shape: { x1: coordSys.x, y1: bandTop, x2: coordSys.x + coordSys.width, y2: bandTop }, style: { stroke: cc.border, lineWidth: 1 } },
            // Bottom border line
            { type: "line", shape: { x1: coordSys.x, y1: bandTop + bandHeight, x2: coordSys.x + coordSys.width, y2: bandTop + bandHeight }, style: { stroke: cc.border, lineWidth: 1 } },
            // Centered bold label
            { type: "text", style: { text: breakLabel, x: coordSys.x + coordSys.width / 2, y: centerY, fill: cc.fg, fontSize: 12, fontWeight: "bold", align: "center", verticalAlign: "middle" } },
          ],
        } as RenderGroup;
      }

      const arrival = api.coord([arrivalTs, regIndex]);
      const departure = api.coord([departureTs, regIndex]);
      if (!arrival || !departure) return;

      const sizeArr = api.size?.([0, 1]) as number[] | undefined;
      const barHeight = sizeArr ? sizeArr[1] * 0.6 : 20;

      // Use highlight color if available, otherwise customer color
      const hlColor = highlightMap?.get(wpIndex);
      const color = hlColor ?? colorMap[customer] ?? "#6b7280";

      const coordSys = (params as unknown as { coordSys?: { x: number; y: number; width: number; height: number } }).coordSys;
      if (!coordSys) return;

      const x = Math.max(arrival[0], coordSys.x);
      const w = Math.min(departure[0], coordSys.x + coordSys.width) - x;
      if (w <= 0) return;

      const y = arrival[1] - barHeight / 2;
      const centerY = y + barHeight / 2;

      const children: RenderGroup[] = [
        { type: "rect", shape: { x, y, width: w, height: barHeight, r: barHeight / 2 }, style: { fill: color } } as RenderGroup,
      ];

      const fmtTime = (ts: number) => timeFmt.format(new Date(ts));

      // Truncate text to fit within pixel budget (approximate char width)
      const truncate = (text: string, maxPx: number, charWidth: number): string => {
        const maxChars = Math.floor(maxPx / charWidth);
        if (text.length <= maxChars) return text;
        return maxChars > 3 ? text.slice(0, maxChars - 1) + "\u2026" : text.slice(0, maxChars);
      };

      const centerLabel = flightId ? `${registration} · ${flightId}` : registration;

      if (w >= 240) {
        // Full layout: arrival LEFT + center label + departure RIGHT
        children.push(
          { type: "text", style: { text: fmtTime(arrivalTs), x: x + 6, y: centerY, fill: "rgba(255,255,255,0.85)", fontSize: 9, verticalAlign: "middle" } } as RenderGroup,
          { type: "text", style: { text: truncate(centerLabel, w - 100, 6.5), x: x + w / 2, y: centerY, fill: "#fff", fontSize: 10, fontWeight: "bold", align: "center", verticalAlign: "middle" } } as RenderGroup,
          { type: "text", style: { text: fmtTime(departureTs), x: x + w - 6, y: centerY, fill: "rgba(255,255,255,0.85)", fontSize: 9, align: "right", verticalAlign: "middle" } } as RenderGroup,
        );
      } else if (w >= 170) {
        // Center label + departure RIGHT only
        children.push(
          { type: "text", style: { text: truncate(centerLabel, w - 56, 6.5), x: x + (w - 56) / 2 + 4, y: centerY, fill: "#fff", fontSize: 10, fontWeight: "bold", align: "center", verticalAlign: "middle" } } as RenderGroup,
          { type: "text", style: { text: fmtTime(departureTs), x: x + w - 6, y: centerY, fill: "rgba(255,255,255,0.85)", fontSize: 9, align: "right", verticalAlign: "middle" } } as RenderGroup,
        );
      } else if (w >= 130) {
        // Full center label only
        children.push(
          { type: "text", style: { text: centerLabel, x: x + w / 2, y: centerY, fill: "#fff", fontSize: 10, fontWeight: "bold", align: "center", verticalAlign: "middle" } } as RenderGroup,
        );
      } else if (w >= 70) {
        // Short center, truncated with ellipsis
        children.push(
          { type: "text", style: { text: truncate(centerLabel, w - 8, 5.5), x: x + w / 2, y: centerY, fill: "#fff", fontSize: 9, align: "center", verticalAlign: "middle" } } as RenderGroup,
        );
      }
      // < 70px: no text, tooltip serves as full detail

      return { type: "group", children } as RenderGroup;
    },
    [colorMap, timeFmt, registrations, highlightMap, cc]
  );

  // ─── Shared time formatters (used by both header and body charts) ───
  const { hourFormatter, dayNameFmt, dateFmt, midnightSet, tzLabel } = useMemo(() => {
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit",
      hourCycle: timeFormat === "12h" ? "h12" : "h23",
    });
    const dayNameFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, weekday: "long",
    });
    const dateFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, month: "numeric", day: "numeric",
    });
    const tzLabel = timezone === "UTC" ? "UTC" : "Eastern (ET)";
    const midnightSet = new Set(midnightTimestamps);
    return { hourFormatter, dayNameFmt, dateFmt, midnightSet, tzLabel };
  }, [timezone, timeFormat, midnightTimestamps]);

  // ─── HEADER OPTION (time axis + slider — always visible) ───
  const headerOption = useMemo(() => {

    return {
      backgroundColor: "transparent",
      graphic: [
        {
          type: "text",
          right: 25,
          top: 6,
          style: { text: tzLabel, fill: cc.mutedFg, fontSize: 10 },
          z: 100,
        },
        {
          type: "text",
          left: 100,
          top: 6,
          style: {
            text: "", // ✅ PATCH #5: Will be updated dynamically by useEffect
            fill: cc.mutedFg,
            fontSize: 10,
          },
          id: "visibleStartDate", // ✅ ID for targeting in setOption
          z: 100,
        },
      ],
      grid: {
        left: 100,
        right: 20,
        top: 22,
        bottom: 8,
      },
      xAxis: [
        // Bottom axis — hidden labels, kept for dataZoom sync
        {
          type: "value" as const,
          position: "bottom" as const,
          min: timeGrid.axisMin,
          max: timeGrid.axisMax,
          interval: timeGrid.intervalMs,
          axisLabel: { show: false },
          splitLine: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        // Top axis — day name labels at midnight boundaries (one per day)
        {
          type: "value" as const,
          position: "top" as const,
          min: timeGrid.axisMin,
          max: timeGrid.axisMax,
          interval: 86400000, // 24 hours — one tick per day
          axisLabel: {
            interval: 0, // show all day labels — never auto-skip
            color: cc.fg,
            fontSize: 12,
            fontWeight: "bold" as const,
            formatter: (value: number) => {
              // Only show label if value is at a midnight boundary
              return midnightSet.has(value) ? dayNameFmt.format(new Date(value)).toUpperCase() : "";
            },
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: { show: false, type: "category" as const, data: [] },
      dataZoom: [
        {
          type: "slider" as const,
          xAxisIndex: [0, 1],
          filterMode: "weakFilter" as const,
          height: 18,
          bottom: 4,
          start: zoomRange.start,
          end: zoomRange.end,
          handleSize: 18,
          handleStyle: {
            borderRadius: 3,
          },
          borderColor: cc.border,
          fillerColor: cc.primary15,
          textStyle: { color: cc.mutedFg },
        },
        {
          type: "inside" as const,
          xAxisIndex: [0, 1],
          filterMode: "weakFilter" as const,
          zoomOnMouseWheel: "ctrl" as const,
          moveOnMouseWheel: "shift" as const,
        },
      ],
      series: [],
    };
  }, [hourFormatter, dayNameFmt, dateFmt, midnightSet, tzLabel, timeGrid, zoomRange, cc]);

  // ─── BODY OPTION (bars + y-axis, time labels at top) ───
  const bodyOption = useMemo(() => {
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item" as const,
        appendToBody: false,
        confine: true,
        backgroundColor: cc.popover,
        borderColor: cc.border,
        textStyle: { color: cc.popoverFg },
        formatter: (params: { data: GanttDataItem }) => {
          const d = params.data;
          if (!d || !Array.isArray(d)) return "";
          const wpIdx = d[6];
          const wp = allWps[wpIdx];
          if (!wp) return "";
          return formatFlightTooltip({
            registration: wp.aircraftReg,
            aircraftType: wp.inferredType,
            customer: wp.customer,
            customerColor: colorMap[wp.customer] ?? "#6b7280",
            flightId: wp.flightId,
            arrival: wp.arrival,
            departure: wp.departure,
            groundHours: wp.groundHours,
            status: wp.status,
            workpackageNo: wp.workpackageNo,
            effectiveMH: wp.effectiveMH,
            mhSource: wp.mhSource,
            comments: wp.calendarComments,
            timezone,
            timeFormat,
          });
        },
      },
      grid: {
        left: 100,
        right: 20,
        top: 34,
        bottom: 2,
      },
      xAxis: {
        type: "value" as const,
        position: "top" as const,
        min: timeGrid.axisMin,
        max: timeGrid.axisMax,
        interval: timeGrid.intervalMs,
        axisLabel: {
          interval: 0,
          color: cc.fg,
          fontSize: 12,
          formatter: (value: number) => {
            if (midnightSet.has(value)) {
              const dateStr = dateFmt.format(new Date(value));
              const timeStr = hourFormatter.format(new Date(value));
              return `{date|${dateStr}}\n{time|${timeStr}}`;
            }
            return `{time|${hourFormatter.format(new Date(value))}}`;
          },
          rich: {
            date: { fontWeight: "bold" as const, fontSize: 12, lineHeight: 16, color: cc.fg },
            time: { fontSize: 12, lineHeight: 16 },
          },
        },
        axisLine: { show: true, lineStyle: { color: cc.border } },
        axisTick: {
          show: true,
          alignWithLabel: true,
          length: 6,
          lineStyle: { color: cc.mutedFg },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: "rgba(128,128,128,0.25)",
            width: 1,
            type: "dashed" as const,
          },
        },
      },
      yAxis: {
        type: "category" as const,
        data: registrations,
        inverse: true,
        axisLabel: {
          color: cc.fg,
          fontSize: 11,
          fontWeight: "bold" as const,
          formatter: (value: string) => {
            if (value.startsWith(BREAK_PREFIX)) return "";
            return value;
          },
        },
        splitLine: {
          show: true,
          lineStyle: { color: cc.border, opacity: 0.4 },
        },
      },
      dataZoom: [
        {
          type: "slider" as const,
          show: false,
          xAxisIndex: 0,
          filterMode: "weakFilter" as const,
          start: zoomRange.start,
          end: zoomRange.end,
        },
      ],
      series: [
        // Marker series — rendered BEHIND bars (lower z)
        {
          type: "custom" as const,
          renderItem: () => ({ type: "group" as const, children: [] }),
          data: [],
          z: 1,
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            animation: false,
            data: [],
          },
        },
        // Bar series — rendered ON TOP (higher z)
        {
          type: "custom" as const,
          renderItem: renderFlightBar,
          encode: { x: [1, 2], y: 0 },
          data: chartData,
          z: 2,
        },
      ],
    };
  }, [registrations, chartData, colorMap, allWps, renderFlightBar,
      timeGrid, timezone, timeFormat, zoomRange, cc,
      hourFormatter, dateFmt, midnightSet]);

  // ─── Sync header zoom → body ───
  const handleHeaderDataZoom = useCallback(() => {
    if (syncLock.current) return;
    syncLock.current = true;
    const headerInstance = headerChartRef.current?.getEchartsInstance();
    const bodyInstance = bodyChartRef.current?.getEchartsInstance();
    if (headerInstance && bodyInstance) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = headerInstance.getOption() as any;
      const dz = opt?.dataZoom?.[0];
      if (dz) {
        const start = dz.start ?? 0;
        const end = dz.end ?? 100;
        realZoomState.current = { start, end };
        setTickRecalcTrigger((t) => t + 1);

        bodyInstance.dispatchAction({
          type: "dataZoom",
          start: dz.start,
          end: dz.end,
        });
      }
    }
    syncLock.current = false;
  }, []);

  // ─── Sync body zoom → header ───
  const handleBodyDataZoom = useCallback(() => {
    if (syncLock.current) return;
    syncLock.current = true;
    const headerInstance = headerChartRef.current?.getEchartsInstance();
    const bodyInstance = bodyChartRef.current?.getEchartsInstance();
    if (headerInstance && bodyInstance) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = bodyInstance.getOption() as any;
      const dz = opt?.dataZoom?.[0];
      if (dz) {
        const start = dz.start ?? 0;
        const end = dz.end ?? 100;
        realZoomState.current = { start, end };
        setTickRecalcTrigger((t) => t + 1);

        headerInstance.dispatchAction({ type: "dataZoom", start: dz.start, end: dz.end });
      }
    }
    syncLock.current = false;
  }, []);

  // ─── Body chart: Ctrl+Scroll zoom, Shift+Scroll pan ───
  useEffect(() => {
    const bodyEl = bodyChartRef.current?.getEchartsInstance()?.getDom();
    if (!bodyEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.shiftKey) return; // plain scroll → let CSS handle

      e.preventDefault();
      e.stopPropagation();

      const headerInstance = headerChartRef.current?.getEchartsInstance();
      const bodyInstance = bodyChartRef.current?.getEchartsInstance();
      if (!headerInstance || !bodyInstance) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = headerInstance.getOption() as any;
      const dz = opt?.dataZoom?.[0];
      if (!dz) return;

      let { start, end } = dz;
      const span = end - start;

      if (e.ctrlKey) {
        // Zoom: scale by deltaY magnitude (clamped) to handle trackpads + mice
        const absDelta = Math.min(Math.abs(e.deltaY), 100);
        const rate = absDelta * 0.0015; // gentle: ~0.15 for a full mouse tick (deltaY≈100)
        const factor = e.deltaY > 0 ? 1 + rate : 1 / (1 + rate);
        const newSpan = Math.min(100, Math.max(1, span * factor));
        const center = (start + end) / 2;
        start = Math.max(0, center - newSpan / 2);
        end = Math.min(100, center + newSpan / 2);
      } else if (e.shiftKey) {
        // Pan: scale by deltaY magnitude
        const absDelta = Math.min(Math.abs(e.deltaY), 100);
        const shift = Math.sign(e.deltaY) * span * absDelta * 0.001;
        start = Math.max(0, Math.min(100 - span, start + shift));
        end = start + span;
      }

      // Dispatch to both charts
      [headerInstance, bodyInstance].forEach((inst) => {
        inst.dispatchAction({ type: "dataZoom", start, end });
      });
    };

    bodyEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => bodyEl.removeEventListener("wheel", handleWheel);
  }, [workPackages.length]); // re-attach if chart rebuilds

  // ─── Body chart: click+drag pan (hand tool) ───
  const dragState = useRef<{ startX: number; startPct: number; span: number; dragging: boolean }>({
    startX: 0, startPct: 0, span: 0, dragging: false,
  });

  useEffect(() => {
    const bodyEl = bodyChartRef.current?.getEchartsInstance()?.getDom();
    if (!bodyEl) return;

    if (panMode) {
      bodyEl.style.cursor = "grab";
    } else {
      bodyEl.style.cursor = "";
    }

    if (!panMode) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only left button
      if (e.button !== 0) return;
      const headerInstance = headerChartRef.current?.getEchartsInstance();
      if (!headerInstance) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = headerInstance.getOption() as any;
      const dz = opt?.dataZoom?.[0];
      if (!dz) return;

      dragState.current = {
        startX: e.clientX,
        startPct: dz.start,
        span: dz.end - dz.start,
        dragging: true,
      };
      bodyEl.style.cursor = "grabbing";
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      const dx = e.clientX - dragState.current.startX;
      // Convert px delta to % of dataZoom range
      const chartWidth = bodyEl.clientWidth;
      const pctDelta = -(dx / chartWidth) * dragState.current.span * 1.5;
      let start = dragState.current.startPct + pctDelta;
      start = Math.max(0, Math.min(100 - dragState.current.span, start));
      const end = start + dragState.current.span;

      const headerInstance = headerChartRef.current?.getEchartsInstance();
      const bodyInstance = bodyChartRef.current?.getEchartsInstance();
      [headerInstance, bodyInstance].forEach((inst) => {
        inst?.dispatchAction({ type: "dataZoom", start, end });
      });
    };

    const handleMouseUp = () => {
      if (dragState.current.dragging) {
        dragState.current.dragging = false;
        bodyEl.style.cursor = "grab";
      }
    };

    bodyEl.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      bodyEl.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      bodyEl.style.cursor = "";
    };
  }, [panMode, workPackages.length]);

  // ─── Handle click on bar ───
  const handleClick = useCallback(
    (params: { data?: GanttDataItem }) => {
      if (panMode) return; // suppress clicks in pan mode
      if (!params.data || !onBarClick) return;
      const wpIdx = params.data[6];
      const wp = allWps[wpIdx];
      if (wp) onBarClick(wp);
    },
    [allWps, onBarClick, panMode]
  );

  // ─── Live NOW line + time grid lines — merge-update on body chart ───
  useEffect(() => {
    if (nowTimestamp === 0 || workPackages.length === 0) return;
    const instance = bodyChartRef.current?.getEchartsInstance();
    if (!instance) return;

    // Safety check: ensure chart is fully initialized with xAxis before updating
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opt = instance.getOption() as any;
      if (!opt?.xAxis || opt.xAxis.length === 0) {
        // Chart not fully initialized yet, skip this update
        return;
      }
    } catch {
      // getOption failed, chart not ready
      return;
    }

    // Midnight boundary markers — dark gray, visible but not dominant (skip axis edges)
    const midnightLines = midnightTimestamps
      .filter(ts => ts > timeGrid.axisMin && ts < timeGrid.axisMax)
      .map(ts => {
        const dateFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone, month: "numeric", day: "numeric",
        });
        return {
          xAxis: ts,
          lineStyle: { type: "solid" as const, color: "rgba(128,128,128,0.5)", width: 1.5 },
          label: {
            show: true,
            formatter: dateFmt.format(new Date(ts)),
            position: "start" as const,
            color: "rgba(160,160,160,0.8)",
            fontWeight: "bold" as const,
            fontSize: 11,
          },
        };
      });

    // NOW line
    const nowInRange = nowTimestamp >= timeGrid.axisMin && nowTimestamp <= timeGrid.axisMax;
    const nowLine = nowInRange
      ? [{
          xAxis: nowTimestamp,
          lineStyle: { type: "solid" as const, color: "#ef4444", width: 2 },
          label: {
            show: true,
            formatter: "NOW",
            position: "start" as const,
            color: "#ef4444",
            fontWeight: "bold" as const,
            fontSize: 10,
          },
        }]
      : [];

    try {
      instance.setOption({
        series: [
          {
            // Update marker series (index 0) with midnight + now lines
            type: "custom",
            markLine: {
              silent: true,
              symbol: ["none", "none"],
              animation: false,
              data: [...midnightLines, ...nowLine],
            },
          },
          {
            // Bar series (index 1) — keep alignment, no changes
            type: "custom",
          },
        ],
      });
    } catch (err) {
      // Suppress setOption errors during chart transitions
      console.warn("[FlightBoardChart] setOption error (likely chart transition):", err);
    }
  }, [nowTimestamp, timeGrid, midnightTimestamps, timezone, workPackages.length]);

  // ─── Empty state ───
  if (workPackages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <i className="fa-solid fa-plane-slash text-4xl mb-4" />
        <p className="text-lg font-medium">No aircraft match</p>
        <p className="text-sm">Adjust your filters to see flight data.</p>
      </div>
    );
  }

  const bodyHeight = Math.max(300, registrations.length * 36 + 38);

  return (
    <div className={cn(
      "flex flex-col",
      !isExpanded && "h-full min-h-0"
    )}>
      {/* Time axis header — always visible (yellow zone) */}
      <div className="flex-shrink-0">
        <ReactEChartsCore
          ref={headerChartRef}
          echarts={echarts}
          option={headerOption}
          style={{ height: 65, width: "100%" }}
          theme={echartsTheme}
          notMerge
          onEvents={{ datazoom: handleHeaderDataZoom }}
        />
      </div>

      {/* Chart body — scrollable in contained mode (purple zone) */}
      <div
        className={cn(
          "flex-1 min-h-0",
          !isExpanded && "overflow-y-auto"
        )}
      >
        <ReactEChartsCore
          ref={bodyChartRef}
          echarts={echarts}
          option={bodyOption}
          style={{ height: bodyHeight, width: "100%" }}
          theme={echartsTheme}
          notMerge
          onEvents={{ click: handleClick, datazoom: handleBodyDataZoom }}
        />
      </div>
    </div>
  );
});
