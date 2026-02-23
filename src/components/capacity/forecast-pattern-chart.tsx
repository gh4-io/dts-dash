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
} from "recharts";
import type {
  DailyCapacityV2,
  DailyDemandV2,
  CapacityShift,
  CapacityLensId,
  WeeklyProjection,
  ProjectionDayOverlay,
} from "@/types";
// Direct import — NOT barrel (D-047: barrel re-exports server-only modules)
import { computeDayOfWeekPattern } from "@/lib/capacity/forecast-pattern-engine";
import { buildProjectionOverlay, hasProjectionData } from "@/lib/capacity/projection-engine";
import { useCustomers } from "@/lib/hooks/use-customers";

type ViewMode = "byShift" | "byCustomer" | "total";

interface ForecastPatternChartProps {
  demand: DailyDemandV2[];
  capacity: DailyCapacityV2[];
  shifts: CapacityShift[];
  activeLens: CapacityLensId;
  /** When true, fills parent container height instead of using a fixed 340px */
  fillHeight?: boolean;
}

const SHIFT_BAR_COLORS: Record<string, string> = {
  DAY: "#f59e0b",
  SWING: "#f97316",
  NIGHT: "#6366f1",
};

// Lens overlay line config (only MH-compatible lenses)
const LENS_LINE_CONFIG: Record<string, { stroke: string; dash: string; name: string }> = {
  forecast: { stroke: "#14b8a6", dash: "3 3", name: "Avg Forecast" },
  allocated: { stroke: "#f59e0b", dash: "6 3", name: "Avg Allocated" },
};

const PROJECTION_COLOR = "#ec4899"; // pink-500
const PROJECTION_DASH = "4 2";

