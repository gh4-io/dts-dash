"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WeeklyMatrixResult, WeeklyMatrixCell, StaffingShiftCategory } from "@/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const CATEGORY_COLORS: Record<StaffingShiftCategory, string> = {
  DAY: "text-amber-500",
  SWING: "text-orange-500",
  NIGHT: "text-indigo-400",
  OTHER: "text-muted-foreground",
};

const CATEGORY_BG: Record<StaffingShiftCategory, string> = {
  DAY: "bg-amber-500",
  SWING: "bg-orange-500",
  NIGHT: "bg-indigo-400",
  OTHER: "bg-muted-foreground",
};

const CATEGORY_LABELS: Record<StaffingShiftCategory, string> = {
  DAY: "Day",
  SWING: "Swing",
  NIGHT: "Night",
  OTHER: "Other",
};

const CATEGORIES: StaffingShiftCategory[] = ["DAY", "SWING", "NIGHT", "OTHER"];

function getHeatColor(value: number, max: number): string {
  if (value === 0 || max === 0) return "";
  const intensity = Math.min(value / max, 1);
  if (intensity > 0.75) return "bg-primary/25";
  if (intensity > 0.5) return "bg-primary/15";
  if (intensity > 0.25) return "bg-primary/8";
  return "bg-primary/4";
}

function fmtNum(n: number, decimals = 0): string {
  return n.toFixed(decimals);
}

