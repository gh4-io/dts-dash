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
import { aggregateMonthlyRollup } from "@/lib/capacity/monthly-rollup-engine";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useChartSeriesVisibility } from "@/lib/hooks/use-chart-series-visibility";
import { shiftHex, shiftHexSoft, shiftDotShape } from "@/lib/utils/shift-colors";
import { ChartLegend, type LegendRow } from "@/components/shared/chart-legend";
import {
  SERIES_KEY,
  shiftKey,
  customerKey,
  CAPACITY_LINE,
  UTILIZATION_LINE,
  shiftDotRenderer,
  buildCapacityLegendRows,
} from "./chart-series-style";

// ─── Types ────────────────────────────────────────────────────────────────

interface MonthlyRollupChartProps {
  demand: DailyDemandV2[];
  capacity: DailyCapacityV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  activeLens: CapacityLensId;
  secondaryLens?: CapacityLensId | null;
  fillHeight?: boolean;
  activeScenarioLabel?: string;
}

type ViewMode = "byShift" | "byCustomer" | "total" | "gap";

// ─── Constants ────────────────────────────────────────────────────────────

function getUtilizationColor(percent: number | null): string {
  if (percent === null) return "#6b7280";
  if (percent > 120) return "#ef4444";
  if (percent > 100) return "#f59e0b";
  if (percent > 80) return "#3b82f6";
  return "#22c55e";
}

const LENS_LINE_CONFIG: Record<string, { stroke: string; dash: string; name: string }> = {
  allocated: { stroke: "#a855f7", dash: "6 3", name: "Allocated" },
  forecast: { stroke: "#14b8a6", dash: "3 3", name: "Forecast" },
  worked: { stroke: "#22c55e", dash: "", name: "Worked" },
  billed: { stroke: "#6366f1", dash: "", name: "Billed" },
};

