"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type {
  DailyCapacityV2,
  DailyDemandV2,
  DailyUtilizationV2,
  CapacityShift,
  CapacityAssumptions,
  ShiftCapacityV2,
  ShiftDemandV2,
  CapacityLensId,
  DemandContract,
  FlightEvent,
  TimeBooking,
  BillingEntry,
  ForecastRate,
  ForecastModel,
  ConcurrencyBucket,
} from "@/types";

interface ShiftDrilldownDrawerProps {
  open: boolean;
  onClose: () => void;
  date: string | null;
  shiftCode: string | null; // null = daily total
  capacity: DailyCapacityV2[];
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  shifts: CapacityShift[];
  assumptions: CapacityAssumptions | null;
  activeLens: CapacityLensId;
  contracts?: DemandContract[];
  flightEvents?: FlightEvent[];
  timeBookings?: TimeBooking[];
  billingEntries?: BillingEntry[];
  forecastRates?: ForecastRate[];
  forecastModel?: ForecastModel | null;
  concurrencyBuckets?: ConcurrencyBucket[];
}

const SHIFT_ICONS: Record<string, string> = {
  DAY: "fa-sun",
  SWING: "fa-cloud-sun",
  NIGHT: "fa-moon",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getUtilBadge(util: number | null, noCoverage: boolean): React.ReactNode {
  if (noCoverage || util === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <i className="fa-solid fa-ban text-[8px]" />
        No Coverage
      </span>
    );
  }
  const color =
    util > 120
      ? "bg-red-500/15 text-red-400"
      : util > 100
        ? "bg-amber-500/15 text-amber-400"
        : util > 80
          ? "bg-blue-500/15 text-blue-400"
          : "bg-emerald-500/15 text-emerald-400";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {util > 120 && <i className="fa-solid fa-triangle-exclamation text-[8px]" />}
      {util.toFixed(1)}%
    </span>
  );
}

