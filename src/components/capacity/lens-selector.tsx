"use client";

import { CAPACITY_LENSES } from "@/lib/capacity/lens-config";
import type { CapacityLensId } from "@/types";

interface LensSelectorProps {
  activeLens: CapacityLensId;
  availableLenses: Set<CapacityLensId>;
  onLensChange: (lens: CapacityLensId) => void;
}

const LENS_COLORS: Record<string, { active: string; ring: string }> = {
  blue: { active: "bg-blue-500/15 text-blue-400 ring-blue-500/30", ring: "ring-blue-500/30" },
  amber: { active: "bg-amber-500/15 text-amber-400 ring-amber-500/30", ring: "ring-amber-500/30" },
  sky: { active: "bg-sky-500/15 text-sky-400 ring-sky-500/30", ring: "ring-sky-500/30" },
  teal: { active: "bg-teal-500/15 text-teal-400 ring-teal-500/30", ring: "ring-teal-500/30" },
  green: { active: "bg-green-500/15 text-green-400 ring-green-500/30", ring: "ring-green-500/30" },
  indigo: {
    active: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/30",
    ring: "ring-indigo-500/30",
  },
  purple: {
    active: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
    ring: "ring-purple-500/30",
  },
};

export function LensSelector({ activeLens, availableLenses, onLensChange }: LensSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
      {CAPACITY_LENSES.map((lens) => {
        const isActive = activeLens === lens.id;
        const isAvailable = availableLenses.has(lens.id);
        const colors = LENS_COLORS[lens.color] ?? LENS_COLORS.blue;

        return (
          <button
            key={lens.id}
            disabled={!isAvailable}
            title={
              !isAvailable
                ? `No ${lens.label.toLowerCase()} data for this period`
                : lens.description
            }
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              whitespace-nowrap transition-all ring-1
              ${
                isActive
                  ? `${colors.active} ring-1`
                  : isAvailable
                    ? "text-muted-foreground hover:text-foreground ring-border hover:ring-foreground/20 bg-transparent"
                    : "text-muted-foreground/40 ring-border/50 bg-transparent cursor-not-allowed"
              }
            `}
            onClick={() => {
              if (!isAvailable) return;
              // Toggle off overlay → back to planned; or switch to new lens
              if (isActive && lens.id !== "planned") {
                onLensChange("planned");
              } else {
                onLensChange(lens.id);
              }
            }}
          >
            <i className={`fa-solid ${lens.icon} text-[10px]`} />
            {lens.label}
          </button>
        );
      })}
    </div>
  );
}
