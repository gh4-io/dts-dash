"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
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
  const { setTheme } = useTheme();
  const {
    fetch: fetchPrefs,
    loaded,
    colorMode,
    defaultDateRange,
    defaultStartOffset,
    defaultEndOffset,
    defaultTimezone,
  } = usePreferences();
  const appliedRef = useRef(false);
  // Tracks the initial DB→theme sync so we don't re-call setTheme on every
  // colorMode Zustand update (the toggle/form already call setTheme directly).
  const themeAppliedRef = useRef(false);

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

  // Sync the user's saved color mode to next-themes exactly once — when
  // preferences are first loaded from the DB. Subsequent changes go through
  // the toggle (header) or PreferencesForm which call setTheme directly,
  // avoiding double-calls that cause the twitchy color-scheme flash.
  useEffect(() => {
    if (loaded && !themeAppliedRef.current) {
      themeAppliedRef.current = true;
      setTheme(colorMode);
    }
    // colorMode and setTheme intentionally omitted: we only want this to fire
    // once on initial load. setTheme is stable (next-themes guarantee) and
    // colorMode changes from user interactions are handled by the toggle/form
    // calling setTheme directly — no re-sync needed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

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
