/**
 * Shared series identity + mark style for the three capacity charts
 * (daily summary, weekly pattern, monthly rollup).
 *
 * Two jobs:
 *  - Visibility keys. Every drawn series carries an entity key (shift or
 *    customer) and a role key; the legend toggles those keys. See
 *    use-chart-series-visibility.
 *  - Role encoding. Demand, capacity and utilization are told apart by FORM,
 *    not only hue — previously a shift's capacity and utilization lines shared
 *    a colour and differed only in dash pattern, which read as one series.
 */

import { shiftHex, shiftDotShape, type DotShape } from "@/lib/utils/shift-colors";
import type { LegendItem, LegendRow } from "@/components/shared/chart-legend";

export const SERIES_KEY = {
  demand: "role:demand",
  capacity: "role:capacity",
  utilization: "role:utilization",
  forecast: "role:forecast",
  lens: "role:lens",
  secondary: "role:secondary",
  gap: "role:gap",
} as const;

export function shiftKey(code: string): string {
  return `shift:${code}`;
}

export function customerKey(name: string): string {
  return `customer:${name}`;
}

/** Capacity lines: dashed, heavier, no dots. */
export const CAPACITY_LINE = {
  strokeWidth: 2.5,
  strokeDasharray: "6 3",
} as const;

/** Utilization lines: solid, lighter hue, a per-shift dot shape. */
export const UTILIZATION_LINE = {
  strokeWidth: 2,
  dotRadius: 3.5,
} as const;

/** Swatch colour for a role entry that covers several coloured series. */
const ROLE_NEUTRAL = "#94a3b8";

/** Legend shift labels read as plurals — "Days", "Swings", "Nights". */
function pluralizeShift(name: string): string {
  return name.endsWith("s") ? name : `${name}s`;
}

/**
 * Build the two legend rows shared by the capacity charts: entities (shifts,
 * or customers in By Customer mode) on top, series roles + overlays below.
 * Toggling an entity hides every series drawn for it; toggling a role hides
 * that role across all entities.
 */
export function buildCapacityLegendRows(opts: {
  viewMode: "byShift" | "byCustomer" | "total" | "gap";
  activeShifts: { code: string; name: string }[];
  allCustomers?: string[];
  getCustomerColor?: (name: string) => string;
  isHidden: (...keys: (string | null | undefined)[]) => boolean;
  lens?: { name: string; stroke: string; dash: string } | null;
  secondary?: { name: string; stroke: string } | null;
  showForecast?: boolean;
  /** Override the demand entry label (e.g. "Avg Demand", "Projected") */
  demandLabel?: string;
  /** Override the capacity entry label (e.g. "Avg Capacity") */
  capacityLabel?: string;
  /** Charts without a utilization axis (weekly pattern) pass false */
  includeUtilization?: boolean;
  /** Demand colour for the single-series `total` mode */
  totalDemandColor?: string;
}): LegendRow[] {
  const {
    viewMode,
    activeShifts,
    allCustomers = [],
    getCustomerColor,
    isHidden,
    lens,
    secondary,
    showForecast,
    demandLabel = "Demand",
    capacityLabel = "Capacity",
    includeUtilization = true,
    totalDemandColor = "#3b82f6",
  } = opts;

  const entities: LegendItem[] = [];
  const series: LegendItem[] = [];
  const firstShift = activeShifts[0]?.code ?? "";

  if (viewMode === "byCustomer" && getCustomerColor) {
    for (const customer of allCustomers) {
      entities.push({
        key: customerKey(customer),
        label: customer,
        color: getCustomerColor(customer),
        mark: "bar",
        hidden: isHidden(customerKey(customer)),
      });
    }
  } else if (viewMode !== "total") {
    for (const shift of activeShifts) {
      entities.push({
        key: shiftKey(shift.code),
        label: pluralizeShift(shift.name),
        color: shiftHex(shift.code),
        mark: "bar",
        hidden: isHidden(shiftKey(shift.code)),
      });
    }
  }

  // The demand bars ARE the entity entries above — only label demand
  // separately when there is no entity row (total mode).
  const needsDemandEntry = entities.length === 0;

  if (viewMode === "gap") {
    if (needsDemandEntry) {
      series.push({
        key: SERIES_KEY.gap,
        label: "Surplus / Deficit",
        color: shiftHex(firstShift),
        mark: "bar",
        hidden: isHidden(SERIES_KEY.gap),
      });
    }
  } else {
    if (needsDemandEntry) {
      series.push({
        key: SERIES_KEY.demand,
        label: demandLabel,
        color: totalDemandColor,
        mark: "bar",
        hidden: isHidden(SERIES_KEY.demand),
      });
    }
    series.push({
      key: SERIES_KEY.capacity,
      label: capacityLabel,
      // A role entry spans every entity, so it takes a neutral swatch unless
      // there is only one series of that role (total mode).
      color: needsDemandEntry ? "#6366f1" : ROLE_NEUTRAL,
      mark: "dashed",
      hidden: isHidden(SERIES_KEY.capacity),
    });
    if (includeUtilization) {
      series.push({
        key: SERIES_KEY.utilization,
        label: "Utilization",
        color: needsDemandEntry ? "#f97316" : ROLE_NEUTRAL,
        mark: "solid",
        dotShape: needsDemandEntry ? "circle" : shiftDotShape(firstShift),
        hidden: isHidden(SERIES_KEY.utilization),
      });
    }

    if (showForecast) {
      series.push({
        key: SERIES_KEY.forecast,
        label: "Forecast (8-wk rolling)",
        color: "#10b981",
        mark: "dashed",
        hidden: isHidden(SERIES_KEY.forecast),
      });
    }
    if (lens) {
      series.push({
        key: SERIES_KEY.lens,
        label: lens.name,
        color: lens.stroke,
        mark: lens.dash ? "dashed" : "solid",
        hidden: isHidden(SERIES_KEY.lens),
      });
    }
    if (secondary) {
      series.push({
        key: SERIES_KEY.secondary,
        label: `${secondary.name} (compare)`,
        color: secondary.stroke,
        mark: "dashed",
        hidden: isHidden(SERIES_KEY.secondary),
      });
    }
  }

  return [
    { id: "entities", items: entities },
    { id: "series", items: series },
  ];
}

/**
 * Recharts dot renderer that draws a per-shift shape (circle / square /
 * triangle). This is the secondary encoding that keeps the utilization lines
 * separable without relying on hue alone.
 */
export function shiftDotRenderer(
  shape: DotShape,
  color: string,
  radius: number = UTILIZATION_LINE.dotRadius,
) {
  const Dot = (props: { cx?: number; cy?: number }) => {
    const { cx, cy } = props;
    if (cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return null;
    if (shape === "square") {
      return (
        <rect x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} fill={color} />
      );
    }
    if (shape === "triangle") {
      const h = radius * 1.6;
      return (
        <polygon
          points={`${cx},${cy - h} ${cx + radius * 1.3},${cy + radius} ${cx - radius * 1.3},${cy + radius}`}
          fill={color}
        />
      );
    }
    return <circle cx={cx} cy={cy} r={radius} fill={color} />;
  };
  return Dot;
}
