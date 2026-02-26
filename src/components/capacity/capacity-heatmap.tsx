"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  DailyCapacityV2,
  DailyDemandV2,
  DailyUtilizationV2,
  CapacityShift,
  CapacityLensId,
  MonthlyRollupResult,
} from "@/types";
import type { ForecastPatternResult } from "@/lib/capacity/forecast-pattern-engine";

interface CapacityHeatmapProps {
  capacity: DailyCapacityV2[];
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  activeLens: CapacityLensId;
  onCellClick?: (date: string, shiftCode: string | null) => void;
  viewAggregation?: "daily" | "weekly-pattern" | "monthly";
  patternResult?: ForecastPatternResult | null;
  monthlyRollup?: MonthlyRollupResult | null;
}

/** Shift display config */
const SHIFT_ICONS: Record<string, string> = {
  DAY: "fa-sun",
  SWING: "fa-cloud-sun",
  NIGHT: "fa-moon",
};

const SHIFT_COLORS: Record<string, string> = {
  DAY: "text-amber-400",
  SWING: "text-orange-400",
  NIGHT: "text-indigo-400",
};

/** Get background color class for utilization percentage */
function getUtilCellClasses(util: number | null, noCoverage: boolean): string {
  if (noCoverage || util === null) {
    return "bg-muted/50 text-muted-foreground";
  }
  if (util > 120) return "bg-red-500/20 text-red-400 font-semibold";
  if (util > 100) return "bg-amber-500/20 text-amber-400 font-medium";
  if (util > 80) return "bg-blue-500/15 text-blue-400";
  return "bg-emerald-500/15 text-emerald-400";
}

/** Get the ring/border accent for hovered cells */
function getUtilRingClass(util: number | null, noCoverage: boolean): string {
  if (noCoverage || util === null) return "ring-muted-foreground/30";
  if (util > 120) return "ring-red-500/50";
  if (util > 100) return "ring-amber-500/50";
  if (util > 80) return "ring-blue-500/40";
  return "ring-emerald-500/40";
}

