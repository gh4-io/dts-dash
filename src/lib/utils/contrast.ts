/**
 * WCAG 2.1 contrast utilities for accessible text on colored backgrounds.
 */

/** Validates #rrggbb hex format */
export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/** Relative luminance per WCAG 2.1 (sRGB linearization) */
export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two hex colors */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns "#ffffff" or "#000000" based on which gives better contrast */
export function getContrastText(bgHex: string): string {
  const whiteContrast = contrastRatio(bgHex, "#ffffff");
  const blackContrast = contrastRatio(bgHex, "#000000");
  return whiteContrast >= blackContrast ? "#ffffff" : "#000000";
}

/** Returns WCAG level: "AAA" (>=7), "AA" (>=4.5), or "Fail" */
export function getWCAGLevel(bgHex: string, fgHex: string): "AAA" | "AA" | "Fail" {
  const ratio = contrastRatio(bgHex, fgHex);
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return "Fail";
}
