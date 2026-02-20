/**
 * Read YAML timeline defaults injected by TimelineScript into <head>.
 * Shared by use-filters.ts and use-preferences.ts so the fallback
 * values are defined in exactly one place.
 *
 * At runtime the window global is always present (TimelineScript runs
 * before React hydration). The hardcoded fallback only fires during
 * SSR or if the script tag is somehow missing.
 */

export interface TimelineWindowDefaults {
  startOffset: number;
  endOffset: number;
  defaultZoom: string;
  defaultCompact: boolean;
  defaultTimezone: string;
}

// Hardcoded last-resort fallback — must match DEFAULT_TIMELINE in loader.ts
const FALLBACK: TimelineWindowDefaults = {
  startOffset: -0.5,
  endOffset: 2.5,
  defaultZoom: "3d",
  defaultCompact: false,
  defaultTimezone: "America/New_York",
};

export function getTimelineFromWindow(): TimelineWindowDefaults {
  if (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__TIMELINE_DEFAULTS__
  ) {
    return (window as unknown as Record<string, unknown>)
      .__TIMELINE_DEFAULTS__ as TimelineWindowDefaults;
  }
  return FALLBACK;
}
