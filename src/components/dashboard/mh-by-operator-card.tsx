"use client";

import { useMemo } from "react";
import { KpiCard } from "./kpi-card";
import { useCustomers } from "@/lib/hooks/use-customers";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface MhByOperatorCardProps {
  workPackages: SerializedWorkPackage[];
  onOperatorClick?: (operator: string) => void;
  className?: string;
}

export function MhByOperatorCard({ workPackages, onOperatorClick, className }: MhByOperatorCardProps) {
  const { getColor } = useCustomers();

  const operatorData = useMemo(() => {
    const grouped = new Map<string, number>();
    workPackages.forEach((wp) => {
      grouped.set(wp.customer, (grouped.get(wp.customer) ?? 0) + wp.effectiveMH);
    });

    return Array.from(grouped.entries())
      .map(([name, mh]) => ({ name, mh }))
      .sort((a, b) => b.mh - a.mh);
  }, [workPackages]);

  const maxMH = operatorData.length > 0 ? operatorData[0].mh : 1;

  return (
    <KpiCard title="Scheduled Man Hours" icon="fa-solid fa-wrench" className={className}>
      <div className="space-y-2">
        {operatorData.map((op) => (
          <div key={op.name} className="group">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <button
                className="text-foreground hover:text-primary hover:underline text-left truncate max-w-[140px]"
                onClick={() => onOperatorClick?.(op.name)}
                title={op.name}
              >
                {op.name}
              </button>
              <span className="text-muted-foreground tabular-nums">{op.mh.toFixed(1)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(op.mh / maxMH) * 100}%`,
                  backgroundColor: getColor(op.name),
                }}
              />
            </div>
          </div>
        ))}
        {operatorData.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No data</p>
        )}
      </div>
    </KpiCard>
  );
}