function getMostRecentSunday(): string {
  const now = new Date();
  const d = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - d);
  return sunday.toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const s = new Date(weekStart + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const mo = s.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const moEnd = e.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (mo === moEnd) {
    return `${mo} ${s.getUTCDate()}–${e.getUTCDate()}, ${s.getUTCFullYear()}`;
  }
  return `${mo} ${s.getUTCDate()} – ${moEnd} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

interface WeeklyMatrixPanelProps {
  configId: number | null;
}

export function WeeklyMatrixPanel({ configId }: WeeklyMatrixPanelProps) {
  const [weekStart, setWeekStart] = useState(getMostRecentSunday);
  const [matrix, setMatrix] = useState<WeeklyMatrixResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"headcount" | "paid" | "productive">("headcount");

  const fetchMatrix = useCallback(async () => {
    if (!configId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/capacity/staffing-matrix?configId=${configId}&weekStart=${weekStart}`,
      );
      if (res.ok) {
        setMatrix(await res.json());
      } else {
        setMatrix(null);
      }
    } catch {
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  }, [configId, weekStart]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const prevWeek = () => setWeekStart((ws) => addDays(ws, -7));
  const nextWeek = () => setWeekStart((ws) => addDays(ws, 7));
  const today = () => setWeekStart(getMostRecentSunday());

  // Determine the value getter based on viewMode
  const getValue = (cell: WeeklyMatrixCell): number => {
    switch (viewMode) {
      case "paid":
        return cell.paidMH;
      case "productive":
        return cell.productiveMH;
      default:
        return cell.headcount;
    }
  };

  // Find max for heatmap coloring
  const maxVal = matrix
    ? Math.max(
        ...matrix.days.flatMap((d) => CATEGORIES.map((cat) => getValue(d.byCategory[cat]))),
        1,
      )
    : 1;

  // Stats
  const totalHeadcount = matrix?.totalConfigHeadcount ?? 0;
  const avgDailyHeadcount = matrix ? matrix.days.reduce((s, d) => s + d.total.headcount, 0) / 7 : 0;
  const peakDay = matrix
    ? matrix.days.reduce(
        (max, d) =>
          d.total.headcount > max.headcount
            ? { day: d.dayOfWeek, headcount: d.total.headcount }
            : max,
        { day: 0, headcount: 0 },
      )
    : null;
  const minDay = matrix
    ? matrix.days.reduce(
        (min, d) =>
          d.total.headcount < min.headcount
            ? { day: d.dayOfWeek, headcount: d.total.headcount }
            : min,
        { day: 0, headcount: Infinity },
      )
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Week navigation header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-calendar-week text-xs text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Weekly View
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={prevWeek}>
            <i className="fa-solid fa-chevron-left text-[10px]" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={today}>
            Today
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={nextWeek}>
            <i className="fa-solid fa-chevron-right text-[10px]" />
          </Button>
        </div>
      </div>

      {/* Week label */}
      <div className="px-3 py-1.5 text-xs text-center text-muted-foreground border-b border-border shrink-0">
        {formatWeekRange(weekStart)}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-4">
        {!configId ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <i className="fa-solid fa-table-cells text-2xl mb-2 opacity-30" />
            <p className="text-xs">Select a config to view the weekly matrix</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <i className="fa-solid fa-spinner fa-spin text-lg text-muted-foreground" />
          </div>
        ) : !matrix ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <i className="fa-solid fa-triangle-exclamation text-2xl mb-2 opacity-30" />
            <p className="text-xs">Unable to compute matrix</p>
            <p className="text-[10px] mt-1">Ensure capacity assumptions are configured</p>
          </div>
        ) : (
          <>
            {/* View mode toggle */}
            <div className="flex items-center gap-1 justify-center">
              {(["headcount", "paid", "productive"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? "default" : "ghost"}
                  size="sm"
                  className={`h-6 px-2.5 text-[10px] ${viewMode === mode ? "" : "text-muted-foreground"}`}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === "headcount" ? "HC" : mode === "paid" ? "Paid MH" : "Prod MH"}
                </Button>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-2 py-1.5 text-left text-[10px] text-muted-foreground font-medium w-16">
                      &nbsp;
                    </th>
                    {matrix.days.map((d) => (
                      <th
                        key={d.date}
                        className="px-1 py-1.5 text-center text-[10px] text-muted-foreground font-medium"
                      >
                        <div>{DAY_NAMES_SHORT[d.dayOfWeek]}</div>
                        <div className="text-[9px] font-normal">
                          {new Date(d.date + "T00:00:00Z").getUTCDate()}
                        </div>
                      </th>
                    ))}
                    <th className="px-1 py-1.5 text-center text-[10px] text-muted-foreground font-semibold border-l border-border">
                      Tot
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {CATEGORIES.map((cat) => {
                    const catTotal = matrix.categoryTotals[cat];
                    if (catTotal.headcount === 0 && catTotal.paidMH === 0) return null;

                    return (
                      <tr key={cat} className="hover:bg-accent/20 transition-colors">
                        <td className="px-2 py-1.5">
                          <span
                            className={`flex items-center gap-1 text-[10px] font-medium ${CATEGORY_COLORS[cat]}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${CATEGORY_BG[cat]} shrink-0`}
                            />
                            {CATEGORY_LABELS[cat]}
                          </span>
                        </td>
                        {matrix.days.map((d) => {
                          const cell = d.byCategory[cat];
                          const val = getValue(cell);
                          return (
                            <td
                              key={d.date}
                              className={`px-1 py-1.5 text-center tabular-nums font-medium ${getHeatColor(val, maxVal)}`}
                            >
                              {val === 0 ? (
                                <span className="text-muted-foreground/30">—</span>
                              ) : (
                                fmtNum(val, viewMode === "headcount" ? 0 : 1)
                              )}
                            </td>
                          );
                        })}
                        <td className="px-1 py-1.5 text-center tabular-nums font-semibold border-l border-border">
                          {fmtNum(getValue(catTotal), viewMode === "headcount" ? 0 : 1)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-2 py-1.5 text-[10px]">Total</td>
                    {matrix.days.map((d) => (
                      <td key={d.date} className="px-1 py-1.5 text-center tabular-nums">
                        {fmtNum(getValue(d.total), viewMode === "headcount" ? 0 : 1)}
                      </td>
                    ))}
                    <td className="px-1 py-1.5 text-center tabular-nums border-l border-border">
                      {fmtNum(getValue(matrix.grandTotal), viewMode === "headcount" ? 0 : 1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* MH Summary cards */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Weekly Totals
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Paid MH</div>
                  <div className="text-lg font-bold tabular-nums">
                    {fmtNum(matrix.grandTotal.paidMH, 1)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Available MH</div>
                  <div className="text-lg font-bold tabular-nums">
                    {fmtNum(matrix.grandTotal.availableMH, 1)}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-center">
                  <div className="text-[10px] text-emerald-500 mb-0.5">Productive MH</div>
                  <div className="text-lg font-bold tabular-nums text-emerald-500">
                    {fmtNum(matrix.grandTotal.productiveMH, 1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Key stats */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Key Stats
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-border bg-card p-2">
                  <div className="text-[10px] text-muted-foreground">Config Headcount</div>
                  <div className="text-sm font-bold tabular-nums">{totalHeadcount} AMTs</div>
                </div>
                <div className="rounded border border-border bg-card p-2">
                  <div className="text-[10px] text-muted-foreground">Avg Daily HC</div>
                  <div className="text-sm font-bold tabular-nums">
                    {fmtNum(avgDailyHeadcount, 1)}
                  </div>
                </div>
                <div className="rounded border border-border bg-card p-2">
                  <div className="text-[10px] text-muted-foreground">Peak Day</div>
                  <div className="text-sm font-bold tabular-nums">
                    {peakDay ? `${DAY_NAMES[peakDay.day]} (${peakDay.headcount})` : "—"}
                  </div>
                </div>
                <div className="rounded border border-border bg-card p-2">
                  <div className="text-[10px] text-muted-foreground">Min Day</div>
                  <div className="text-sm font-bold tabular-nums">
                    {minDay && minDay.headcount < Infinity
                      ? `${DAY_NAMES[minDay.day]} (${minDay.headcount})`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Per-category MH breakdown */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Category Breakdown
              </h4>
              <div className="space-y-1">
                {CATEGORIES.map((cat) => {
                  const ct = matrix.categoryTotals[cat];
                  if (ct.headcount === 0 && ct.paidMH === 0) return null;
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-2 rounded border border-border bg-card px-2.5 py-1.5"
                    >
                      <span className={`w-2 h-2 rounded-full ${CATEGORY_BG[cat]} shrink-0`} />
                      <span className={`text-xs font-medium w-12 ${CATEGORY_COLORS[cat]}`}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <div className="flex-1 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground tabular-nums">
                        <span>
                          <span className="text-foreground font-medium">
                            {fmtNum(ct.paidMH, 1)}
                          </span>{" "}
                          paid
                        </span>
                        <span>
                          <span className="text-foreground font-medium">
                            {fmtNum(ct.availableMH, 1)}
                          </span>{" "}
                          avail
                        </span>
                        <span>
                          <span className="text-foreground font-medium">
                            {fmtNum(ct.productiveMH, 1)}
                          </span>{" "}
                          prod
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coverage warnings */}
            {matrix.days.some((d) =>
              CATEGORIES.slice(0, 3).some((cat) => d.byCategory[cat].headcount === 0),
            ) && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 mb-1">
                  <i className="fa-solid fa-triangle-exclamation" />
                  Coverage Gaps
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  {matrix.days.map((d) =>
                    CATEGORIES.slice(0, 3).map((cat) =>
                      d.byCategory[cat].headcount === 0 ? (
                        <div key={`${d.date}-${cat}`}>
                          {DAY_NAMES[d.dayOfWeek]}: No {CATEGORY_LABELS[cat].toLowerCase()} coverage
                        </div>
                      ) : null,
                    ),
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
