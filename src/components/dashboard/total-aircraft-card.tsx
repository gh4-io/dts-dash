"use client";

import { useMemo } from "react";
import { KpiCard } from "./kpi-card";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface TotalAircraftCardProps {
  workPackages: SerializedWorkPackage[];
}

export function TotalAircraftCard({ workPackages }: TotalAircraftCardProps) {
  const { totalAircraft, dateRange } = useMemo(() => {
    const uniqueRegs = new Set(workPackages.map((wp) => wp.aircraftReg));

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

    return { totalAircraft: uniqueRegs.size, dateRange: range };
  }, [workPackages]);

  return (
    <KpiCard title="Total Aircraft" icon="fa-solid fa-plane">
      <div>
        <p className="text-4xl font-bold tabular-nums">{totalAircraft}</p>
        {dateRange && (
          <p className="text-xs text-muted-foreground mt-1">{dateRange}</p>
        )}
      </div>
    </KpiCard>
  );
}
