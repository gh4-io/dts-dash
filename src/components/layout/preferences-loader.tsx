"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useFilters } from "@/lib/hooks/use-filters";

/**
 * Loads user preferences from API once authenticated.
 * Applies defaultDateRange + defaultTimezone to filter store on first load
 * (unless the URL already provided explicit date params).
 * Placed in the root layout so it runs on every page.
 */
export function PreferencesLoader() {
  const { data: session } = useSession();
  const { fetch: fetchPrefs, loaded, defaultDateRange, defaultTimezone } = usePreferences();
  const appliedRef = useRef(false);

  // Capture initial URL params at mount time, before useFilterUrlSync
  // modifies the URL with UTC-computed defaults after 100ms
  const initialUrlRef = useRef(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams()
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

    useFilters.getState().hydrateDefaults(defaultDateRange, defaultTimezone);
  }, [loaded, defaultDateRange, defaultTimezone]);

  return null;
}
