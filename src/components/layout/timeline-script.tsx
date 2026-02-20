import { getTimelineDefaults } from "@/lib/config/loader";

/**
 * Inline script injected into <head> to provide YAML timeline defaults
 * to client-side Zustand stores synchronously (before React hydration).
 * Same pattern as ThemeScript for FOUC prevention.
 */
export function TimelineScript() {
  const tl = getTimelineDefaults();
  const payload = JSON.stringify({
    startOffset: tl.startOffset,
    endOffset: tl.endOffset,
    defaultZoom: tl.defaultZoom,
    defaultCompact: tl.defaultCompact,
    defaultTimezone: tl.defaultTimezone,
  });
  const script = `window.__TIMELINE_DEFAULTS__=${payload};`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
