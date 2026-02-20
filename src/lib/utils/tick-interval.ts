/**
 * Pixel-based time tick interval computation for Gantt chart axes.
 *
 * Selects the finest "nice" interval whose pixel spacing meets a minimum
 * threshold, ensuring labels never overlap regardless of screen width.
 */

/** Allowed tick intervals in milliseconds, ordered finest → coarsest */
export const ALLOWED_INTERVALS_MS = [
  15 * 60_000,     //  15 min
  30 * 60_000,     //  30 min
  1 * 3_600_000,   //   1 h
  2 * 3_600_000,   //   2 h
  3 * 3_600_000,   //   3 h
  6 * 3_600_000,   //   6 h
  12 * 3_600_000,  //  12 h
  24 * 3_600_000,  //  24 h
  48 * 3_600_000,  //  48 h
] as const;

export const MIN_INTERVAL_MS = ALLOWED_INTERVALS_MS[0];                          // 15 min
export const MAX_INTERVAL_MS = ALLOWED_INTERVALS_MS[ALLOWED_INTERVALS_MS.length - 1]; // 48 h
export const DEFAULT_TARGET_MIN_PX = 60;

export interface TickIntervalOptions {
  /** Available pixel width of the chart grid area (container minus padding) */
  availablePixels: number;
  /** Visible time window in milliseconds */
  visibleMs: number;
  /** Minimum allowed interval in ms (default: 15 min) */
  minIntervalMs?: number;
  /** Maximum allowed interval in ms (default: 48 h) */
  maxIntervalMs?: number;
  /** Minimum comfortable pixel spacing between ticks (default: 60) */
  targetMinPx?: number;
}

/**
 * Compute the best "nice" tick interval for a time axis given pixel constraints.
 *
 * Algorithm:
 * 1. Filter allowed intervals to [minIntervalMs, maxIntervalMs]
 * 2. Walk finest → coarsest, computing pixel spacing for each
 * 3. Return the first interval whose spacing >= targetMinPx
 * 4. If none qualifies, return the coarsest allowed
 *
 * @returns interval in milliseconds
 */
export function computeTickInterval(options: TickIntervalOptions): number {
  const {
    availablePixels,
    visibleMs,
    minIntervalMs = MIN_INTERVAL_MS,
    maxIntervalMs = MAX_INTERVAL_MS,
    targetMinPx = DEFAULT_TARGET_MIN_PX,
  } = options;

  // Guard: if no visible range or no pixels, return a safe default
  if (visibleMs <= 0 || availablePixels <= 0) {
    return 6 * 3_600_000; // 6h fallback
  }

  // Filter allowed intervals to the configured [min, max] range
  const candidates = ALLOWED_INTERVALS_MS.filter(
    (ms) => ms >= minIntervalMs && ms <= maxIntervalMs
  );

  if (candidates.length === 0) {
    return minIntervalMs;
  }

  // Walk finest → coarsest, pick the first that meets minimum spacing
  for (const interval of candidates) {
    const pxSpacing = (interval / visibleMs) * availablePixels;
    if (pxSpacing >= targetMinPx) {
      return interval;
    }
  }

  // No candidate met minimum — use the coarsest allowed
  return candidates[candidates.length - 1];
}
