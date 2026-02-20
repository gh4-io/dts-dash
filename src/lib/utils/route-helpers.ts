/**
 * Parse a URL route parameter as a positive integer.
 * Returns null if invalid (NaN, non-integer, or < 1).
 */
export function parseIntParam(value: string): number | null {
  const num = Number(value);
  return isNaN(num) || !Number.isInteger(num) || num < 1 ? null : num;
}
