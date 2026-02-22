"use client";

import { useState } from "react";
import Link from "next/link";
import { useCapacityV2 } from "@/lib/hooks/use-capacity-v2";
import { useFilters } from "@/lib/hooks/use-filters";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DailyCapacityV2,
  DailyDemandV2,
  DailyUtilizationV2,
  CapacityShift,
  CapacityAssumptions,
  CapacityComputeMode,
  ResolvedShiftInfo,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtNum(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function utilColor(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  if (v > 120) return "text-red-400";
  if (v > 100) return "text-orange-400";
  if (v >= 80) return "text-yellow-400";
  return "text-emerald-400";
}

function shiftIcon(code: string): string {
  switch (code.toUpperCase()) {
    case "DAY":
      return "fa-sun";
    case "SWING":
      return "fa-cloud-sun";
    case "NIGHT":
      return "fa-moon";
    default:
      return "fa-clock";
  }
}

// ─── Pipeline Stage Config ────────────────────────────────────────────────────

interface PipelineStage {
  label: string;
  icon: string;
  count: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DevBanner({ start, end }: { start: string; end: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
      <i className="fa-solid fa-bug text-amber-400 text-lg" />
      <div>
        <p className="text-sm font-semibold text-amber-400">
          Capacity Model Dev Overview — Admin Only
        </p>
        <p className="text-xs text-muted-foreground">
          {fmtDate(start.slice(0, 10))} — {fmtDate(end.slice(0, 10))}
        </p>
      </div>
    </div>
  );
}

function PipelineStatusBar({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Pipeline Status
      </h2>
      <div className="flex flex-wrap gap-3">
        {stages.map((s) => {
          const active = s.count > 0;
          return (
            <div
              key={s.label}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              <i className={`fa-solid ${s.icon}`} />
              <span>{s.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? "bg-emerald-500/20" : "bg-muted"
                }`}
              >
                {active ? s.count : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComputeModeBanner({
  computeMode,
  activeStaffingConfigName,
}: {
  computeMode: CapacityComputeMode;
  activeStaffingConfigName: string | null;
}) {
  const isStaffing = computeMode === "staffing";
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
        isStaffing ? "border-sky-500/30 bg-sky-500/10" : "border-border bg-muted/30"
      }`}
    >
      <i
        className={`fa-solid ${isStaffing ? "fa-users-gear text-sky-400" : "fa-calculator text-muted-foreground"} text-lg`}
      />
      <div>
        <p
          className={`text-sm font-semibold ${isStaffing ? "text-sky-400" : "text-muted-foreground"}`}
        >
          {isStaffing ? "Staffing Mode" : "Headcount Plan Mode"}
          {isStaffing && activeStaffingConfigName && (
            <span className="ml-2 font-normal text-xs text-muted-foreground">
              — {activeStaffingConfigName}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {isStaffing
            ? "Capacity computed from rotation-based staffing shifts with dynamic paid hours"
            : "Capacity computed from static headcount plans and shift definitions"}
        </p>
      </div>
    </div>
  );
}

function ModelConfigSection({
  assumptions,
  shifts,
  resolvedShifts,
  computeMode,
}: {
  assumptions: CapacityAssumptions | null;
  shifts: CapacityShift[];
  resolvedShifts: ResolvedShiftInfo[];
  computeMode: CapacityComputeMode;
}) {
  const isStaffing = computeMode === "staffing";
  const activeShifts = shifts.filter((s) => s.isActive);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Assumptions */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <i className="fa-solid fa-sliders mr-1.5" />
          Assumptions
        </h2>
        {assumptions ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Attendance Rate</dt>
            <dd className="font-mono text-foreground">
              {(assumptions.paidToAvailable * 100).toFixed(0)}%
            </dd>
            <dt className="text-muted-foreground">Available → Productive</dt>
            <dd className="font-mono text-foreground">
              {(assumptions.availableToProductive * 100).toFixed(0)}%
            </dd>
            <dt className="text-muted-foreground">Night Productivity</dt>
            <dd className="font-mono text-foreground">
              {(assumptions.nightProductivityFactor * 100).toFixed(0)}%
            </dd>
            <dt className="text-muted-foreground">Demand Curve</dt>
            <dd className="font-mono text-foreground">{assumptions.demandCurve}</dd>
            <dt className="text-muted-foreground">Arrival Weight</dt>
            <dd className="font-mono text-foreground">{assumptions.arrivalWeight}</dd>
            <dt className="text-muted-foreground">Departure Weight</dt>
            <dd className="font-mono text-foreground">{assumptions.departureWeight}</dd>
            <dt className="text-muted-foreground">Default MH (no WP)</dt>
            <dd className="font-mono text-foreground">{assumptions.defaultMhNoWp}</dd>
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">No assumptions loaded</p>
        )}
      </div>

      {/* Resolved Shifts */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <i className={`fa-solid ${isStaffing ? "fa-users-gear" : "fa-clock"} mr-1.5`} />
          {isStaffing ? "Staffing Shifts" : "Capacity Shifts"}
          <span className="ml-2 text-[10px] font-normal normal-case">
            ({resolvedShifts.length > 0 ? resolvedShifts.length : activeShifts.length} active)
          </span>
        </h2>
        {resolvedShifts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Eff. Hours</TableHead>
                <TableHead className="text-xs">Window</TableHead>
                {isStaffing && <TableHead className="text-xs">Break/Lunch</TableHead>}
                {isStaffing && <TableHead className="text-xs">HC</TableHead>}
                {!isStaffing && <TableHead className="text-xs">Min HC</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolvedShifts.map((rs, i) => (
                <TableRow key={`${rs.code}-${i}`}>
                  <TableCell className="text-xs font-medium">
                    <i className={`fa-solid ${shiftIcon(rs.code)} mr-1.5 text-muted-foreground`} />
                    {rs.name}
                    {rs.mhOverride !== null && (
                      <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">
                        override
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {rs.mhOverride !== null ? (
                      <span className="text-blue-400">{rs.mhOverride}h (MH)</span>
                    ) : (
                      `${rs.effectivePaidHours.toFixed(1)}h`
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {String(rs.startHour).padStart(2, "0")}:
                    {String(rs.startMinute).padStart(2, "0")}–{String(rs.endHour).padStart(2, "0")}:
                    {String(rs.endMinute).padStart(2, "0")}
                  </TableCell>
                  {isStaffing && (
                    <TableCell className="text-xs font-mono">
                      {rs.breakMinutes > 0 || rs.lunchMinutes > 0
                        ? `${rs.breakMinutes}m / ${rs.lunchMinutes}m`
                        : "—"}
                    </TableCell>
                  )}
                  {isStaffing && (
                    <TableCell className="text-xs font-mono">{rs.headcount}</TableCell>
                  )}
                  {!isStaffing && (
                    <TableCell className="text-xs font-mono">
                      {activeShifts.find((s) => s.code === rs.code)?.minHeadcount ?? "—"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : activeShifts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Hours</TableHead>
                <TableHead className="text-xs">Window</TableHead>
                <TableHead className="text-xs">Min HC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeShifts
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs font-medium">
                      <i className={`fa-solid ${shiftIcon(s.code)} mr-1.5 text-muted-foreground`} />
                      {s.name}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.paidHours}h</TableCell>
                    <TableCell className="text-xs font-mono">
                      {String(s.startHour).padStart(2, "0")}:00–
                      {String(s.endHour).padStart(2, "0")}:00
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.minHeadcount}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted-foreground">No active shifts</p>
        )}
      </div>
    </div>
  );
}

function FormulaTrace({
  assumptions,
  shifts,
  resolvedShifts,
}: {
  assumptions: CapacityAssumptions | null;
  shifts: CapacityShift[];
  resolvedShifts: ResolvedShiftInfo[];
}) {
  if (!assumptions) return null;

  const {
    paidToAvailable: p2a,
    availableToProductive: a2p,
    nightProductivityFactor: nf,
  } = assumptions;

  // Use resolved shifts if available, otherwise fall back to static capacity shifts
  const traceShifts: {
    code: string;
    name: string;
    paidHours: number;
    mhOverride: number | null;
  }[] =
    resolvedShifts.length > 0
      ? resolvedShifts.map((rs) => ({
          code: rs.code,
          name: rs.name,
          paidHours: rs.effectivePaidHours,
          mhOverride: rs.mhOverride,
        }))
      : shifts
          .filter((s) => s.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            code: s.code,
            name: s.name,
            paidHours: s.paidHours,
            mhOverride: null,
          }));

  if (traceShifts.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <i className="fa-solid fa-calculator mr-1.5" />
        Productive MH Formula Trace
      </h2>
      <p className="text-xs text-muted-foreground font-mono">
        effHeads = roster × {p2a.toFixed(2)} (attendance) | MH/person = paidHours ×
        availableToProductive [× nightFactor]
      </p>
      <div className="space-y-1.5">
        {traceShifts.map((s, i) => {
          const isNight = s.code.toUpperCase() === "NIGHT";
          const factor = isNight ? nf : 1.0;
          const mhPerPerson = s.paidHours * a2p * factor;
          return (
            <div key={`${s.code}-${i}`} className="flex items-center gap-2 text-xs font-mono">
              <i
                className={`fa-solid ${shiftIcon(s.code)} w-4 text-center text-muted-foreground`}
              />
              <span className="w-20 text-muted-foreground truncate" title={s.name}>
                {s.name}:
              </span>
              <span>
                {s.paidHours.toFixed(1)} × {a2p.toFixed(2)} ×{" "}
                <span className={isNight ? "text-indigo-400 font-semibold" : ""}>
                  {factor.toFixed(2)}
                </span>
              </span>
              <span className="text-muted-foreground">=</span>
              <span className="text-emerald-400 font-semibold">
                {mhPerPerson.toFixed(2)} MH/person
              </span>
              {s.mhOverride !== null && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400">
                  override
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyTable({
  capacity,
  demand,
  utilization,
  shifts,
  selectedDate,
  onSelectDate,
}: {
  capacity: DailyCapacityV2[];
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const activeShifts = shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  if (capacity.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <i className="fa-solid fa-inbox text-3xl text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          No data — adjust the date range using the filters above.
        </p>
      </div>
    );
  }

  // Build date lookup maps
  const demandByDate = new Map(demand.map((d) => [d.date, d]));
  const utilByDate = new Map(utilization.map((u) => [u.date, u]));

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">
        <i className="fa-solid fa-table mr-1.5" />
        Daily Numbers
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Date</th>
              {activeShifts.map((s) => (
                <th
                  key={s.code}
                  colSpan={2}
                  className="px-3 py-2 text-center font-semibold text-muted-foreground border-l border-border/50"
                >
                  <i className={`fa-solid ${shiftIcon(s.code)} mr-1`} />
                  {s.code}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-l border-border/50">
                Total Cap
              </th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Demand</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Util%</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Gap MH</th>
              <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Flags</th>
              <th className="px-3 py-2 text-right font-semibold text-muted-foreground">WPs</th>
            </tr>
            {/* Sub-header for shift columns */}
            <tr className="border-b border-border bg-muted/20">
              <th />
              {activeShifts.map((s) => (
                <th
                  key={`${s.code}-sub`}
                  colSpan={2}
                  className="px-3 py-1 text-center text-[10px] text-muted-foreground border-l border-border/50"
                >
                  <span className="mr-3">HC</span>
                  <span>Cap MH</span>
                </th>
              ))}
              <th colSpan={5} />
              <th />
            </tr>
          </thead>
          <tbody>
            {capacity.map((cap) => {
              const dem = demandByDate.get(cap.date);
              const ut = utilByDate.get(cap.date);
              const isSelected = selectedDate === cap.date;
              const wpCount = dem
                ? dem.byShift.reduce((sum, s) => sum + s.wpContributions.length, 0)
                : 0;

              return (
                <tr
                  key={cap.date}
                  onClick={() => onSelectDate(isSelected ? null : cap.date)}
                  className={`border-b border-border/50 cursor-pointer hover:bg-accent/20 transition-colors ${
                    isSelected ? "ring-2 ring-amber-500/50 bg-amber-500/5" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{fmtDate(cap.date)}</td>
                  {activeShifts.map((s) => {
                    const sc = cap.byShift.find((bs) => bs.shiftCode === s.code);
                    return (
                      <td
                        key={s.code}
                        colSpan={2}
                        className="px-3 py-2 text-center font-mono border-l border-border/50"
                      >
                        <span
                          className={sc?.belowMinHeadcount ? "text-amber-400" : ""}
                          title={sc ? `Roster: ${sc.rosterHeadcount}` : undefined}
                        >
                          {sc ? fmtNum(sc.effectiveHeadcount) : "—"}
                        </span>
                        <span className="mx-2 text-muted-foreground">/</span>
                        <span>{sc ? fmtNum(sc.productiveMH) : "—"}</span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono border-l border-border/50">
                    {fmtNum(cap.totalProductiveMH)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {dem ? fmtNum(dem.totalDemandMH) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono font-semibold ${utilColor(ut?.utilizationPercent)}`}
                  >
                    {fmtPct(ut?.utilizationPercent)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{ut ? fmtNum(ut.gapMH) : "—"}</td>
                  <td className="px-3 py-2 text-center space-x-1">
                    {ut?.overtimeFlag && (
                      <i className="fa-solid fa-bolt text-amber-400" title="Overtime" />
                    )}
                    {ut?.criticalFlag && (
                      <i className="fa-solid fa-circle-exclamation text-red-400" title="Critical" />
                    )}
                    {cap.hasExceptions && (
                      <i
                        className="fa-solid fa-triangle-exclamation text-muted-foreground"
                        title="HC exceptions applied"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {wpCount || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectedDayPanel({
  date,
  capacity,
  demand,
  utilization,
  shifts,
  onClose,
}: {
  date: string;
  capacity: DailyCapacityV2[];
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  onClose: () => void;
}) {
  const cap = capacity.find((c) => c.date === date);
  const dem = demand.find((d) => d.date === date);
  const ut = utilization.find((u) => u.date === date);
  const activeShifts = shifts.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  if (!cap) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          <i className="fa-solid fa-calendar-day mr-1.5 text-amber-400" />
          {fmtDate(date)} — Detail
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <i className="fa-solid fa-xmark" />
        </Button>
      </div>

      {/* Per-shift grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeShifts.map((s) => {
          const sc = cap.byShift.find((bs) => bs.shiftCode === s.code);
          const sd = dem?.byShift.find((bs) => bs.shiftCode === s.code);
          const su = ut?.byShift.find((bs) => bs.shiftCode === s.code);
          return (
            <div key={s.code} className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <i className={`fa-solid ${shiftIcon(s.code)} text-muted-foreground`} />
                {s.name}
                {sc?.belowMinHeadcount && (
                  <i
                    className="fa-solid fa-triangle-exclamation text-amber-400"
                    title="Below minimum headcount"
                  />
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <dt className="text-muted-foreground">Eff. Heads</dt>
                <dd
                  className="font-mono text-right"
                  title={sc ? `Roster: ${sc.rosterHeadcount}` : undefined}
                >
                  {sc ? fmtNum(sc.effectiveHeadcount) : "—"}
                </dd>
                <dt className="text-muted-foreground">Cap MH</dt>
                <dd className="font-mono text-right">{sc ? fmtNum(sc.productiveMH) : "—"}</dd>
                <dt className="text-muted-foreground">Demand MH</dt>
                <dd className="font-mono text-right">{sd ? fmtNum(sd.demandMH) : "—"}</dd>
                <dt className="text-muted-foreground">Util%</dt>
                <dd className={`font-mono text-right font-semibold ${utilColor(su?.utilization)}`}>
                  {fmtPct(su?.utilization)}
                </dd>
                <dt className="text-muted-foreground">Gap MH</dt>
                <dd className="font-mono text-right">{su ? fmtNum(su.gapMH) : "—"}</dd>
              </dl>
            </div>
          );
        })}
      </div>

      {/* WP Contributions */}
      {dem && dem.byShift.some((s) => s.wpContributions.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <i className="fa-solid fa-boxes-stacked mr-1.5" />
            WP Contributions
          </h3>
          {activeShifts.map((s) => {
            const sd = dem.byShift.find((bs) => bs.shiftCode === s.code);
            if (!sd || sd.wpContributions.length === 0) return null;
            return (
              <div key={s.code} className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">
                  <i className={`fa-solid ${shiftIcon(s.code)} mr-1`} />
                  {s.name}
                </p>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {sd.wpContributions.map((wp, i) => (
                    <div
                      key={`${wp.wpId}-${i}`}
                      className="flex items-center gap-2 rounded px-2 py-1 text-[11px] bg-muted/20"
                    >
                      <span className="font-mono font-medium w-16 truncate">{wp.aircraftReg}</span>
                      <span className="text-muted-foreground truncate flex-1">{wp.customer}</span>
                      <span className="font-mono">{fmtNum(wp.allocatedMH)}</span>
                      <MhSourceBadge source={wp.mhSource} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overlay values */}
      {dem && <OverlayValues demand={dem} ut={ut ?? null} />}
    </div>
  );
}

function MhSourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    manual: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    override: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    workpackage: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    wp: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    contract: "bg-violet-500/20 text-violet-400 border-violet-500/40",
  };
  const cls = styles[source] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${cls}`}
    >
      {source}
    </span>
  );
}

function OverlayValues({ demand, ut }: { demand: DailyDemandV2; ut: DailyUtilizationV2 | null }) {
  const entries: { label: string; value: string | number }[] = [];
  if (demand.totalAllocatedDemandMH != null)
    entries.push({
      label: "Allocated Demand MH",
      value: fmtNum(demand.totalAllocatedDemandMH),
    });
  if (demand.totalForecastedDemandMH != null)
    entries.push({
      label: "Forecasted Demand MH",
      value: fmtNum(demand.totalForecastedDemandMH),
    });
  if (demand.totalWorkedMH != null)
    entries.push({
      label: "Worked MH",
      value: fmtNum(demand.totalWorkedMH),
    });
  if (demand.totalBilledMH != null)
    entries.push({
      label: "Billed MH",
      value: fmtNum(demand.totalBilledMH),
    });
  if (demand.peakConcurrency != null)
    entries.push({
      label: "Peak Concurrency",
      value: demand.peakConcurrency,
    });

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <i className="fa-solid fa-layer-group mr-1.5" />
        Overlay Values
      </h3>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
        {entries.map((e) => (
          <div key={e.label} className="contents">
            <dt className="text-muted-foreground">{e.label}</dt>
            <dd className="font-mono">{e.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RawInspector({ sections }: { sections: { label: string; key: string; data: unknown }[] }) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <i className="fa-solid fa-code mr-1.5" />
        Raw Data Inspector
      </h2>
      <div className="space-y-1">
        {sections.map((s) => (
          <Collapsible
            key={s.key}
            open={openSections.has(s.key)}
            onOpenChange={() => toggle(s.key)}
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium hover:bg-accent/30 transition-colors">
              <i
                className={`fa-solid fa-chevron-right text-[10px] text-muted-foreground transition-transform ${
                  openSections.has(s.key) ? "rotate-90" : ""
                }`}
              />
              {s.label}
              {s.data == null && <span className="text-muted-foreground ml-1">(null)</span>}
              {Array.isArray(s.data) && (
                <span className="text-muted-foreground ml-1">({s.data.length})</span>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-xs overflow-auto max-h-64 bg-muted/30 rounded-md p-3 mx-3 mb-2">
                {JSON.stringify(s.data, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DevOverviewPage() {
  const { start, end } = useFilters();
  const {
    shifts,
    assumptions,
    capacity,
    demand,
    utilization,
    contracts,
    concurrencyBuckets,
    forecastRates,
    timeBookings,
    billingEntries,
    computeMode,
    resolvedShifts,
    activeStaffingConfigName,
    isLoading,
    error,
  } = useCapacityV2();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Pipeline stages
  const stages: PipelineStage[] = [
    {
      label: "Base WPs",
      icon: "fa-boxes-stacked",
      count: demand?.length ?? 0,
    },
    {
      label: "Contracts",
      icon: "fa-handshake",
      count: contracts?.length ?? 0,
    },
    {
      label: "Concurrency",
      icon: "fa-layer-group",
      count: concurrencyBuckets?.length ?? 0,
    },
    {
      label: "Forecast",
      icon: "fa-chart-line",
      count: forecastRates?.length ?? 0,
    },
    {
      label: "Worked Hours",
      icon: "fa-stopwatch",
      count: timeBookings?.length ?? 0,
    },
    {
      label: "Billed Hours",
      icon: "fa-file-invoice-dollar",
      count: billingEntries?.length ?? 0,
    },
  ];

  // Raw inspector sections
  const selectedCap = selectedDate ? capacity.find((c) => c.date === selectedDate) : null;
  const selectedDem = selectedDate ? demand.find((d) => d.date === selectedDate) : null;

  const rawSections = [
    { label: "Compute Mode", key: "compute-mode", data: { computeMode, activeStaffingConfigName } },
    { label: "Resolved Shifts", key: "resolved-shifts", data: resolvedShifts },
    { label: "Assumptions", key: "assumptions", data: assumptions },
    { label: "Shifts", key: "shifts", data: shifts },
    {
      label: "Selected Day — Capacity",
      key: "sel-cap",
      data: selectedCap ?? null,
    },
    {
      label: "Selected Day — Demand",
      key: "sel-dem",
      data: selectedDem ?? null,
    },
    { label: "Contracts", key: "contracts", data: contracts },
    { label: "Forecast Rates", key: "forecast", data: forecastRates },
    { label: "Time Bookings", key: "timebookings", data: timeBookings },
    { label: "Billing Entries", key: "billing", data: billingEntries },
  ];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <DevBanner start={start} end={end} />
        <div className="flex items-center justify-center py-12">
          <i className="fa-solid fa-spinner fa-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading capacity model data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <DevBanner start={start} end={end} />
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <i className="fa-solid fa-circle-exclamation mr-2" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground">
        <Link href="/admin/capacity" className="hover:text-foreground transition-colors">
          Capacity Admin
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Dev Overview</span>
      </div>

      {/* 1. Banner */}
      <DevBanner start={start} end={end} />

      {/* 2. Pipeline Status */}
      <PipelineStatusBar stages={stages} />

      {/* 2b. Compute Mode Banner */}
      <ComputeModeBanner
        computeMode={computeMode}
        activeStaffingConfigName={activeStaffingConfigName}
      />

      {/* 3. Model Config */}
      <ModelConfigSection
        assumptions={assumptions}
        shifts={shifts}
        resolvedShifts={resolvedShifts}
        computeMode={computeMode}
      />

      {/* 4. Formula Trace */}
      <FormulaTrace assumptions={assumptions} shifts={shifts} resolvedShifts={resolvedShifts} />

      {/* 5. Daily Table */}
      <DailyTable
        capacity={capacity}
        demand={demand}
        utilization={utilization}
        shifts={shifts}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* 6. Selected Day Detail */}
      {selectedDate && (
        <SelectedDayPanel
          date={selectedDate}
          capacity={capacity}
          demand={demand}
          utilization={utilization}
          shifts={shifts}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {/* 7. Raw Inspector */}
      <RawInspector sections={rawSections} />
    </div>
  );
}