function formatDate(dateStr: string): { day: string; weekday: string; isWeekend: boolean } {
  const d = new Date(dateStr + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay();
  return {
    day: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
    weekday: d.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    }),
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

const LENS_TOOLTIP_CONFIG: Record<string, { label: string; color: string }> = {
  allocated: { label: "Allocated", color: "text-amber-400" },
  forecast: { label: "Forecast", color: "text-teal-400" },
  worked: { label: "Worked", color: "text-green-400" },
  billed: { label: "Billed", color: "text-indigo-400" },
  concurrent: { label: "Peak", color: "text-purple-400" },
  events: { label: "Events", color: "text-sky-400" },
};

function getLensShiftValue(
  lens: CapacityLensId,
  shiftDem:
    | {
        demandMH: number;
        allocatedDemandMH?: number;
        forecastedDemandMH?: number;
        workedMH?: number;
        billedMH?: number;
        peakConcurrency?: number;
        avgConcurrency?: number;
      }
    | undefined,
): string | null {
  if (!shiftDem) return null;
  switch (lens) {
    case "allocated":
      return shiftDem.allocatedDemandMH != null
        ? `${shiftDem.allocatedDemandMH.toFixed(1)} MH`
        : null;
    case "forecast":
      return shiftDem.forecastedDemandMH != null
        ? `${shiftDem.forecastedDemandMH.toFixed(1)} MH`
        : null;
    case "worked":
      return shiftDem.workedMH != null ? `${shiftDem.workedMH.toFixed(1)} MH` : null;
    case "billed":
      return shiftDem.billedMH != null ? `${shiftDem.billedMH.toFixed(1)} MH` : null;
    case "concurrent":
      return shiftDem.peakConcurrency != null ? `${shiftDem.peakConcurrency} aircraft` : null;
    default:
      return null;
  }
}

function getLensDailyValue(lens: CapacityLensId, dem: DailyDemandV2 | undefined): string | null {
  if (!dem) return null;
  switch (lens) {
    case "allocated":
      return dem.totalAllocatedDemandMH != null
        ? `${dem.totalAllocatedDemandMH.toFixed(1)} MH`
        : null;
    case "forecast":
      return dem.totalForecastedDemandMH != null
        ? `${dem.totalForecastedDemandMH.toFixed(1)} MH`
        : null;
    case "worked":
      return dem.totalWorkedMH != null ? `${dem.totalWorkedMH.toFixed(1)} MH` : null;
    case "billed":
      return dem.totalBilledMH != null ? `${dem.totalBilledMH.toFixed(1)} MH` : null;
    case "concurrent":
      return dem.peakConcurrency != null ? `${dem.peakConcurrency} aircraft` : null;
    default:
      return null;
  }
}

export function CapacityHeatmap({
  capacity,
  demand,
  utilization,
  shifts,
  activeLens,
  onCellClick,
  viewAggregation = "daily",
  patternResult,
  monthlyRollup,
}: CapacityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  // Build lookup maps (always — hooks cannot be conditional)
  const capMap = useMemo(() => new Map(capacity.map((c) => [c.date, c])), [capacity]);
  const demMap = useMemo(() => new Map(demand.map((d) => [d.date, d])), [demand]);
  const utilMap = useMemo(() => new Map(utilization.map((u) => [u.date, u])), [utilization]);

  const dates = useMemo(() => {
    const allDates = new Set([...capMap.keys(), ...utilMap.keys()]);
    return Array.from(allDates).sort();
  }, [capMap, utilMap]);

  const handleCellClick = useCallback(
    (date: string, shiftCode: string | null) => {
      onCellClick?.(date, shiftCode);
    },
    [onCellClick],
  );

  const lensConfig = activeLens !== "planned" ? LENS_TOOLTIP_CONFIG[activeLens] : null;

  // ─── Weekly Pattern Heatmap ───────────────────────────────────────────
  if (viewAggregation === "weekly-pattern" && patternResult) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <i className="fa-solid fa-table-cells" />
            Weekly Pattern Heatmap
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {patternResult.totalWeeks} weeks averaged
          </span>
        </div>
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-[140px]">Day</TableHead>
                  {activeShifts.map((shift) => (
                    <TableHead key={shift.code} className="text-xs text-center min-w-[100px]">
                      <span className="flex items-center justify-center gap-1.5">
                        <i
                          className={`fa-solid ${SHIFT_ICONS[shift.code] ?? "fa-clock"} text-[10px] ${SHIFT_COLORS[shift.code] ?? ""}`}
                        />
                        {shift.name}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-center min-w-[100px] border-l border-border">
                    <span className="flex items-center justify-center gap-1.5">
                      <i className="fa-solid fa-sigma text-[10px] text-muted-foreground" />
                      Total
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patternResult.pattern.map((p) => {
                  const isWeekend = p.dayOfWeek >= 6;
                  const totalUtil =
                    p.avgCapacityMH > 0 ? (p.avgDemandMH / p.avgCapacityMH) * 100 : null;

                  return (
                    <TableRow
                      key={p.dayOfWeek}
                      className={`hover:bg-transparent ${isWeekend ? "bg-muted/20" : ""}`}
                    >
                      <TableCell className="py-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium ${isWeekend ? "text-amber-400" : ""}`}
                          >
                            {p.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({p.sampleCount} samples)
                          </span>
                        </div>
                      </TableCell>

                      {activeShifts.map((shift) => {
                        const demMH = p.avgDemandByShift[shift.code] ?? 0;
                        const capMH = p.avgCapacityByShift[shift.code] ?? 0;
                        const util = capMH > 0 ? (demMH / capMH) * 100 : null;
                        const noCoverage = capMH === 0 && demMH === 0;

                        return (
                          <TableCell key={shift.code} className="py-1 px-1 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`rounded-md px-2 py-1.5 text-xs tabular-nums ${getUtilCellClasses(util, noCoverage)}`}
                                >
                                  {noCoverage ? (
                                    <span className="flex items-center justify-center gap-1 text-[10px]">
                                      <i className="fa-solid fa-ban text-[8px]" />
                                      N/C
                                    </span>
                                  ) : util !== null ? (
                                    `${util.toFixed(0)}%`
                                  ) : (
                                    "—"
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px]">
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {shift.name} — {p.label}
                                  </div>
                                  <div>Avg Demand: {demMH.toFixed(1)} MH</div>
                                  <div>Avg Capacity: {capMH.toFixed(1)} MH</div>
                                  <div>Avg Gap: {(capMH - demMH).toFixed(1)} MH</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        );
                      })}

                      <TableCell className="py-1 px-1 text-center border-l border-border">
                        <div
                          className={`rounded-md px-2 py-1.5 text-xs tabular-nums font-medium ${getUtilCellClasses(totalUtil, false)}`}
                        >
                          {totalUtil !== null ? `${totalUtil.toFixed(0)}%` : "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  // ─── Monthly Heatmap ──────────────────────────────────────────────────
  if (viewAggregation === "monthly" && monthlyRollup) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <i className="fa-solid fa-table-cells" />
            Monthly Utilization Heatmap
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {monthlyRollup.totalMonths} months
          </span>
        </div>
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={200}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-[140px]">Month</TableHead>
                  {activeShifts.map((shift) => (
                    <TableHead key={shift.code} className="text-xs text-center min-w-[100px]">
                      <span className="flex items-center justify-center gap-1.5">
                        <i
                          className={`fa-solid ${SHIFT_ICONS[shift.code] ?? "fa-clock"} text-[10px] ${SHIFT_COLORS[shift.code] ?? ""}`}
                        />
                        {shift.name}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-center min-w-[100px] border-l border-border">
                    <span className="flex items-center justify-center gap-1.5">
                      <i className="fa-solid fa-sigma text-[10px] text-muted-foreground" />
                      Total
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRollup.buckets.map((bucket) => (
                  <TableRow key={bucket.monthKey} className="hover:bg-transparent">
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{bucket.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({bucket.dayCount} days)
                        </span>
                      </div>
                    </TableCell>

                    {activeShifts.map((shift) => {
                      const shiftBucket = bucket.byShift.find((s) => s.shiftCode === shift.code);
                      const util = shiftBucket?.avgUtilization ?? null;
                      const noCoverage =
                        (shiftBucket?.totalCapacityMH ?? 0) === 0 &&
                        (shiftBucket?.totalDemandMH ?? 0) === 0;

                      return (
                        <TableCell key={shift.code} className="py-1 px-1 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`rounded-md px-2 py-1.5 text-xs tabular-nums ${getUtilCellClasses(util, noCoverage)}`}
                              >
                                {noCoverage ? (
                                  <span className="flex items-center justify-center gap-1 text-[10px]">
                                    <i className="fa-solid fa-ban text-[8px]" />
                                    N/C
                                  </span>
                                ) : util !== null ? (
                                  `${util.toFixed(0)}%`
                                ) : (
                                  "—"
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {shift.name} — {bucket.label}
                                </div>
                                <div>Demand: {(shiftBucket?.totalDemandMH ?? 0).toFixed(1)} MH</div>
                                <div>
                                  Capacity: {(shiftBucket?.totalCapacityMH ?? 0).toFixed(1)} MH
                                </div>
                                <div>Gap: {(shiftBucket?.totalGapMH ?? 0).toFixed(1)} MH</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      );
                    })}

                    <TableCell className="py-1 px-1 text-center border-l border-border">
                      <div
                        className={`rounded-md px-2 py-1.5 text-xs tabular-nums font-medium ${getUtilCellClasses(bucket.avgUtilizationPercent ?? null, false)}`}
                      >
                        {bucket.avgUtilizationPercent !== null
                          ? `${bucket.avgUtilizationPercent.toFixed(0)}%`
                          : "—"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-table-cells text-3xl mb-2 block" />
        <p className="text-sm">No capacity data for the selected date range</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-table-cells" />
          Shift Utilization Heatmap
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/30" />
            &lt;80%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500/30" />
            80-100%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/30" />
            100-120%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/30" />
            &gt;120%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted border border-border" />
            No Coverage
          </span>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[340px]">
        <TooltipProvider delayDuration={200}>
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs w-[120px] sticky left-0 bg-card z-30">Date</TableHead>
                {activeShifts.map((shift) => (
                  <TableHead key={shift.code} className="text-xs text-center min-w-[100px]">
                    <span className="flex items-center justify-center gap-1.5">
                      <i
                        className={`fa-solid ${SHIFT_ICONS[shift.code] ?? "fa-clock"} text-[10px] ${SHIFT_COLORS[shift.code] ?? ""}`}
                      />
                      {shift.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {String(shift.startHour).padStart(2, "0")}-
                      {String(shift.endHour).padStart(2, "0")}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-xs text-center min-w-[100px] border-l border-border">
                  <span className="flex items-center justify-center gap-1.5">
                    <i className="fa-solid fa-sigma text-[10px] text-muted-foreground" />
                    Total
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {dates.map((date) => {
                const cap = capMap.get(date);
                const dem = demMap.get(date);
                const util = utilMap.get(date);
                const { day, weekday, isWeekend } = formatDate(date);

                return (
                  <TableRow
                    key={date}
                    className={`hover:bg-transparent ${isWeekend ? "bg-muted/20" : ""}`}
                  >
                    {/* Date cell — sticky on horizontal scroll */}
                    <TableCell className="py-1.5 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] w-7 ${isWeekend ? "text-amber-400 font-medium" : "text-muted-foreground"}`}
                        >
                          {weekday}
                        </span>
                        <span className="text-xs font-medium tabular-nums">{day}</span>
                        {cap?.hasExceptions && (
                          <i
                            className="fa-solid fa-asterisk text-[8px] text-amber-400"
                            title="Has headcount exceptions"
                          />
                        )}
                      </div>
                    </TableCell>

                    {/* Per-shift cells */}
                    {activeShifts.map((shift) => {
                      const shiftUtil = util?.byShift.find((s) => s.shiftCode === shift.code);
                      const shiftCap = cap?.byShift.find((s) => s.shiftCode === shift.code);
                      const shiftDem = dem?.byShift.find((s) => s.shiftCode === shift.code);

                      const utilPct = shiftUtil?.utilization ?? null;
                      const noCoverage = shiftUtil?.noCoverage ?? false;
                      const belowMin = shiftCap?.belowMinHeadcount ?? false;
                      const cellKey = `${date}:${shift.code}`;
                      const isHovered = hoveredCell === cellKey;

                      const lensValue =
                        lensConfig && shiftDem ? getLensShiftValue(activeLens, shiftDem) : null;

                      return (
                        <TableCell key={shift.code} className="py-1 px-1 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={`
                                  w-full rounded-md px-2 py-1.5 text-xs tabular-nums
                                  transition-all duration-150 cursor-pointer
                                  ${getUtilCellClasses(utilPct, noCoverage)}
                                  ${isHovered ? `ring-1 ${getUtilRingClass(utilPct, noCoverage)} scale-[1.02]` : ""}
                                  hover:ring-1 hover:${getUtilRingClass(utilPct, noCoverage)} hover:scale-[1.02]
                                `}
                                onClick={() => handleCellClick(date, shift.code)}
                                onMouseEnter={() => setHoveredCell(cellKey)}
                                onMouseLeave={() => setHoveredCell(null)}
                              >
                                {noCoverage ? (
                                  <span className="flex items-center justify-center gap-1 text-[10px]">
                                    <i className="fa-solid fa-ban text-[8px]" />
                                    N/C
                                  </span>
                                ) : utilPct !== null ? (
                                  <span className="flex items-center justify-center gap-1">
                                    {belowMin && (
                                      <i className="fa-solid fa-triangle-exclamation text-[8px] text-amber-400" />
                                    )}
                                    {utilPct.toFixed(0)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {shift.name} — {day}
                                </div>
                                {noCoverage ? (
                                  <div className="text-muted-foreground">
                                    No productive capacity (0 heads)
                                  </div>
                                ) : (
                                  <>
                                    <div>Demand: {(shiftDem?.demandMH ?? 0).toFixed(1)} MH</div>
                                    <div>
                                      Capacity: {(shiftCap?.productiveMH ?? 0).toFixed(1)} MH
                                    </div>
                                    <div>
                                      Heads: {shiftCap?.effectiveHeadcount ?? 0}
                                      {belowMin && (
                                        <span className="text-amber-400 ml-1">(below min)</span>
                                      )}
                                    </div>
                                    <div>Gap: {(shiftUtil?.gapMH ?? 0).toFixed(1)} MH</div>
                                    {lensValue && lensConfig && (
                                      <div className={lensConfig.color}>
                                        {lensConfig.label}: {lensValue}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      );
                    })}

                    {/* Total column */}
                    <TableCell className="py-1 px-1 text-center border-l border-border">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`
                              w-full rounded-md px-2 py-1.5 text-xs tabular-nums font-medium
                              transition-all duration-150 cursor-pointer
                              ${getUtilCellClasses(util?.utilizationPercent ?? null, false)}
                              hover:ring-1 hover:${getUtilRingClass(util?.utilizationPercent ?? null, false)} hover:scale-[1.02]
                            `}
                            onClick={() => handleCellClick(date, null)}
                            onMouseEnter={() => setHoveredCell(`${date}:TOTAL`)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {util?.utilizationPercent !== null &&
                            util?.utilizationPercent !== undefined ? (
                              <span className="flex items-center justify-center gap-1">
                                {util.criticalFlag && (
                                  <i className="fa-solid fa-triangle-exclamation text-[8px]" />
                                )}
                                {util.utilizationPercent.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                          <div className="space-y-1">
                            <div className="font-medium">Daily Total — {day}</div>
                            <div>Demand: {(util?.totalDemandMH ?? 0).toFixed(1)} MH</div>
                            <div>Capacity: {(util?.totalProductiveMH ?? 0).toFixed(1)} MH</div>
                            <div>Gap: {(util?.gapMH ?? 0).toFixed(1)} MH</div>
                            <div>Aircraft: {dem?.aircraftCount ?? 0}</div>
                            {(() => {
                              const dailyLensValue = lensConfig
                                ? getLensDailyValue(activeLens, dem)
                                : null;
                              return dailyLensValue && lensConfig ? (
                                <div className={lensConfig.color}>
                                  {lensConfig.label}: {dailyLensValue}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    </div>
  );
}
