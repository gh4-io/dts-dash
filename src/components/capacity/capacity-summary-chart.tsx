"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
  RollingForecastResult,
} from "@/types";
import { useCustomers } from "@/lib/hooks/use-customers";

interface CapacitySummaryChartProps {
  capacity: DailyCapacityV2[];
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  activeLens: CapacityLensId;
  /** When true, fills parent container height instead of using a fixed 340px */
  fillHeight?: boolean;
  /** Rolling 8-week forecast overlay (E-01) */
  rollingForecast?: RollingForecastResult | null;
  /** Active scenario label badge (E-04) */
  activeScenarioLabel?: string;
}

type ViewMode = "byShift" | "byCustomer" | "total" | "gap";

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
  fillHeight = false,
  rollingForecast,
  activeScenarioLabel,
}: CapacitySummaryChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("byShift");
  const [showForecast, setShowForecast] = useState(false);
  const { getColor, fetch: fetchCustomers } = useCustomers();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const allCustomers = useMemo(() => {
    const names = new Set<string>();
    for (const day of demand) {
      for (const name of Object.keys(day.byCustomer)) {
        names.add(name);
      }
    }
    return Array.from(names).sort();
  }, [demand]);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  const lensLineConfig = activeLens !== "planned" ? LENS_LINE_CONFIG[activeLens] : null;

  // Last historical date for forecast boundary
  const lastHistoricalDate = useMemo(() => {
    if (utilization.length === 0) return null;
    return utilization[utilization.length - 1].date;
  }, [utilization]);

  const chartData = useMemo(() => {
    const capMap = new Map(capacity.map((c) => [c.date, c]));
    const demMap = new Map(demand.map((d) => [d.date, d]));
    const round1 = (n: number) => Math.round(n * 10) / 10;

    // Gap mode: diverging bars per shift
    if (viewMode === "gap") {
      return utilization.map((u) => {
        const label = formatDate(u.date);
        const row: Record<string, unknown> = {
          date: u.date,
          label,
          gapMH: round1(u.gapMH),
          aircraftCount: demMap.get(u.date)?.aircraftCount ?? 0,
        };
        for (const shift of activeShifts) {
          const su = u.byShift.find((s) => s.shiftCode === shift.code);
          row[`gap_${shift.code}`] = round1(su?.gapMH ?? 0);
        }
        return row;
      });
    }

    // Total mode: one row per day
    if (viewMode === "total") {
      const rows = utilization.map((u) => {
        const dem = demMap.get(u.date);
        const label = formatDate(u.date);

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

        return {
          date: u.date,
          label,
          demandMH: round1(u.totalDemandMH),
          capacityMH: round1(u.totalProductiveMH),
          utilization: u.utilizationPercent !== null ? round1(u.utilizationPercent) : null,
          aircraftCount: dem?.aircraftCount ?? 0,
          ...(lensOverlayMH != null ? { lensOverlayMH: round1(lensOverlayMH) } : {}),
        };
      });

      // Append forecast rows when toggle is on
      if (showForecast && rollingForecast?.forecastDays.length) {
        for (const fd of rollingForecast.forecastDays) {
          rows.push({
            date: fd.date,
            label: formatDate(fd.date),
            demandMH: undefined as unknown as number,
            capacityMH: undefined as unknown as number,
            utilization: null,
            aircraftCount: 0,
            forecastDemandMH: fd.forecastedDemandMH,
          } as Record<string, unknown> as (typeof rows)[number]);
        }
      }

      return rows;
    }

    // byShift / byCustomer: 1 row per day, per-shift fields
    const rows = utilization.map((u) => {
      const dem = demMap.get(u.date);
      const cap = capMap.get(u.date);
      const label = formatDate(u.date);

      const row: Record<string, unknown> = {
        date: u.date,
        label,
        aircraftCount: dem?.aircraftCount ?? 0,
      };

      for (const shift of activeShifts) {
        const su = u.byShift.find((s) => s.shiftCode === shift.code);
        const sd = dem?.byShift.find((s) => s.shiftCode === shift.code);
        const sc = cap?.byShift.find((s) => s.shiftCode === shift.code);

        // Capacity + utilization per shift (for lines)
        row[`capacity_${shift.code}`] = round1(sc?.productiveMH ?? 0);
        row[`utilization_${shift.code}`] = su?.utilization != null ? round1(su.utilization) : null;

        // Demand per shift (for bars)
        if (viewMode === "byCustomer") {
          const custMH: Record<string, number> = {};
          for (const wp of sd?.wpContributions ?? []) {
            custMH[wp.customer] = (custMH[wp.customer] ?? 0) + wp.allocatedMH;
          }
          for (const customer of allCustomers) {
            row[`demand_${shift.code}_${customer}`] = round1(custMH[customer] ?? 0);
          }
        } else {
          row[`demand_${shift.code}`] = round1(sd?.demandMH ?? 0);
        }

        // Lens overlay per shift
        if (lensLineConfig && sd) {
          let lensVal: number | null = null;
          switch (activeLens) {
            case "allocated":
              lensVal = sd.allocatedDemandMH ?? null;
              break;
            case "forecast":
              lensVal = sd.forecastedDemandMH ?? null;
              break;
            case "worked":
              lensVal = sd.workedMH ?? null;
              break;
            case "billed":
              lensVal = sd.billedMH ?? null;
              break;
          }
          if (lensVal != null) {
            row[`lensOverlay_${shift.code}`] = round1(lensVal);
          }
        }
      }

      return row;
    });

    // Append forecast rows when toggle is on (byShift mode)
    if (showForecast && viewMode === "byShift" && rollingForecast?.forecastDays.length) {
      for (const fd of rollingForecast.forecastDays) {
        const row: Record<string, unknown> = {
          date: fd.date,
          label: formatDate(fd.date),
          aircraftCount: 0,
        };
        for (const shift of activeShifts) {
          row[`forecastDemand_${shift.code}`] = round1(fd.forecastedByShift[shift.code] ?? 0);
        }
        rows.push(row);
      }
    }

    return rows;
  }, [
    demand,
    capacity,
    utilization,
    activeShifts,
    allCustomers,
    viewMode,
    activeLens,
    lensLineConfig,
    showForecast,
    rollingForecast,
  ]);

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
    <div
      className={`rounded-lg border border-border bg-card${fillHeight ? " flex flex-col h-full" : ""}`}
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-chart-bar" />
          {viewMode === "gap" ? "Surplus / Deficit" : "Demand vs Capacity"}
          {activeScenarioLabel && activeScenarioLabel !== "Baseline" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium normal-case tracking-normal">
              {activeScenarioLabel}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {/* 8W Forecast toggle */}
          {rollingForecast && rollingForecast.forecastDays.length > 0 && viewMode !== "gap" && (
            <button
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                showForecast
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setShowForecast(!showForecast)}
            >
              8W Forecast
            </button>
          )}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {(["byShift", "byCustomer", "total", "gap"] as const).map((mode) => (
              <button
                key={mode}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  viewMode === mode
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode === "byShift"
                  ? "By Shift"
                  : mode === "byCustomer"
                    ? "By Customer"
                    : mode === "gap"
                      ? "Gap"
                      : "Total"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`p-3${fillHeight ? " flex-1 min-h-0" : ""}`}>
        <ResponsiveContainer width="100%" height={fillHeight ? "100%" : 340}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval={0}
              height={30}
            />
            <YAxis
              yAxisId="mh"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: viewMode === "gap" ? "Gap (MH)" : "Man-Hours",
                angle: -90,
                position: "insideLeft",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
                offset: 10,
              }}
            />
            {viewMode !== "gap" && (
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
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--popover-foreground))",
                fontSize: 12,
              }}
              formatter={(value, name) => {
                if (typeof name === "string" && name.includes("Utilization"))
                  return [value !== null ? `${value}%` : "N/A", name];
                if (typeof name === "string" && name.includes("Forecast"))
                  return [`${value} MH`, name];
                if (viewMode === "gap") {
                  const v = value as number;
                  return [v >= 0 ? `+${v} MH` : `${v} MH`, name];
                }
                return [`${value} MH`, name];
              }}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                if (!item) return "";
                return `${item.label}${item.aircraftCount ? ` — ${item.aircraftCount} aircraft` : ""}`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

            {/* === GAP MODE === */}
            {viewMode === "gap" && (
              <>
                <ReferenceLine yAxisId="mh" y={0} stroke="#666" strokeDasharray="3 3" />
                {activeShifts.map((shift) => (
                  <Bar
                    key={`gap_${shift.code}`}
                    yAxisId="mh"
                    dataKey={`gap_${shift.code}`}
                    name={`${shift.name} Gap`}
                    fill={SHIFT_BAR_COLORS[shift.code] ?? "#6b7280"}
                    fillOpacity={0.8}
                    radius={[2, 2, 0, 0]}
                    barSize={14}
                  />
                ))}
              </>
            )}

            {/* === DEMAND BARS (non-gap modes) === */}

            {/* Total mode: 1 bar per day, colored by utilization */}
            {viewMode === "total" && (
              <Bar yAxisId="mh" dataKey="demandMH" name="Demand" radius={[2, 2, 0, 0]} barSize={20}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={getUtilizationColor(entry.utilization as number | null)}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            )}

            {/* By Shift: 3 grouped bars (one per shift), no stackId → side-by-side */}
            {viewMode === "byShift" &&
              activeShifts.map((shift) => (
                <Bar
                  key={shift.code}
                  yAxisId="mh"
                  dataKey={`demand_${shift.code}`}
                  name={`${shift.name} Demand`}
                  fill={SHIFT_BAR_COLORS[shift.code] ?? "#6b7280"}
                  fillOpacity={0.8}
                  radius={[2, 2, 0, 0]}
                  barSize={14}
                />
              ))}

            {/* By Customer: N×3 bars, stackId per shift → 3 groups stacked by customer */}
            {viewMode === "byCustomer" &&
              activeShifts.flatMap((shift, shiftIdx) =>
                allCustomers.map((customer) => (
                  <Bar
                    key={`${shift.code}_${customer}`}
                    yAxisId="mh"
                    dataKey={`demand_${shift.code}_${customer}`}
                    stackId={shift.code}
                    name={customer}
                    fill={getColor(customer)}
                    fillOpacity={0.8}
                    radius={[2, 2, 0, 0]}
                    barSize={14}
                    legendType={shiftIdx === 0 ? undefined : "none"}
                  />
                )),
              )}

            {/* === REFERENCE LINES (non-gap modes) === */}
            {viewMode !== "gap" && (
              <>
                <ReferenceLine
                  yAxisId="pct"
                  y={120}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: "CRITICAL", position: "right", fill: "#ef4444", fontSize: 10 }}
                />
                <ReferenceLine
                  yAxisId="pct"
                  y={100}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: "100%", position: "right", fill: "#f59e0b", fontSize: 10 }}
                />
              </>
            )}

            {/* === LINES (non-gap modes) === */}

            {/* Total mode: single capacity + utilization lines */}
            {viewMode === "total" && (
              <>
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
              </>
            )}

            {/* Per-shift modes: 3 capacity lines (dashed) + 3 utilization lines (solid) */}
            {viewMode !== "total" &&
              viewMode !== "gap" &&
              activeShifts.map((shift, i) => (
                <Fragment key={`lines_${shift.code}`}>
                  <Line
                    yAxisId="mh"
                    dataKey={`capacity_${shift.code}`}
                    name={i === 0 ? "Capacity" : `Capacity (${shift.name})`}
                    type="monotone"
                    stroke={SHIFT_BAR_COLORS[shift.code]}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    legendType={i === 0 ? undefined : "none"}
                  />
                  <Line
                    yAxisId="pct"
                    dataKey={`utilization_${shift.code}`}
                    name={i === 0 ? "Utilization" : `Utilization (${shift.name})`}
                    type="monotone"
                    stroke={SHIFT_BAR_COLORS[shift.code]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SHIFT_BAR_COLORS[shift.code], strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    connectNulls
                    legendType={i === 0 ? undefined : "none"}
                  />
                </Fragment>
              ))}

            {/* === FORECAST LINE (E-01) === */}

            {/* Total mode: single forecast line */}
            {showForecast && viewMode === "total" && (
              <>
                {lastHistoricalDate && (
                  <ReferenceLine
                    yAxisId="mh"
                    x={formatDate(lastHistoricalDate)}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}
                <Line
                  yAxisId="mh"
                  dataKey="forecastDemandMH"
                  name="Forecast (8-wk rolling)"
                  type="monotone"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }}
                  connectNulls={false}
                />
              </>
            )}

            {/* Per-shift mode: forecast lines per shift */}
            {showForecast && viewMode === "byShift" && (
              <>
                {lastHistoricalDate && (
                  <ReferenceLine
                    yAxisId="mh"
                    x={formatDate(lastHistoricalDate)}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}
                {activeShifts.map((shift, i) => (
                  <Line
                    key={`forecast_${shift.code}`}
                    yAxisId="mh"
                    dataKey={`forecastDemand_${shift.code}`}
                    name={i === 0 ? "Forecast (8-wk rolling)" : `Forecast (${shift.name})`}
                    type="monotone"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }}
                    connectNulls={false}
                    legendType={i === 0 ? undefined : "none"}
                  />
                ))}
              </>
            )}

            {/* === LENS OVERLAY === */}

            {/* Total mode: single lens line */}
            {viewMode === "total" && lensLineConfig && (
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

            {/* Per-shift modes: 3 lens overlay lines */}
            {viewMode !== "total" &&
              viewMode !== "gap" &&
              lensLineConfig &&
              activeShifts.map((shift, i) => (
                <Line
                  key={`lens_${shift.code}`}
                  yAxisId="mh"
                  dataKey={`lensOverlay_${shift.code}`}
                  name={i === 0 ? lensLineConfig.name : `${lensLineConfig.name} (${shift.name})`}
                  type="monotone"
                  stroke={lensLineConfig.stroke}
                  strokeWidth={2}
                  strokeDasharray={lensLineConfig.dash || undefined}
                  dot={{ r: 3, fill: lensLineConfig.stroke, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls
                  legendType={i === 0 ? undefined : "none"}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