const SECONDARY_LINE_STYLE = {
  strokeWidth: 1.5,
  strokeDasharray: "8 4",
  opacity: 0.6,
  dotRadius: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function getLensOverlayFromBucket(
  lens: CapacityLensId,
  bucket: {
    totalAllocatedMH: number | null;
    totalForecastedMH: number | null;
    totalWorkedMH: number | null;
    totalBilledMH: number | null;
  },
): number | null {
  switch (lens) {
    case "allocated":
      return bucket.totalAllocatedMH;
    case "forecast":
      return bucket.totalForecastedMH;
    case "worked":
      return bucket.totalWorkedMH;
    case "billed":
      return bucket.totalBilledMH;
    default:
      return null;
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ─── Component ────────────────────────────────────────────────────────────

export function MonthlyRollupChart({
  demand,
  capacity,
  utilization,
  shifts,
  activeLens,
  secondaryLens,
  fillHeight = false,
  activeScenarioLabel,
}: MonthlyRollupChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const { getColor, fetch: fetchCustomers } = useCustomers();
  // Legend visibility — reset when the drawn series change (view mode switch)
  const { isHidden, toggle } = useChartSeriesVisibility(viewMode);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Compute monthly rollup
  const rollup = useMemo(
    () => aggregateMonthlyRollup(demand, capacity, utilization),
    [demand, capacity, utilization],
  );

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  // Unique customer names across all months
  const allCustomers = useMemo(() => {
    const names = new Set<string>();
    for (const bucket of rollup.buckets) {
      for (const name of Object.keys(bucket.byCustomer)) {
        names.add(name);
      }
    }
    return Array.from(names).sort();
  }, [rollup]);

  const lensLineConfig = activeLens !== "planned" ? LENS_LINE_CONFIG[activeLens] : null;

  const secondaryLineConfig =
    secondaryLens && secondaryLens !== activeLens
      ? (LENS_LINE_CONFIG[secondaryLens] ?? null)
      : null;

  // Legend rows — entities (shift/customer) above, series roles below
  const legendRows = useMemo<LegendRow[]>(
    () =>
      buildCapacityLegendRows({
        viewMode,
        activeShifts,
        allCustomers,
        getCustomerColor: getColor,
        isHidden,
        lens: lensLineConfig,
        secondary: secondaryLineConfig,
      }),
    [viewMode, activeShifts, allCustomers, getColor, isHidden, lensLineConfig, secondaryLineConfig],
  );

  // Transform buckets into Recharts data
  const chartData = useMemo(() => {
    // Gap mode: diverging bars per shift
    if (viewMode === "gap") {
      return rollup.buckets.map((b) => {
        const row: Record<string, unknown> = {
          label: b.label,
          dayCount: b.dayCount,
          gapMH: round1(b.totalGapMH),
          aircraftCount: b.totalAircraftCount,
        };
        for (const sb of b.byShift) {
          row[`gap_${sb.shiftCode}`] = round1(sb.totalGapMH);
        }
        return row;
      });
    }

    // Total mode: one bar per month
    if (viewMode === "total") {
      return rollup.buckets.map((b) => {
        const lensOverlayMH = lensLineConfig ? getLensOverlayFromBucket(activeLens, b) : null;
        const secondaryOverlayMH =
          secondaryLineConfig && secondaryLens ? getLensOverlayFromBucket(secondaryLens, b) : null;

        return {
          label: b.label,
          dayCount: b.dayCount,
          demandMH: round1(b.totalDemandMH),
          capacityMH: round1(b.totalCapacityMH),
          utilization: b.avgUtilizationPercent,
          aircraftCount: b.totalAircraftCount,
          ...(lensOverlayMH != null ? { lensOverlayMH: round1(lensOverlayMH) } : {}),
          ...(secondaryOverlayMH != null ? { secondaryOverlayMH: round1(secondaryOverlayMH) } : {}),
        };
      });
    }

    // byShift / byCustomer: per-shift fields
    return rollup.buckets.map((b) => {
      const row: Record<string, unknown> = {
        label: b.label,
        dayCount: b.dayCount,
        aircraftCount: b.totalAircraftCount,
      };

      for (const sb of b.byShift) {
        row[`capacity_${sb.shiftCode}`] = round1(sb.totalCapacityMH);
        row[`utilization_${sb.shiftCode}`] = sb.avgUtilization;

        if (viewMode === "byCustomer") {
          for (const customer of allCustomers) {
            row[`demand_${sb.shiftCode}_${customer}`] = round1(sb.byCustomer[customer] ?? 0);
          }
        } else {
          row[`demand_${sb.shiftCode}`] = round1(sb.totalDemandMH);
        }

        // Lens overlay per shift
        if (lensLineConfig) {
          const lensVal = getLensOverlayFromBucket(activeLens, sb);
          if (lensVal != null) {
            row[`lensOverlay_${sb.shiftCode}`] = round1(lensVal);
          }
        }

        // Secondary lens overlay per shift
        if (secondaryLineConfig && secondaryLens) {
          const secVal = getLensOverlayFromBucket(secondaryLens, sb);
          if (secVal != null) {
            row[`secondaryOverlay_${sb.shiftCode}`] = round1(secVal);
          }
        }
      }

      return row;
    });
  }, [
    rollup,
    viewMode,
    activeLens,
    lensLineConfig,
    secondaryLens,
    secondaryLineConfig,
    allCustomers,
  ]);

  if (rollup.buckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <i className="fa-solid fa-calendar text-3xl mb-2 block" />
          <p className="text-sm">No monthly data available</p>
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
          <i className="fa-solid fa-calendar" />
          {viewMode === "gap" ? "Monthly Surplus / Deficit" : "Monthly Roll-Up"}
          {activeScenarioLabel && activeScenarioLabel !== "Baseline" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium normal-case tracking-normal">
              {activeScenarioLabel}
            </span>
          )}
        </h3>
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

      <div className={`p-3 flex flex-col${fillHeight ? " flex-1 min-h-0" : ""}`}>
        <div className={fillHeight ? "flex-1 min-h-0" : ""}>
          <ResponsiveContainer
            width="100%"
            height={fillHeight ? "100%" : 340}
            minWidth={0}
            minHeight={0}
          >
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />

              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
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
                  if (viewMode === "gap") {
                    const v = value as number;
                    return [v >= 0 ? `+${v} MH` : `${v} MH`, name];
                  }
                  return [`${value} MH`, name];
                }}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload;
                  if (!item) return "";
                  return `${item.label} (${item.dayCount}d)${item.aircraftCount ? ` — ${item.aircraftCount} aircraft` : ""}`;
                }}
              />

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
                      fill={shiftHex(shift.code)}
                      fillOpacity={0.8}
                      radius={[2, 2, 0, 0]}
                      barSize={20}
                      hide={isHidden(shiftKey(shift.code), SERIES_KEY.gap)}
                    />
                  ))}
                </>
              )}

              {/* === DEMAND BARS (non-gap modes) === */}

              {/* Total mode: 1 bar per month, colored by utilization */}
              {viewMode === "total" && (
                <Bar
                  yAxisId="mh"
                  dataKey="demandMH"
                  name="Demand"
                  radius={[2, 2, 0, 0]}
                  barSize={30}
                  hide={isHidden(SERIES_KEY.demand)}
                >
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={getUtilizationColor(entry.utilization as number | null)}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              )}

              {/* By Shift: grouped bars (one per shift) */}
              {viewMode === "byShift" &&
                activeShifts.map((shift) => (
                  <Bar
                    key={shift.code}
                    yAxisId="mh"
                    dataKey={`demand_${shift.code}`}
                    name={`${shift.name} Demand`}
                    fill={shiftHex(shift.code)}
                    fillOpacity={0.8}
                    radius={[2, 2, 0, 0]}
                    barSize={20}
                    hide={isHidden(shiftKey(shift.code), SERIES_KEY.demand)}
                  />
                ))}

              {/* By Customer: N×3 bars, stackId per shift */}
              {viewMode === "byCustomer" &&
                activeShifts.flatMap((shift) =>
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
                      barSize={20}
                      legendType="none"
                      hide={isHidden(customerKey(customer), SERIES_KEY.demand)}
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
                    strokeWidth={CAPACITY_LINE.strokeWidth}
                    strokeDasharray={CAPACITY_LINE.strokeDasharray}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    hide={isHidden(SERIES_KEY.capacity)}
                  />
                  <Line
                    yAxisId="pct"
                    dataKey="utilization"
                    name="Utilization"
                    type="monotone"
                    stroke="#f97316"
                    strokeWidth={UTILIZATION_LINE.strokeWidth}
                    dot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                    hide={isHidden(SERIES_KEY.utilization)}
                  />
                </>
              )}

              {/* Per-shift modes: capacity + utilization lines per shift */}
              {viewMode !== "total" &&
                viewMode !== "gap" &&
                activeShifts.map((shift) => (
                  <Fragment key={`lines_${shift.code}`}>
                    <Line
                      yAxisId="mh"
                      dataKey={`capacity_${shift.code}`}
                      name={`Capacity (${shift.name})`}
                      type="monotone"
                      stroke={shiftHex(shift.code)}
                      strokeWidth={CAPACITY_LINE.strokeWidth}
                      strokeDasharray={CAPACITY_LINE.strokeDasharray}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      legendType="none"
                      hide={isHidden(shiftKey(shift.code), SERIES_KEY.capacity)}
                    />
                    <Line
                      yAxisId="pct"
                      dataKey={`utilization_${shift.code}`}
                      name={`Utilization (${shift.name})`}
                      type="monotone"
                      stroke={shiftHexSoft(shift.code)}
                      strokeWidth={UTILIZATION_LINE.strokeWidth}
                      dot={shiftDotRenderer(shiftDotShape(shift.code), shiftHexSoft(shift.code), 4)}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      connectNulls
                      legendType="none"
                      hide={isHidden(shiftKey(shift.code), SERIES_KEY.utilization)}
                    />
                  </Fragment>
                ))}

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
                  dot={{ r: 4, fill: lensLineConfig.stroke, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                  hide={isHidden(SERIES_KEY.lens)}
                />
              )}

              {/* Per-shift modes: lens overlay lines per shift */}
              {viewMode !== "total" &&
                viewMode !== "gap" &&
                lensLineConfig &&
                activeShifts.map((shift) => (
                  <Line
                    key={`lens_${shift.code}`}
                    yAxisId="mh"
                    dataKey={`lensOverlay_${shift.code}`}
                    name={`${lensLineConfig.name} (${shift.name})`}
                    type="monotone"
                    stroke={lensLineConfig.stroke}
                    strokeWidth={2}
                    strokeDasharray={lensLineConfig.dash || undefined}
                    dot={{ r: 4, fill: lensLineConfig.stroke, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                    legendType="none"
                    hide={isHidden(shiftKey(shift.code), SERIES_KEY.lens)}
                  />
                ))}

              {/* === SECONDARY LENS OVERLAY (G-07) === */}

              {/* Total mode: single secondary comparison line */}
              {viewMode === "total" && secondaryLineConfig && (
                <Line
                  yAxisId="mh"
                  dataKey="secondaryOverlayMH"
                  name={`${secondaryLineConfig.name} (compare)`}
                  type="monotone"
                  stroke={secondaryLineConfig.stroke}
                  strokeWidth={SECONDARY_LINE_STYLE.strokeWidth}
                  strokeDasharray={SECONDARY_LINE_STYLE.strokeDasharray}
                  strokeOpacity={SECONDARY_LINE_STYLE.opacity}
                  dot={{
                    r: SECONDARY_LINE_STYLE.dotRadius,
                    fill: secondaryLineConfig.stroke,
                    strokeWidth: 0,
                    opacity: SECONDARY_LINE_STYLE.opacity,
                  }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                  hide={isHidden(SERIES_KEY.secondary)}
                />
              )}

              {/* Per-shift modes: secondary comparison lines per shift */}
              {viewMode !== "total" &&
                viewMode !== "gap" &&
                secondaryLineConfig &&
                activeShifts.map((shift) => (
                  <Line
                    key={`secondary_${shift.code}`}
                    yAxisId="mh"
                    dataKey={`secondaryOverlay_${shift.code}`}
                    name={`${secondaryLineConfig.name} (${shift.name}, compare)`}
                    type="monotone"
                    stroke={secondaryLineConfig.stroke}
                    strokeWidth={SECONDARY_LINE_STYLE.strokeWidth}
                    strokeDasharray={SECONDARY_LINE_STYLE.strokeDasharray}
                    strokeOpacity={SECONDARY_LINE_STYLE.opacity}
                    dot={{
                      r: SECONDARY_LINE_STYLE.dotRadius,
                      fill: secondaryLineConfig.stroke,
                      strokeWidth: 0,
                      opacity: SECONDARY_LINE_STYLE.opacity,
                    }}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                    legendType="none"
                    hide={isHidden(shiftKey(shift.code), SERIES_KEY.secondary)}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ChartLegend rows={legendRows} onToggle={toggle} />
      </div>
    </div>
  );
}
