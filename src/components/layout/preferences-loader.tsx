"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useFilters } from "@/lib/hooks/use-filters";

/**
 * Loads user preferences from API once authenticated.
 * Applies date range + timezone to filter store on first load using
 * user preferences (symmetric preset) or system config offsets (asymmetric).
 * URL params take precedence over all defaults.
 * Placed in the root layout so it runs on every page.
 */
export function PreferencesLoader() {
  const { data: session } = useSession();
  const {
    fetch: fetchPrefs,
    loaded,
    defaultDateRange,
    defaultStartOffset,
    defaultEndOffset,
    defaultTimezone,
  } = usePreferences();
  const appliedRef = useRef(false);

  // Capture initial URL params at mount time, before useFilterUrlSync
  // modifies the URL with UTC-computed defaults after 100ms
  const initialUrlRef = useRef(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams(),
  );

  useEffect(() => {
    if (session?.user && !loaded) {
      fetchPrefs();
    }
  }, [session, loaded, fetchPrefs]);

  // Apply user's default date range & timezone to the filter store once
  useEffect(() => {
    if (!loaded || appliedRef.current) return;
    appliedRef.current = true;

    // Skip if the URL already had explicit date params at mount time
    if (initialUrlRef.current.has("start") || initialUrlRef.current.has("end")) return;

    useFilters.getState().hydrateFromPreferences({
      defaultDateRange,
      defaultStartOffset,
      defaultEndOffset,
      defaultTimezone,
    });
  }, [loaded, defaultDateRange, defaultStartOffset, defaultEndOffset, defaultTimezone]);

  return null;
}
