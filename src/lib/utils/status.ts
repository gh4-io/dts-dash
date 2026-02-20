/**
 * Work package status utilities.
 *
 * Only "Canceled" requires special handling (spelling variants from SharePoint).
 * All other statuses are plain strings and pass through as-is.
 */

import { normalizeString } from "./strings";

/**
 * Check if a status value represents a canceled work package.
 * Handles both American ("Canceled") and British ("Cancelled") spellings,
 * case-insensitive.
 */
export function isCanceled(status: string | null | undefined): boolean {
  const normalized = normalizeString(status).toLowerCase();
  return normalized === "canceled" || normalized === "cancelled";
}
