"use client";

import { useMemo } from "react";
import { KpiCard } from "./kpi-card";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface TotalAircraftCardProps {
  workPackages: SerializedWorkPackage[];
  className?: string;
}

export function TotalAircraftCard({ workPackages, className }: TotalAircraftCardProps) {
  const { totalAircraft, totalVisits, dateRange } = useMemo(() => {
    const uniqueRegs = new Set(workPackages.map((wp) => wp.aircraftReg));
    const totalVisits = workPackages.length;

    let range = "";
    if (workPackages.length > 0) {
      const arrivals = workPackages.map((wp) => new Date(wp.arrival).getTime());
      const departures = workPackages.map((wp) => new Date(wp.departure).getTime());
      const minDate = new Date(Math.min(...arrivals));
      const maxDate = new Date(Math.max(...departures));
      const fmt = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      range = `${fmt(minDate)} – ${fmt(maxDate)}`;
    }

    return { totalAircraft: uniqueRegs.size, totalVisits, dateRange: range };
  }, [workPackages]);

  return (
    <KpiCard title="Aircraft & Turns" icon="fa-solid fa-plane" className={className}>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="text-center flex-1">
            <p className="text-3xl font-bold tabular-nums">{totalAircraft}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aircraft</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-center flex-1">
            <p className="text-3xl font-bold tabular-nums">{totalVisits}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Turns</p>
          </div>
        </div>
        {dateRange && <p className="text-xs text-muted-foreground text-center">{dateRange}</p>}
      </div>
    </KpiCard>
  );
}
