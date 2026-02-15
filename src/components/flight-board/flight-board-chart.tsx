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
import { useCustomers } from "@/lib/hooks/use-customers";
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

/** Compute midnight (00:00) timestamps in the given timezone between minTs and maxTs */
function computeMidnights(minTs: number, maxTs: number, tz: string): number[] {
  const midnights: number[] = [];
  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hourCycle: "h23",
  });
  const scanStart = minTs - 2 * 86400000;
  const scanEnd = maxTs + 2 * 86400000;
  for (let ts = scanStart; ts <= scanEnd; ts += 3600000) {
    if (parseInt(hourFmt.format(new Date(ts))) === 0) {
      midnights.push(ts);
    }
  }
  return midnights;
}

export interface FlightBoardChartHandle {
  getZoomRange: () => { start: number; end: number } | null;
  dispatchZoom: (start: number, end: number) => void;
}

interface FlightBoardChartProps {
  workPackages: SerializedWorkPackage[];
  zoomLevel: string;
  timezone: string;
  isExpanded: boolean;
  onBarClick?: (wp: SerializedWorkPackage) => void;
  /** If provided, used instead of computing registrations internally */
  transformedRegistrations?: string[];
  /** Map of WP index → highlight hex color (overrides customer color) */
  highlightMap?: Map<number, string>;
  /** Group-by result for collapsing rows */
  groups?: { groupedRegistrations: string[]; wpToGroupIndex: Map<number, number> } | null;
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
  function FlightBoardChart({ workPackages, zoomLevel, timezone, isExpanded, onBarClick, transformedRegistrations, highlightMap, groups }, ref) {
  const headerChartRef = useRef<ReactEChartsCore>(null);
  const bodyChartRef = useRef<ReactEChartsCore>(null);
  const syncLock = useRef(false);
  const { getColor } = useCustomers();

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
  const { registrations, chartData, colorMap, allWps, minTime, maxTime } = useMemo(() => {
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

  // ─── Zoom range for the dataZoom ───
  const zoomRange = useMemo(() => {
    if (workPackages.length === 0) return { start: 0, end: 100 };
    const totalMs = maxTime - minTime || 86400000;
    const zoomHours: Record<string, number> = { "6h": 6, "12h": 12, "1d": 24, "3d": 72, "1w": 168 };
    const hours = zoomHours[zoomLevel] ?? 72;
    const rangeMs = hours * 3600000;
    return { start: 0, end: Math.min(100, (rangeMs / totalMs) * 100) };
  }, [workPackages.length, minTime, maxTime, zoomLevel]);

  // ─── Midnight line timestamps (TZ-aware) ───
  const midnightTimestamps = useMemo(() => {
    if (workPackages.length === 0) return [];
    return computeMidnights(minTime, maxTime, timezone);
  }, [workPackages.length, minTime, maxTime, timezone]);

  // ─── NOW timestamp — initialized on mount, updated every 60s ───
  const [nowTimestamp, setNowTimestamp] = useState(0);
  useEffect(() => {
    const tid = setTimeout(() => setNowTimestamp(Date.now()), 0);
    const id = setInterval(() => setNowTimestamp(Date.now()), 60000);
    return () => { clearTimeout(tid); clearInterval(id); };
  }, []);

  // ─── TZ-aware time formatter (reused in renderItem) ───
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone,
    }),
    [timezone]
  );

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
            { type: "line", shape: { x1: coordSys.x, y1: bandTop, x2: coordSys.x + coordSys.width, y2: bandTop }, style: { stroke: "hsl(var(--border))", lineWidth: 1 } },
            // Bottom border line
            { type: "line", shape: { x1: coordSys.x, y1: bandTop + bandHeight, x2: coordSys.x + coordSys.width, y2: bandTop + bandHeight }, style: { stroke: "hsl(var(--border))", lineWidth: 1 } },
            // Centered bold label
            { type: "text", style: { text: breakLabel, x: coordSys.x + coordSys.width / 2, y: centerY, fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: "bold", align: "center", verticalAlign: "middle" } },
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
        { type: "rect", shape: { x, y, width: w, height: barHeight, r: 3 }, style: { fill: color } } as RenderGroup,
      ];

      const fmtTime = (ts: number) => timeFmt.format(new Date(ts));

      if (w > 150) {
        const centerLabel = flightId ? `${registration}  ·  ${flightId}` : registration;
        children.push(
          { type: "text", style: { text: fmtTime(arrivalTs), x: x + 4, y: centerY, fill: "rgba(255,255,255,0.85)", fontSize: 9, verticalAlign: "middle" } } as RenderGroup,
          { type: "text", style: { text: centerLabel, x: x + w / 2, y: centerY, fill: "#fff", fontSize: 10, fontWeight: "bold", align: "center", verticalAlign: "middle" } } as RenderGroup,
          { type: "text", style: { text: fmtTime(departureTs), x: x + w - 4, y: centerY, fill: "rgba(255,255,255,0.85)", fontSize: 9, align: "right", verticalAlign: "middle" } } as RenderGroup,
        );
      } else if (w > 100) {
        const label = flightId ? `${registration} · ${flightId}` : registration;
        children.push(
          { type: "text", style: { text: label, x: x + w / 2, y: centerY, fill: "#fff", fontSize: 10, fontWeight: "bold", align: "center", verticalAlign: "middle" } } as RenderGroup,
        );
      } else if (w > 50) {
        children.push(
          { type: "text", style: { text: registration, x: x + w / 2, y: centerY, fill: "#fff", fontSize: 9, align: "center", verticalAlign: "middle" } } as RenderGroup,
        );
      }

      return { type: "group", children } as RenderGroup;
    },
    [colorMap, timeFmt, registrations, highlightMap]
  );

  // ─── HEADER OPTION (time axis + slider — always visible) ───
  const headerOption = useMemo(() => {
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const hourNumFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", hourCycle: "h23",
    });
    const dayNameFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, weekday: "long",
    });
    const tzLabel = timezone === "UTC" ? "UTC" : "Eastern (ET)";

    // Adaptive time intervals based on zoom level
    const intervalMap: Record<string, number> = {
      "6h":  3600000,   // 1h
      "12h": 7200000,   // 2h
      "1d":  10800000,  // 3h
      "3d":  21600000,  // 6h
      "1w":  43200000,  // 12h
    };
    const interval = intervalMap[zoomLevel] ?? 21600000; // default 6h

    return {
      backgroundColor: "transparent",
      graphic: [{
        type: "text",
        right: 25,
        top: 6,
        style: { text: tzLabel, fill: "#999", fontSize: 10 },
        z: 100,
      }],
      grid: {
        left: 100,
        right: 20,
        top: 28,
        bottom: 38,
      },
      xAxis: [
        // Bottom axis (index 0) — hour marks with date at midnight & noon
        {
          type: "time" as const,
          position: "bottom" as const,
          min: minTime,
          max: maxTime,
          minInterval: interval,
          maxInterval: interval,
          axisLabel: {
            color: "hsl(var(--muted-foreground))",
            fontSize: 12,
            formatter: (value: number) => {
              const date = new Date(value);
              const h = parseInt(hourNumFmt.format(date));
              const timeStr = hourFormatter.format(date);
              // Show M/D date at midnight (0) and noon (12) — max 2x per day
              if (h === 0 || h === 12) {
                const m = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: timezone });
                return `{date|${m}} {time|${timeStr}}`;
              }
              return `{time|${timeStr}}`;
            },
            rich: {
              date: { fontWeight: "bold" as const, fontSize: 11, lineHeight: 16, color: "hsl(var(--foreground))" },
              time: { fontSize: 12, lineHeight: 16 },
            },
          },
          splitLine: { show: false },
          axisLine: { show: true },
          axisTick: { show: true },
        },
        // Top axis (index 1) — day name labels
        {
          type: "time" as const,
          position: "top" as const,
          min: minTime,
          max: maxTime,
          axisLabel: {
            color: "hsl(var(--foreground))",
            fontSize: 12,
            fontWeight: "bold" as const,
            formatter: (value: number) => dayNameFmt.format(new Date(value)).toUpperCase(),
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          minInterval: 86400000,
          maxInterval: 86400000,
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
          handleSize: "80%",
          borderColor: "hsl(var(--border))",
          fillerColor: "hsla(var(--primary), 0.15)",
          textStyle: { color: "hsl(var(--muted-foreground))" },
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
  }, [timezone, minTime, maxTime, zoomRange, zoomLevel]);

  // ─── BODY OPTION (bars + y-axis, no visible xAxis) ───
  const bodyOption = useMemo(() => {
    const markLineData = midnightTimestamps.map((ts) => ({
      xAxis: ts,
      lineStyle: { type: "dashed" as const, color: "rgba(128,128,128,0.4)", width: 1 },
      label: { show: false },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "hsl(var(--popover))",
        borderColor: "hsl(var(--border))",
        textStyle: { color: "hsl(var(--popover-foreground))" },
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
          });
        },
      },
      grid: {
        left: 100,
        right: 20,
        top: 2,
        bottom: 2,
      },
      xAxis: {
        type: "time" as const,
        min: minTime,
        max: maxTime,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: {
          show: true,
          lineStyle: { color: "hsl(var(--border))", opacity: 0.3 },
        },
      },
      yAxis: {
        type: "category" as const,
        data: registrations,
        inverse: true,
        axisLabel: {
          color: "hsl(var(--foreground))",
          fontSize: 11,
          fontWeight: "bold" as const,
          formatter: (value: string) => {
            // Hide labels for break separator entries (rendered in chart area)
            if (value.startsWith(BREAK_PREFIX)) return "";
            return value;
          },
        },
        splitLine: {
          show: true,
          lineStyle: { color: "hsl(var(--border))", opacity: 0.3 },
        },
      },
      dataZoom: [
        {
          type: "inside" as const,
          xAxisIndex: 0,
          filterMode: "weakFilter" as const,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false,
          start: zoomRange.start,
          end: zoomRange.end,
        },
      ],
      series: [
        {
          type: "custom" as const,
          renderItem: renderFlightBar,
          encode: { x: [1, 2], y: 0 },
          data: chartData,
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            animation: false,
            data: markLineData,
          },
        },
      ],
    };
  }, [registrations, chartData, colorMap, allWps, renderFlightBar,
      midnightTimestamps, timezone, minTime, maxTime, zoomRange]);

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
        bodyInstance.dispatchAction({
          type: "dataZoom",
          start: dz.start,
          end: dz.end,
        });
      }
    }
    syncLock.current = false;
  }, []);

  // ─── Handle click on bar ───
  const handleClick = useCallback(
    (params: { data?: GanttDataItem }) => {
      if (!params.data || !onBarClick) return;
      const wpIdx = params.data[6];
      const wp = allWps[wpIdx];
      if (wp) onBarClick(wp);
    },
    [allWps, onBarClick]
  );

  // ─── Live NOW line — merge-update on body chart ───
  useEffect(() => {
    if (nowTimestamp === 0 || workPackages.length === 0) return;
    const instance = bodyChartRef.current?.getEchartsInstance();
    if (!instance) return;

    const nowInRange = nowTimestamp >= minTime && nowTimestamp <= maxTime;
    const markLineData = [
      ...midnightTimestamps.map((ts) => ({
        xAxis: ts,
        lineStyle: { type: "dashed" as const, color: "rgba(128,128,128,0.4)", width: 1 },
        label: { show: false },
      })),
      ...(nowInRange
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
        : []),
    ];

    instance.setOption({
      series: [{
        markLine: {
          silent: true,
          symbol: ["none", "none"],
          animation: false,
          data: markLineData,
        },
      }],
    });
  }, [nowTimestamp, midnightTimestamps, minTime, maxTime, workPackages.length]);

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

  const bodyHeight = Math.max(300, registrations.length * 36 + 20);

  return (
    <div
      className="flex flex-col"
      style={!isExpanded ? { maxHeight: "90vh" } : undefined}
    >
      {/* Time axis header — always visible (yellow zone) */}
      <div className="flex-shrink-0">
        <ReactEChartsCore
          ref={headerChartRef}
          echarts={echarts}
          option={headerOption}
          style={{ height: 120, width: "100%" }}
          theme="dark"
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
          theme="dark"
          notMerge
          onEvents={{ click: handleClick }}
        />
      </div>
    </div>
  );
});
