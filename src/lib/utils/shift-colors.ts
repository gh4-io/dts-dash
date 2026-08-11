/**
 * Shift palette — single source of truth (D-065).
 *
 * Day / Swing / Night hues were previously copy-pasted into six components, in
 * two forms (hex for charts, Tailwind classes for icons and labels). They had
 * drifted and, worse, Day (#f59e0b) and Swing (#f97316) were two near-identical
 * oranges that could not be told apart on the Demand vs Capacity chart.
 *
 * The chart hues below pass the categorical palette checks (lightness band,
 * chroma floor, CVD separation, normal-vision floor, contrast) against both the
 * light and dark chart surfaces. Worst-case tritan separation sits in the
 * 6–8 floor band, which is legal because shift identity is always carried by a
 * second channel as well — the per-shift icon, the legend label and, on the
 * utilization lines, a per-shift dot shape.
 *
 * Change a hue HERE and it moves everywhere: charts, heatmap, pies, drilldown
 * drawer and the admin grids.
 */

export type ShiftCode = "DAY" | "SWING" | "NIGHT";

/** Primary chart hue per shift — bars and capacity lines. */
export const SHIFT_HEX: Record<string, string> = {
  DAY: "#d97706",
  SWING: "#ec4899",
  NIGHT: "#6366f1",
};

/**
 * Lightened variant of the same hue, used for utilization lines so that a
 * shift's two lines differ in value as well as in line style.
 */
export const SHIFT_HEX_SOFT: Record<string, string> = {
  DAY: "#fbbf24",
  SWING: "#f472b6",
  NIGHT: "#818cf8",
};

/** Tailwind text colour matching SHIFT_HEX — icons and labels. */
export const SHIFT_TEXT: Record<string, string> = {
  DAY: "text-amber-500",
  SWING: "text-pink-500",
  NIGHT: "text-indigo-400",
};

/** Font Awesome icon per shift. */
export const SHIFT_ICON: Record<string, string> = {
  DAY: "fa-sun",
  SWING: "fa-cloud-sun",
  NIGHT: "fa-moon",
};

export type DotShape = "circle" | "square" | "triangle";

/**
 * Dot shape per shift — the secondary encoding that keeps shifts
 * distinguishable for colour-vision-deficient readers and in print.
 */
export const SHIFT_DOT_SHAPE: Record<string, DotShape> = {
  DAY: "circle",
  SWING: "square",
  NIGHT: "triangle",
};

/** Neutral fallback for an unrecognised shift code. */
export const SHIFT_HEX_FALLBACK = "#6b7280";

export function shiftHex(code: string): string {
  return SHIFT_HEX[code] ?? SHIFT_HEX_FALLBACK;
}

export function shiftHexSoft(code: string): string {
  return SHIFT_HEX_SOFT[code] ?? SHIFT_HEX_FALLBACK;
}

export function shiftText(code: string): string {
  return SHIFT_TEXT[code] ?? "text-muted-foreground";
}

export function shiftIcon(code: string): string {
  return SHIFT_ICON[code] ?? "fa-clock";
}

export function shiftDotShape(code: string): DotShape {
  return SHIFT_DOT_SHAPE[code] ?? "circle";
}
