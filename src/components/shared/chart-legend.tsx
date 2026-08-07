"use client";

import type { DotShape } from "@/lib/utils/shift-colors";

/**
 * Interactive legend for the capacity charts.
 *
 * Replaces the default Recharts <Legend>, which could only render one flat row
 * of name+swatch entries. Two things were wrong with that:
 *
 *  1. Three per-shift lines were collapsed into a single "Capacity" entry via
 *     `legendType="none"`, so the plot drew nine series but labelled five —
 *     two near-identical curves with no way to tell them apart.
 *  2. Nothing was clickable.
 *
 * This renders two rows — the entity row (shifts, or customers in By Customer
 * mode) and the series row (demand / capacity / utilization plus any overlays)
 * — and every entry toggles. Swatches draw the mark the series actually uses,
 * so the legend itself answers "which line is capacity?".
 */

export type LegendMark = "bar" | "dashed" | "solid";

export interface LegendItem {
  /** Visibility key — see use-chart-series-visibility */
  key: string;
  label: string;
  color: string;
  mark: LegendMark;
  dotShape?: DotShape;
  /** Rendered dimmed and struck through */
  hidden?: boolean;
}

export interface LegendRow {
  id: string;
  items: LegendItem[];
}

interface ChartLegendProps {
  rows: LegendRow[];
  onToggle: (key: string) => void;
}

function MarkSwatch({ item }: { item: LegendItem }) {
  const { color, mark, dotShape } = item;

  if (mark === "bar") {
    return (
      <svg width="14" height="10" aria-hidden="true" className="shrink-0">
        <rect x="2" y="0" width="10" height="10" rx="2" fill={color} fillOpacity={0.85} />
      </svg>
    );
  }

  const dot = () => {
    if (mark !== "solid") return null;
    switch (dotShape) {
      case "square":
        return <rect x="7" y="2" width="6" height="6" fill={color} />;
      case "triangle":
        return <polygon points="10,1.5 13.5,8 6.5,8" fill={color} />;
      default:
        return <circle cx="10" cy="5" r="3" fill={color} />;
    }
  };

  return (
    <svg width="20" height="10" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="5"
        x2="19"
        y2="5"
        stroke={color}
        strokeWidth={mark === "dashed" ? 2.5 : 2}
        strokeDasharray={mark === "dashed" ? "5 3" : undefined}
      />
      {dot()}
    </svg>
  );
}

export function ChartLegend({ rows, onToggle }: ChartLegendProps) {
  const visibleRows = rows.filter((r) => r.items.length > 0);
  if (visibleRows.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1 pt-2 print-hide">
      {visibleRows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {row.items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggle(item.key)}
              aria-pressed={!item.hidden}
              title={item.hidden ? `Show ${item.label}` : `Hide ${item.label}`}
              className={`flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-100 ${
                item.hidden ? "opacity-40" : "opacity-100"
              }`}
            >
              <MarkSwatch item={item} />
              <span className={item.hidden ? "line-through text-muted-foreground" : ""}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
