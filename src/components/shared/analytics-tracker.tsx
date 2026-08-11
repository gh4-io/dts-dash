"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useFilters } from "@/lib/hooks/use-filters";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { trackPageView, trackFilterChange } from "@/lib/analytics/track";
import type { FilterState } from "@/types";

/**
 * Central usage-analytics listener for the authenticated area.
 * Mounted once in the authenticated layout — renders nothing.
 *
 * Emits `page_view` on navigation and `filter_change` when the global filter
 * state settles on a new value. Per-action events (`csv_export`, `data_import`,
 * `gantt_bar_click`, `print`) are fired from their own call sites.
 *
 * See .claude/SPECS/REQ_Analytics.md §3–§4 for the event catalog.
 */

/** Filter fields worth reporting — excludes the store's internal `_urlSynced` flag. */
const TRACKED_FIELDS = [
  "start",
  "end",
  "timezone",
  "operators",
  "aircraft",
  "types",
  "excludeOperators",
  "excludeAircraft",
  "excludeTypes",
] as const satisfies readonly (keyof FilterState)[];

type TrackedField = (typeof TRACKED_FIELDS)[number];

/**
 * How long the filter state must sit still before a change is reported.
 * Longer than the 300ms store→URL debounce in useFilterUrlSync, so a single
 * user edit produces exactly one event rather than one per keystroke.
 */
const SETTLE_MS = 500;

function snapshot(state: FilterState): Record<TrackedField, string> {
  return TRACKED_FIELDS.reduce(
    (acc, field) => {
      const value = state[field];
      acc[field] = Array.isArray(value) ? value.join(",") : value;
      return acc;
    },
    {} as Record<TrackedField, string>,
  );
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const urlSynced = useFilters((s) => s._urlSynced);
  const prefsLoaded = usePreferences((s) => s.loaded);
  const lastPageRef = useRef<string | null>(null);

  // ─── page_view ────────────────────────────────────────────────────────────
  // One event per pathname. The ref guard also absorbs StrictMode's double
  // mount, which would otherwise double-count every navigation in dev.
  useEffect(() => {
    if (!pathname || lastPageRef.current === pathname) return;
    const referrer = lastPageRef.current;
    lastPageRef.current = pathname;
    trackPageView(pathname, referrer ? { referrer } : undefined);
  }, [pathname]);

  // ─── filter_change ────────────────────────────────────────────────────────
  // Two hydration paths write to the filter store on load: useFilterUrlSync
  // (URL → store, flags `_urlSynced`) and PreferencesLoader (saved defaults →
  // store, gated on preferences `loaded`). Neither is a user action, so we stay
  // idle until both have landed, then take a baseline and report only diffs
  // against it. Reverting a value back to the baseline emits nothing.
  useEffect(() => {
    if (!urlSynced || !prefsLoaded) return;

    let baseline: Record<TrackedField, string> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    // Let the hydration writes finish before the baseline is taken.
    const armTimer = setTimeout(() => {
      baseline = snapshot(useFilters.getState());
    }, SETTLE_MS);

    const unsubscribe = useFilters.subscribe(() => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const previous = baseline;
        if (!previous) return;
        const current = snapshot(useFilters.getState());
        const changed = TRACKED_FIELDS.filter((f) => current[f] !== previous[f]);
        if (changed.length === 0) return;
        baseline = current;
        // `field` names what moved; the settled values give the resulting scope.
        trackFilterChange({
          // lastPageRef is kept current by the page_view effect above; reading
          // `pathname` here would close over a stale value.
          page: lastPageRef.current,
          field: changed.join(","),
          ...changed.reduce<Record<string, string>>((acc, f) => {
            acc[f] = current[f];
            return acc;
          }, {}),
        });
      }, SETTLE_MS);
    });

    return () => {
      clearTimeout(armTimer);
      if (settleTimer) clearTimeout(settleTimer);
      unsubscribe();
    };
  }, [urlSynced, prefsLoaded]);

  return null;
}
