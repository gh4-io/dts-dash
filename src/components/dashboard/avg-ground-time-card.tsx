"use client";

import { useMemo } from "react";
import { KpiCard } from "./kpi-card";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface AvgGroundTimeCardProps {
  workPackages: SerializedWorkPackage[];
}

function formatHM(hours: number): string {
  if (!isFinite(hours) || hours === 0) return "0:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function AvgGroundTimeCard({ workPackages }: AvgGroundTimeCardProps) {
  const { avgShort, avgLong, shortCount, longCount } = useMemo(() => {
    const short = workPackages.filter((wp) => wp.groundHours < 24);
    const long = workPackages.filter((wp) => wp.groundHours >= 24);

    const avgS = short.length > 0
      ? short.reduce((sum, wp) => sum + wp.groundHours, 0) / short.length
      : 0;
    const avgL = long.length > 0
      ? long.reduce((sum, wp) => sum + wp.groundHours, 0) / long.length
      : 0;

    return {
      avgShort: avgS,
      avgLong: avgL,
      shortCount: short.length,
      longCount: long.length,
    };
  }, [workPackages]);

  return (
    <KpiCard title="Average Ground Time" icon="fa-solid fa-clock">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">&lt; 24 Hrs</p>
          <p className="text-2xl font-bold tabular-nums">{formatHM(avgShort)}</p>
          <p className="text-xs text-muted-foreground">{shortCount} visits</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">&ge; 24 Hrs</p>
          <p className="text-2xl font-bold tabular-nums">{formatHM(avgLong)}</p>
          <p className="text-xs text-muted-foreground">{longCount} visits</p>
        </div>
      </div>
    </KpiCard>
  );
}
