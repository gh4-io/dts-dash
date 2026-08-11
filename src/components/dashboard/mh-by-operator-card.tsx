"use client";

import { useMemo } from "react";
import { KpiCard } from "./kpi-card";
import { useCustomers } from "@/lib/hooks/use-customers";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface MhByOperatorCardProps {
  workPackages: SerializedWorkPackage[];
  /** Currently isolated operator, so the rows can show focus and dim the rest. */
  focusedOperator?: string | null;
  onOperatorClick?: (operator: string) => void;
  className?: string;
}

export function MhByOperatorCard({
  workPackages,
  focusedOperator = null,
  onOperatorClick,
  className,
}: MhByOperatorCardProps) {
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
        {operatorData.map((op) => {
          const isFocused = focusedOperator === op.name;
          const isDimmed = focusedOperator !== null && !isFocused;

          return (
            // The whole row is the hit target — name, value and bar together.
            // Previously only the name was clickable and it underlined on hover,
            // which read as a hyperlink rather than a filter. This matches the
            // focus/dim treatment of the Operator Performance table below it, so
            // the two cross-filtering surfaces on this page behave the same way.
            <button
              key={op.name}
              type="button"
              aria-pressed={isFocused}
              title={`${op.name} — click to ${isFocused ? "clear" : "isolate"}`}
              onClick={() => onOperatorClick?.(op.name)}
              // px/py bleed the highlight outward via matching negative margins,
              // so the row occupies exactly the height it did before it became a
              // button — the list's original rhythm is unchanged.
              className={`w-full text-left rounded-md px-2 -mx-2 py-1 -my-1 transition-colors transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isDimmed ? "opacity-30" : ""
              } ${isFocused ? "bg-primary/10" : "hover:bg-muted/50"}`}
            >
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-foreground truncate max-w-[140px]">{op.name}</span>
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
            </button>
          );
        })}
        {operatorData.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No data</p>
        )}
      </div>
    </KpiCard>
  );
}