export function ForecastPatternChart({
  demand,
  capacity,
  shifts,
  activeLens,
  fillHeight = false,
}: ForecastPatternChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("byShift");
  const [showProjections, setShowProjections] = useState(false);
  const [projectionOverlay, setProjectionOverlay] = useState<ProjectionDayOverlay[] | null>(null);
  const { getColor, fetch: fetchCustomers } = useCustomers();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Fetch projection data once on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/capacity/weekly-projections")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: WeeklyProjection[]) => {
        if (cancelled) return;
        const overlay = buildProjectionOverlay(data);
        if (hasProjectionData(overlay)) {
          setProjectionOverlay(overlay);
        }
      })
      .catch(() => {
        // Silently ignore — projections are optional
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  const patternResult = useMemo(
    () => computeDayOfWeekPattern(demand, capacity),
    [demand, capacity],
  );

  const lensLineConfig = LENS_LINE_CONFIG[activeLens] ?? null;

  const allCustomers = useMemo(() => {
    const names = new Set<string>();
    for (const p of patternResult.pattern) {
      for (const shiftCustomers of Object.values(p.avgDemandByCustomerByShift)) {
        for (const name of Object.keys(shiftCustomers)) {
          names.add(name);
        }
      }
    }
    return Array.from(names).sort();
  }, [patternResult]);

  const chartData = useMemo(() => {
    // Total mode: 7 rows (Mon–Sun), day-level
    if (viewMode === "total") {
      return patternResult.pattern.map((p, idx) => {
        const row: Record<string, unknown> = {
          label: p.label,
          dayOfWeek: p.dayOfWeek,
          avgDemandMH: p.avgDemandMH,
          avgCapacityMH: p.avgCapacityMH,
          sampleCount: p.sampleCount,
        };

        // Lens overlay (total level)
        if (lensLineConfig) {
          if (activeLens === "forecast" && p.avgForecastedMH !== null) {
            row.lensOverlayMH = p.avgForecastedMH;
          } else if (activeLens === "allocated") {
            const totalAllocated = Object.values(p.avgAllocatedByShift).reduce((s, v) => s + v, 0);
            if (totalAllocated > 0) {
              row.lensOverlayMH = Math.round(totalAllocated * 10) / 10;
            }
          }
        }

        // Projection overlay (total level)
        if (showProjections && projectionOverlay) {
          const pDay = projectionOverlay[idx];
          if (pDay && pDay.projectedTotal > 0) {
            row.projectedTotal = pDay.projectedTotal;
          }
        }

        return row;
      });
    }

    // byShift / byCustomer: 1 row per day-of-week, per-shift fields
    return patternResult.pattern.map((p, idx) => {
      const row: Record<string, unknown> = {
        label: p.label,
        dayOfWeek: p.dayOfWeek,
        sampleCount: p.sampleCount,
      };

      for (const shift of activeShifts) {
        // Capacity per shift (for lines)
        row[`capacity_${shift.code}`] = p.avgCapacityByShift[shift.code] ?? 0;

        // Demand per shift (for bars)
        if (viewMode === "byCustomer") {
          const custForShift = p.avgDemandByCustomerByShift[shift.code] ?? {};
          for (const customer of allCustomers) {
            row[`demand_${shift.code}_${customer}`] = custForShift[customer] ?? 0;
          }
        } else {
          row[`demand_${shift.code}`] = p.avgDemandByShift[shift.code] ?? 0;
        }

        // Lens overlay per shift
        if (lensLineConfig) {
          if (activeLens === "forecast") {
            const val = p.avgForecastedByShift[shift.code];
            if (val != null) row[`lensOverlay_${shift.code}`] = val;
          } else if (activeLens === "allocated") {
            const val = p.avgAllocatedByShift[shift.code];
            if (val != null) row[`lensOverlay_${shift.code}`] = val;
          }
        }

        // Projection overlay per shift
        if (showProjections && projectionOverlay) {
          const pDay = projectionOverlay[idx];
          if (pDay) {
            const val = pDay.projectedByShift[shift.code];
            if (val != null && val > 0) {
              row[`projected_${shift.code}`] = val;
            }
          }
        }
      }

      return row;
    });
  }, [
    patternResult,
    activeShifts,
    allCustomers,
    viewMode,
    activeLens,
    lensLineConfig,
    showProjections,
    projectionOverlay,
  ]);

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
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Based on {patternResult.totalWeeks} week{patternResult.totalWeeks !== 1 ? "s" : ""} of
            data
          </span>
          {projectionOverlay && (
            <button
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                showProjections
                  ? "bg-pink-500/15 border-pink-500/40 text-pink-400"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-pink-500/30"
              }`}
              onClick={() => setShowProjections((v) => !v)}
              title="Toggle customer MH projections overlay"
            >
              <i className="fa-solid fa-bullseye text-[9px]" />
              Projected
            </button>
          )}
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
              interval={0}
              height={30}
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

            {/* === DEMAND BARS === */}

            {/* Total mode: 1 bar per day-of-week */}
            {viewMode === "total" && (
              <Bar
                yAxisId="mh"
                dataKey="avgDemandMH"
                name="Avg Demand"
                fill="#3b82f6"
                fillOpacity={0.8}
                radius={[2, 2, 0, 0]}
                barSize={20}
              />
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

            {/* === LINES === */}

            {/* Total mode: single capacity line */}
            {viewMode === "total" && (
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
            )}

            {/* Per-shift modes: 3 capacity lines (dashed, shift-colored) */}
            {viewMode !== "total" &&
              activeShifts.map((shift, i) => (
                <Fragment key={`cap_${shift.code}`}>
                  <Line
                    yAxisId="mh"
                    dataKey={`capacity_${shift.code}`}
                    name={i === 0 ? "Avg Capacity" : `Avg Capacity (${shift.name})`}
                    type="monotone"
                    stroke={SHIFT_BAR_COLORS[shift.code]}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    legendType={i === 0 ? undefined : "none"}
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
                dot={{ r: 3, fill: lensLineConfig.stroke, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls
              />
            )}

            {/* Per-shift modes: 3 lens overlay lines */}
            {viewMode !== "total" &&
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

            {/* === PROJECTION OVERLAY (TEMPORARY — OI-067) === */}

            {/* Total mode: single projected line */}
            {showProjections && viewMode === "total" && (
              <Line
                yAxisId="mh"
                dataKey="projectedTotal"
                name="Projected"
                type="monotone"
                stroke={PROJECTION_COLOR}
                strokeWidth={2}
                strokeDasharray={PROJECTION_DASH}
                dot={{ r: 3, fill: PROJECTION_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls
              />
            )}

            {/* Per-shift modes: 3 projected lines */}
            {showProjections &&
              viewMode !== "total" &&
              activeShifts.map((shift, i) => (
                <Line
                  key={`proj_${shift.code}`}
                  yAxisId="mh"
                  dataKey={`projected_${shift.code}`}
                  name={i === 0 ? "Projected" : `Projected (${shift.name})`}
                  type="monotone"
                  stroke={PROJECTION_COLOR}
                  strokeWidth={2}
                  strokeDasharray={PROJECTION_DASH}
                  dot={{ r: 3, fill: PROJECTION_COLOR, strokeWidth: 0 }}
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
