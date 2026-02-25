"use client";

import { useState, useRef, useEffect } from "react";
import { CAPACITY_LENSES } from "@/lib/capacity/lens-config";
import type { CapacityLensId } from "@/types";

/** Lenses that have an overlay line (entries in LENS_LINE_CONFIG) */
const OVERLAY_LENSES: Set<CapacityLensId> = new Set(["allocated", "forecast", "worked", "billed"]);

interface CompareSelectorProps {
  primaryLens: CapacityLensId;
  secondaryLens: CapacityLensId | null;
  availableLenses: Set<CapacityLensId>;
  onSecondaryChange: (lens: CapacityLensId | null) => void;
}

export function CompareSelector({
  primaryLens,
  secondaryLens,
  availableLenses,
  onSecondaryChange,
}: CompareSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const eligibleLenses = CAPACITY_LENSES.filter(
    (l) => OVERLAY_LENSES.has(l.id) && l.id !== primaryLens && availableLenses.has(l.id),
  );

  const secondaryLabel = secondaryLens
    ? (CAPACITY_LENSES.find((l) => l.id === secondaryLens)?.label ?? secondaryLens)
    : null;

  // Active state: show chip
  if (secondaryLens && secondaryLabel) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          vs
        </span>
        <button
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium
            bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30 transition-colors
            hover:bg-violet-500/25"
          onClick={() => onSecondaryChange(null)}
          title="Remove comparison"
        >
          {secondaryLabel}
          <i className="fa-solid fa-xmark text-[9px] opacity-70" />
        </button>
      </div>
    );
  }

  // Inactive state: show dropdown trigger
  if (eligibleLenses.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
          text-muted-foreground hover:text-foreground border border-border
          hover:border-foreground/20 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <i className="fa-solid fa-code-compare text-[9px]" />
        Compare
        <i
          className={`fa-solid fa-chevron-down text-[8px] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[140px] rounded-md border border-border bg-popover shadow-md py-1">
          {eligibleLenses.map((lens) => (
            <button
              key={lens.id}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left
                text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => {
                onSecondaryChange(lens.id);
                setOpen(false);
              }}
            >
              <i className={`fa-solid ${lens.icon} text-[10px] opacity-60`} />
              {lens.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
