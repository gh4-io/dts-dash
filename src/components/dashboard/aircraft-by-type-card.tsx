"use client";

import { useMemo } from "react";
import { KpiCard } from "./kpi-card";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface AircraftByTypeCardProps {
  workPackages: SerializedWorkPackage[];
  className?: string;
}

const CANONICAL_TYPES = ["B777", "B767", "B747", "B757", "B737"];

export function AircraftByTypeCard({ workPackages, className }: AircraftByTypeCardProps) {
  const typeData = useMemo(() => {
    // Count unique registrations per type
    const typeRegs = new Map<string, Set<string>>();

    workPackages.forEach((wp) => {
      const type = wp.inferredType;
      if (!typeRegs.has(type)) typeRegs.set(type, new Set());
      typeRegs.get(type)!.add(wp.aircraftReg);
    });

    // Ensure all canonical types appear (even with 0)
    const result: { type: string; count: number }[] = [];
    for (const t of CANONICAL_TYPES) {
      result.push({ type: t, count: typeRegs.get(t)?.size ?? 0 });
    }

    // Add any non-canonical types that appear in data
    for (const [t, regs] of typeRegs) {
      if (!CANONICAL_TYPES.includes(t)) {
        result.push({ type: t, count: regs.size });
      }
    }

    return result.sort((a, b) => b.count - a.count);
  }, [workPackages]);

  return (
    <KpiCard title="Total Aircraft By Type" icon="fa-solid fa-plane-circle-check" className={className}>
      <div className="space-y-1">
        {typeData.map((item) => (
          <div key={item.type} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{item.type}</span>
            <span className="font-semibold tabular-nums">{item.count}</span>
          </div>
        ))}
        {typeData.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No data</p>
        )}
      </div>
    </KpiCard>
  );
}