/** Capacity chain visualization — 4-step layout */
function CapacityChain({
  shiftCap,
  shift,
  assumptions,
}: {
  shiftCap: ShiftCapacityV2;
  shift: CapacityShift;
  assumptions: CapacityAssumptions;
}) {
  const isNight = shift.code === "NIGHT";
  const nightFactor = isNight ? assumptions.nightProductivityFactor : 1.0;
  const productiveMHPerPerson =
    shiftCap.paidHoursPerPerson * assumptions.availableToProductive * nightFactor;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Capacity Chain
      </div>

      {/* Roster Headcount */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          <i className="fa-solid fa-clipboard-list mr-1.5 text-xs" />
          Roster Headcount
        </span>
        <span className="font-medium tabular-nums">
          {shiftCap.rosterHeadcount}
          {shiftCap.belowMinHeadcount && (
            <span className="ml-1.5 text-amber-400 text-xs">
              <i className="fa-solid fa-triangle-exclamation text-[9px] mr-0.5" />
              below min ({shift.minHeadcount})
            </span>
          )}
          {shiftCap.hasExceptions && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              <i className="fa-solid fa-asterisk text-[8px]" /> adj.
            </span>
          )}
        </span>
      </div>

      {/* 4-step chain */}
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
        {/* Step 1: Attendance rate */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-4">
          <i className="fa-solid fa-arrow-down text-[8px]" />x{" "}
          {assumptions.paidToAvailable.toFixed(2)} (attendance rate)
        </div>
        <ChainRow
          label="Effective Heads"
          formula={`${shiftCap.rosterHeadcount} roster x ${assumptions.paidToAvailable.toFixed(2)}`}
          value={shiftCap.effectiveHeadcount}
          unit="heads"
        />

        {/* Step 2: Paid hours */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-4">
          <i className="fa-solid fa-arrow-down text-[8px]" />x {shiftCap.paidHoursPerPerson}h per
          person
        </div>
        <ChainRow
          label="Paid Hours"
          formula={`${shiftCap.effectiveHeadcount.toFixed(1)} heads x ${shiftCap.paidHoursPerPerson}h`}
          value={shiftCap.paidMH}
          unit="MH"
        />

        {/* Step 3: Productive efficiency */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-4">
          <i className="fa-solid fa-arrow-down text-[8px]" />x{" "}
          {assumptions.availableToProductive.toFixed(2)} (productive efficiency)
          {isNight && ` x ${assumptions.nightProductivityFactor.toFixed(2)} (night factor)`}
        </div>
        <ChainRow
          label="Productive Hours"
          formula={`${productiveMHPerPerson.toFixed(2)} MH/person`}
          value={shiftCap.productiveMH}
          unit="MH"
          highlight
        />
      </div>
    </div>
  );
}

function ChainRow({
  label,
  formula,
  value,
  unit,
  highlight,
}: {
  label: string;
  formula: string;
  value: number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className={highlight ? "font-medium" : "text-muted-foreground"}>{label}</span>
        <span className="text-[10px] text-muted-foreground ml-1.5">({formula})</span>
      </div>
      <span className={`tabular-nums ${highlight ? "font-semibold text-emerald-400" : ""}`}>
        {value.toFixed(1)} {unit}
      </span>
    </div>
  );
}

/** WP contribution list */
function DemandBreakdown({ shiftDem }: { shiftDem: ShiftDemandV2 }) {
  if (shiftDem.wpContributions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        <i className="fa-solid fa-inbox text-lg mb-1 block" />
        No demand in this shift slot
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Work Packages ({shiftDem.wpContributions.length})
      </div>
      <div className="max-h-[240px] overflow-y-auto space-y-1">
        {shiftDem.wpContributions.map((wp, i) => (
          <div
            key={`${wp.wpId}-${i}`}
            className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-1.5 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <i className="fa-solid fa-plane text-[10px] text-muted-foreground shrink-0" />
              <span className="font-mono text-xs truncate">{wp.aircraftReg}</span>
              <span className="text-xs text-muted-foreground truncate">{wp.customer}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="tabular-nums text-xs font-medium">
                {wp.allocatedMH.toFixed(2)} MH
              </span>
              <span
                className={`text-[9px] px-1 py-0.5 rounded ${
                  wp.mhSource === "override"
                    ? "bg-blue-500/15 text-blue-400"
                    : wp.mhSource === "wp"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {wp.mhSource}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lens detail section card */
function LensDetailCard({
  icon,
  color,
  title,
  children,
}: {
  icon: string;
  color: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border border-${color}-500/30 bg-${color}-500/5 p-3 space-y-2`}>
      <div
        className={`text-xs font-medium uppercase tracking-wider text-${color}-400 flex items-center gap-1.5`}
      >
        <i className={`fa-solid ${icon} text-[10px]`} />
        {title}
      </div>
      {children}
    </div>
  );
}

export function ShiftDrilldownDrawer({
  open,
  onClose,
  date,
  shiftCode,
  capacity,
  demand,
  utilization,
  shifts,
  assumptions,
  activeLens,
  contracts,
  flightEvents,
  timeBookings,
  billingEntries,
  forecastRates,
  forecastModel,
  concurrencyBuckets,
}: ShiftDrilldownDrawerProps) {
  if (!date) return null;

  const cap = capacity.find((c) => c.date === date);
  const dem = demand.find((d) => d.date === date);
  const util = utilization.find((u) => u.date === date);
  const shift = shiftCode ? shifts.find((s) => s.code === shiftCode) : null;

  // If shiftCode is null, show daily total overview
  const isDailyTotal = shiftCode === null;

  // Per-shift data
  const shiftCap = shiftCode ? cap?.byShift.find((s) => s.shiftCode === shiftCode) : null;
  const shiftDem = shiftCode ? dem?.byShift.find((s) => s.shiftCode === shiftCode) : null;
  const shiftUtil = shiftCode ? util?.byShift.find((s) => s.shiftCode === shiftCode) : null;

  const title = isDailyTotal ? "Daily Overview" : `${shift?.name ?? shiftCode} Shift`;

  const shiftIcon = shiftCode ? (SHIFT_ICONS[shiftCode] ?? "fa-clock") : "fa-calendar-day";

  // Lens detail rendering
  const renderLensDetail = () => {
    if (activeLens === "planned") return null;

    switch (activeLens) {
      case "allocated": {
        if (!contracts || contracts.length === 0) return null;
        const dowNum = new Date(date + "T12:00:00Z").getUTCDay();
        // Flatten contracts to matching lines for this date
        const matchingEntries: {
          contractName: string;
          customerName: string;
          mode: string;
          allocatedMh: number;
        }[] = [];
        for (const c of contracts) {
          if (!c.isActive) continue;
          if (c.effectiveFrom > date) continue;
          if (c.effectiveTo !== null && c.effectiveTo < date) continue;
          for (const line of c.lines) {
            if (line.dayOfWeek !== null && line.dayOfWeek !== dowNum) continue;
            matchingEntries.push({
              contractName: c.name,
              customerName: c.customerName ?? `Customer #${c.customerId}`,
              mode: c.mode,
              allocatedMh: line.allocatedMh,
            });
          }
        }
        if (matchingEntries.length === 0) return null;
        return (
          <LensDetailCard
            icon="fa-handshake"
            color="amber"
            title={`Allocations (${matchingEntries.length})`}
          >
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {matchingEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-xs">{entry.customerName}</span>
                    <span
                      className={`text-[9px] px-1 py-0.5 rounded ${entry.mode === "MINIMUM_FLOOR" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}
                    >
                      {entry.mode === "ADDITIVE" ? "add" : "floor"}
                    </span>
                  </span>
                  <span className="tabular-nums font-medium text-amber-400">
                    {entry.allocatedMh.toFixed(1)} MH
                  </span>
                </div>
              ))}
            </div>
          </LensDetailCard>
        );
      }
      case "events": {
        if (!flightEvents || flightEvents.length === 0) return null;
        const matching = flightEvents.filter((e) => {
          const arrDate = (e.actualArrival ?? e.scheduledArrival ?? "").split("T")[0];
          return arrDate === date;
        });
        if (matching.length === 0) return null;
        return (
          <LensDetailCard
            icon="fa-plane-arrival"
            color="sky"
            title={`Flight Events (${matching.length})`}
          >
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {matching.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-sm rounded-md border border-border bg-muted/20 px-2 py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-xs">{e.aircraftReg}</span>
                    <span
                      className={`text-[9px] px-1 py-0.5 rounded ${e.status === "actual" ? "bg-sky-500/15 text-sky-400" : e.status === "cancelled" ? "bg-red-500/15 text-red-400" : "bg-orange-500/15 text-orange-400"}`}
                    >
                      {e.status}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(e.actualArrival ?? e.scheduledArrival ?? "").split("T")[1]?.slice(0, 5) ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </LensDetailCard>
        );
      }
      case "forecast": {
        if (!forecastRates || forecastRates.length === 0) return null;
        const matching = forecastRates.filter((r) => {
          if (r.forecastDate !== date) return false;
          if (shiftCode && r.shiftCode && r.shiftCode !== shiftCode) return false;
          return true;
        });
        if (matching.length === 0) return null;
        return (
          <LensDetailCard icon="fa-chart-line" color="teal" title="Forecast">
            <div className="space-y-1">
              {forecastModel && (
                <div className="text-xs text-muted-foreground">Model: {forecastModel.name}</div>
              )}
              {matching.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{r.shiftCode ?? "Daily"}</span>
                  <span className="tabular-nums font-medium text-teal-400">
                    {r.forecastedMh.toFixed(1)} MH
                  </span>
                </div>
              ))}
            </div>
          </LensDetailCard>
        );
      }
      case "worked": {
        if (!timeBookings || timeBookings.length === 0) return null;
        const matching = timeBookings.filter((t) => {
          if (t.bookingDate !== date) return false;
          if (shiftCode && t.shiftCode !== shiftCode) return false;
          return true;
        });
        if (matching.length === 0) return null;
        const total = matching.reduce((s, t) => s + t.workedMh, 0);
        return (
          <LensDetailCard
            icon="fa-stopwatch"
            color="green"
            title={`Worked Hours (${matching.length} bookings)`}
          >
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {matching.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    {t.aircraftReg} — {t.taskType ?? "General"}
                  </span>
                  <span className="tabular-nums font-medium text-green-400">
                    {t.workedMh.toFixed(1)} MH
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm font-medium border-t border-border pt-1">
              <span>Total</span>
              <span className="tabular-nums text-green-400">{total.toFixed(1)} MH</span>
            </div>
          </LensDetailCard>
        );
      }
      case "billed": {
        if (!billingEntries || billingEntries.length === 0) return null;
        const matching = billingEntries.filter((b) => {
          if (b.billingDate !== date) return false;
          if (shiftCode && b.shiftCode !== shiftCode) return false;
          return true;
        });
        if (matching.length === 0) return null;
        const total = matching.reduce((s, b) => s + b.billedMh, 0);
        return (
          <LensDetailCard
            icon="fa-file-invoice-dollar"
            color="indigo"
            title={`Billed Hours (${matching.length} entries)`}
          >
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {matching.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    {b.aircraftReg} — {b.customer}
                    {b.invoiceRef && <span className="text-[10px]">({b.invoiceRef})</span>}
                  </span>
                  <span className="tabular-nums font-medium text-indigo-400">
                    {b.billedMh.toFixed(1)} MH
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm font-medium border-t border-border pt-1">
              <span>Total</span>
              <span className="tabular-nums text-indigo-400">{total.toFixed(1)} MH</span>
            </div>
          </LensDetailCard>
        );
      }
      case "concurrent": {
        if (!concurrencyBuckets || concurrencyBuckets.length === 0) return null;
        const matching = concurrencyBuckets.filter((c) => c.hour.split("T")[0] === date);
        if (matching.length === 0) return null;
        const peak = Math.max(...matching.map((c) => c.aircraftCount));
        const avg = matching.reduce((s, c) => s + c.aircraftCount, 0) / matching.length;
        return (
          <LensDetailCard icon="fa-layer-group" color="purple" title="Concurrency">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Peak Aircraft</span>
                <span className="tabular-nums font-medium text-purple-400">{peak}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg Aircraft</span>
                <span className="tabular-nums font-medium text-purple-400">{avg.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time Buckets</span>
                <span className="tabular-nums text-muted-foreground">{matching.length}</span>
              </div>
            </div>
          </LensDetailCard>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <i className={`fa-solid ${shiftIcon} text-sm text-muted-foreground`} />
            {title}
          </SheetTitle>
          <SheetDescription>{formatDate(date)}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4">
          {/* Utilization badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Utilization</span>
            {isDailyTotal
              ? getUtilBadge(util?.utilizationPercent ?? null, false)
              : getUtilBadge(shiftUtil?.utilization ?? null, shiftUtil?.noCoverage ?? false)}
          </div>

          <Separator />

          {/* Per-shift drilldown */}
          {!isDailyTotal && shift && shiftCap && assumptions ? (
            <>
              <CapacityChain shiftCap={shiftCap} shift={shift} assumptions={assumptions} />

              <Separator />

              {/* Demand section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    <i className="fa-solid fa-hammer mr-1.5 text-xs" />
                    Demand
                  </span>
                  <span className="font-medium tabular-nums">
                    {(shiftDem?.demandMH ?? 0).toFixed(1)} MH
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    <i className="fa-solid fa-scale-balanced mr-1.5 text-xs" />
                    Gap
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      (shiftUtil?.gapMH ?? 0) < 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {(shiftUtil?.gapMH ?? 0) >= 0 ? "+" : ""}
                    {(shiftUtil?.gapMH ?? 0).toFixed(1)} MH
                  </span>
                </div>

                {shiftDem && (
                  <>
                    <Separator />
                    <DemandBreakdown shiftDem={shiftDem} />
                  </>
                )}
              </div>

              {/* Lens detail section */}
              {renderLensDetail() && (
                <>
                  <Separator />
                  {renderLensDetail()}
                </>
              )}
            </>
          ) : isDailyTotal && util ? (
            <>
              {/* Daily total breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Demand</span>
                  <span className="font-medium tabular-nums">
                    {util.totalDemandMH.toFixed(1)} MH
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Capacity</span>
                  <span className="font-medium tabular-nums">
                    {util.totalProductiveMH.toFixed(1)} MH
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gap</span>
                  <span
                    className={`font-medium tabular-nums ${
                      util.gapMH < 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {util.gapMH >= 0 ? "+" : ""}
                    {util.gapMH.toFixed(1)} MH
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Aircraft</span>
                  <span className="font-medium tabular-nums">{dem?.aircraftCount ?? 0}</span>
                </div>
              </div>

              {/* Lens detail section */}
              {renderLensDetail() && (
                <>
                  <Separator />
                  {renderLensDetail()}
                </>
              )}

              <Separator />

              {/* Per-shift summary within daily total */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  By Shift
                </div>
                {cap?.byShift.map((s) => {
                  const su = util.byShift.find((u) => u.shiftCode === s.shiftCode);
                  const sd = dem?.byShift.find((d) => d.shiftCode === s.shiftCode);
                  const shiftDef = shifts.find((sh) => sh.code === s.shiftCode);
                  return (
                    <div
                      key={s.shiftCode}
                      className="rounded-md border border-border bg-muted/20 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <i
                            className={`fa-solid ${SHIFT_ICONS[s.shiftCode] ?? "fa-clock"} text-[10px] text-muted-foreground`}
                          />
                          {s.shiftName}
                        </span>
                        {getUtilBadge(su?.utilization ?? null, su?.noCoverage ?? false)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="block text-[10px] uppercase">Eff. Heads</span>
                          <span
                            className="text-foreground font-medium tabular-nums"
                            title={`Roster: ${s.rosterHeadcount}`}
                          >
                            {s.effectiveHeadcount.toFixed(1)}
                            {s.belowMinHeadcount && (
                              <i className="fa-solid fa-triangle-exclamation text-amber-400 text-[8px] ml-1" />
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase">Demand</span>
                          <span className="text-foreground font-medium tabular-nums">
                            {(sd?.demandMH ?? 0).toFixed(1)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase">Capacity</span>
                          <span className="text-foreground font-medium tabular-nums">
                            {s.productiveMH.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      {shiftDef && s.belowMinHeadcount && (
                        <div className="text-[10px] text-amber-400">
                          <i className="fa-solid fa-triangle-exclamation mr-1" />
                          Below minimum headcount ({shiftDef.minHeadcount})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Customer breakdown */}
              {dem && Object.keys(dem.byCustomer).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      By Customer
                    </div>
                    {Object.entries(dem.byCustomer)
                      .sort(([, a], [, b]) => b - a)
                      .map(([customer, mh]) => (
                        <div key={customer} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <i className="fa-solid fa-building text-[10px]" />
                            {customer}
                          </span>
                          <span className="tabular-nums font-medium">{mh.toFixed(1)} MH</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              <i className="fa-solid fa-inbox text-2xl mb-2 block" />
              No data available for this cell
            </div>
          )}

          {/* Assumptions footer */}
          {assumptions && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Model Assumptions
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Attendance Rate</span>
                  <span className="text-foreground tabular-nums text-right">
                    {assumptions.paidToAvailable.toFixed(2)}
                  </span>
                  <span>Available-to-Productive</span>
                  <span className="text-foreground tabular-nums text-right">
                    {assumptions.availableToProductive.toFixed(2)}
                  </span>
                  <span>Night Factor</span>
                  <span className="text-foreground tabular-nums text-right">
                    {assumptions.nightProductivityFactor.toFixed(2)}
                  </span>
                  <span>Demand Curve</span>
                  <span className="text-foreground text-right">{assumptions.demandCurve}</span>
                  <span>Default MH (no WP)</span>
                  <span className="text-foreground tabular-nums text-right">
                    {assumptions.defaultMhNoWp.toFixed(1)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
