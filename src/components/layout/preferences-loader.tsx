"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePreferences } from "@/lib/hooks/use-preferences";

/**
 * Loads user preferences from API once authenticated.
 * Placed in the root layout so it runs on every page.
 */
export function PreferencesLoader() {
  const { data: session } = useSession();
  const { fetch: fetchPrefs, loaded } = usePreferences();

  useEffect(() => {
    if (session?.user && !loaded) {
      fetchPrefs();
    }
  }, [session, loaded, fetchPrefs]);

  return null;
}
