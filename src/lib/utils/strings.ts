/**
 * Generic string normalization utilities.
 */

/**
 * Trim whitespace from a string. Returns empty string for null/undefined.
 */
export function normalizeString(raw: string | null | undefined): string {
  if (raw == null) return "";
  return raw.trim();
}
