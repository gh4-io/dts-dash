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
import type { DailyCapacityV2, DailyDemandV2, DailyUtilizationV2, CapacityShift } from "@/types";

interface CapacityHeatmapProps {
  capacity: DailyCapacityV2[];
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  onCellClick?: (date: string, shiftCode: string | null) => void;
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

export function CapacityHeatmap({
  capacity,
  demand,
  utilization,
  shifts,
  onCellClick,
}: CapacityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [shifts],
  );

  // Build lookup maps
  const capMap = useMemo(() => new Map(capacity.map((c) => [c.date, c])), [capacity]);
  const demMap = useMemo(() => new Map(demand.map((d) => [d.date, d])), [demand]);
  const utilMap = useMemo(() => new Map(utilization.map((u) => [u.date, u])), [utilization]);

  // Sorted dates
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

      <div className="overflow-x-auto">
        <TooltipProvider delayDuration={200}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs w-[120px] sticky left-0 bg-card z-10">Date</TableHead>
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
