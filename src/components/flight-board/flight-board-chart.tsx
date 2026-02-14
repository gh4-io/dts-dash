"use client";

import { useMemo, useCallback, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { CustomChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useCustomers } from "@/lib/hooks/use-customers";
import { formatFlightTooltip } from "./flight-tooltip";
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
  CanvasRenderer,
]);

interface FlightBoardChartProps {
  workPackages: SerializedWorkPackage[];
  zoomLevel: string;
  onBarClick?: (wp: SerializedWorkPackage) => void;
}

// Data array format: [regIndex, arrivalTs, departureTs, customer, registration, flightId, ...meta]
type GanttDataItem = [
  number, // 0: regIndex (Y category)
  number, // 1: arrival timestamp
  number, // 2: departure timestamp
  string, // 3: customer name
  string, // 4: registration
  string | null, // 5: flightId
  number, // 6: original index in workPackages
];

export function FlightBoardChart({ workPackages, zoomLevel, onBarClick }: FlightBoardChartProps) {
  const chartRef = useRef<ReactEChartsCore>(null);
  const { getColor } = useCustomers();

  // Compute chart data
  const { registrations, chartData, colorMap, allWps } = useMemo(() => {
    if (workPackages.length === 0) {
      return { registrations: [] as string[], chartData: [] as GanttDataItem[], colorMap: {} as Record<string, string>, allWps: workPackages };
    }

    // Sort WPs by earliest arrival to determine registration order
    const sorted = [...workPackages].sort(
      (a, b) => new Date(a.arrival).getTime() - new Date(b.arrival).getTime()
    );

    // Unique registrations ordered by earliest arrival
    const regSet = new Set<string>();
    sorted.forEach((wp) => regSet.add(wp.aircraftReg));
    const regs = Array.from(regSet);

    // Customer→color map
    const colors: Record<string, string> = {};
    workPackages.forEach((wp) => {
      if (!colors[wp.customer]) {
        colors[wp.customer] = getColor(wp.customer);
      }
    });

    // Build data array
    const data: GanttDataItem[] = workPackages.map((wp, idx) => [
      regs.indexOf(wp.aircraftReg),
      new Date(wp.arrival).getTime(),
      new Date(wp.departure).getTime(),
      wp.customer,
      wp.aircraftReg,
      wp.flightId,
      idx,
    ]);

    return { registrations: regs, chartData: data, colorMap: colors, allWps: workPackages };
  }, [workPackages, getColor]);

  // Zoom range for the dataZoom
  const zoomRange = useMemo(() => {
    if (workPackages.length === 0) return { start: 0, end: 100 };

    const allTimes = workPackages.flatMap((wp) => [
      new Date(wp.arrival).getTime(),
      new Date(wp.departure).getTime(),
    ]);
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const totalMs = maxTime - minTime || 86400000;

    const zoomHours: Record<string, number> = {
      "6h": 6,
      "12h": 12,
      "1d": 24,
      "3d": 72,
      "1w": 168,
    };

    const hours = zoomHours[zoomLevel] ?? 72;
    const rangeMs = hours * 3600000;
    const endPercent = Math.min(100, (rangeMs / totalMs) * 100);

    return { start: 0, end: endPercent };
  }, [workPackages, zoomLevel]);

  // renderItem for custom flight bars
  const renderFlightBar = useCallback(
    (params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
      const regIndex = api.value(0) as number;
      const arrivalTs = api.value(1) as number;
      const departureTs = api.value(2) as number;
      const customer = api.value(3) as string;
      const registration = api.value(4) as string;
      const flightId = api.value(5) as string | null;

      const arrival = api.coord([arrivalTs, regIndex]);
      const departure = api.coord([departureTs, regIndex]);
      if (!arrival || !departure) return;

      const sizeArr = api.size?.([0, 1]) as number[] | undefined;
      const barHeight = sizeArr ? sizeArr[1] * 0.6 : 20;
      const color = colorMap[customer] ?? "#6b7280";

      const coordSys = (params as unknown as { coordSys?: { x: number; y: number; width: number; height: number } }).coordSys;
      if (!coordSys) return;

      // Clip rectangle
      const x = Math.max(arrival[0], coordSys.x);
      const w = Math.min(departure[0], coordSys.x + coordSys.width) - x;
      if (w <= 0) return;

      const y = arrival[1] - barHeight / 2;
      const centerY = y + barHeight / 2;

      const children: RenderGroup[] = [
        {
          type: "rect",
          shape: { x, y, width: w, height: barHeight, r: 3 },
          style: { fill: color },
        } as RenderGroup,
      ];

      // Format times as HH:MM
      const fmtTime = (ts: number) => {
        const d = new Date(ts);
        return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
      };

      if (w > 150) {
        // WIDE: arrival + registration · flightId + departure
        const centerLabel = flightId ? `${registration}  ·  ${flightId}` : registration;
        children.push(
          { type: "text", style: { text: fmtTime(arrivalTs), x: x + 4, y: centerY, fill: "rgba(255,255,255,0.85)", fontSize: 9, verticalAlign: "middle" } } as RenderGroup,
          { type: "text", style: { text: centerLabel, x: x + w / 2, y: centerY, fill: "#fff", fontSize: 10, fontWeight: "bold", align: "center", verticalAlign: "middle" } } as RenderGroup,
          { type: "text", style: { text: fmtTime(departureTs), x: x + w - 4, y: centerY, fill: "rgba(255,255,255,0.85)", fontSize: 9, align: "right", verticalAlign: "middle" } } as RenderGroup,
        );
      } else if (w > 100) {
        // MEDIUM: registration + flightId
        const label = flightId ? `${registration} · ${flightId}` : registration;
        children.push(
          { type: "text", style: { text: label, x: x + w / 2, y: centerY, fill: "#fff", fontSize: 10, fontWeight: "bold", align: "center", verticalAlign: "middle" } } as RenderGroup,
        );
      } else if (w > 50) {
        // NARROW: registration only
        children.push(
          { type: "text", style: { text: registration, x: x + w / 2, y: centerY, fill: "#fff", fontSize: 9, align: "center", verticalAlign: "middle" } } as RenderGroup,
        );
      }

      return { type: "group", children } as RenderGroup;
    },
    [colorMap]
  );

  // ECharts option
  const option = useMemo(
    () => ({
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
          });
        },
      },
      grid: {
        left: 100,
        right: 20,
        top: 30,
        bottom: 60,
      },
      xAxis: {
        type: "time" as const,
        axisLabel: {
          color: "hsl(var(--muted-foreground))",
          fontSize: 10,
        },
        splitLine: {
          show: true,
          lineStyle: { color: "hsl(var(--border))", opacity: 0.5 },
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
        },
        splitLine: {
          show: true,
          lineStyle: { color: "hsl(var(--border))", opacity: 0.3 },
        },
      },
      dataZoom: [
        {
          type: "slider" as const,
          xAxisIndex: 0,
          filterMode: "weakFilter" as const,
          height: 20,
          bottom: 5,
          start: zoomRange.start,
          end: zoomRange.end,
          handleSize: "80%",
          borderColor: "hsl(var(--border))",
          fillerColor: "hsla(var(--primary), 0.15)",
          textStyle: { color: "hsl(var(--muted-foreground))" },
        },
        {
          type: "inside" as const,
          xAxisIndex: 0,
          filterMode: "weakFilter" as const,
        },
      ],
      series: [
        {
          type: "custom" as const,
          renderItem: renderFlightBar,
          encode: { x: [1, 2], y: 0 },
          data: chartData,
        },
      ],
    }),
    [registrations, chartData, colorMap, allWps, zoomRange, renderFlightBar]
  );

  // Handle click on bar
  const handleClick = useCallback(
    (params: { data?: GanttDataItem }) => {
      if (!params.data || !onBarClick) return;
      const wpIdx = params.data[6];
      const wp = allWps[wpIdx];
      if (wp) onBarClick(wp);
    },
    [allWps, onBarClick]
  );

  if (workPackages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <i className="fa-solid fa-plane-slash text-4xl mb-4" />
        <p className="text-lg font-medium">No aircraft match</p>
        <p className="text-sm">Adjust your filters to see flight data.</p>
      </div>
    );
  }

  const chartHeight = Math.max(400, registrations.length * 36 + 100);

  return (
    <ReactEChartsCore
      ref={chartRef}
      echarts={echarts}
      option={option}
      style={{ height: chartHeight, width: "100%" }}
      theme="dark"
      notMerge
      onEvents={{ click: handleClick }}
    />
  );
}
