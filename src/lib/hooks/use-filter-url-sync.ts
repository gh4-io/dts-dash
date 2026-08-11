"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useFilters } from "./use-filters";
import { buildFilterUrlParams } from "@/lib/utils/filter-helpers";
import type { AircraftType } from "@/types";

/**
 * Bidirectional URL ↔ Zustand filter sync
 * URL → store on mount; store → URL on change (debounced 300ms)
 */
export function useFilterUrlSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHydrating = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    start,
    end,
    timezone,
    operators,
    aircraft,
    types,
    excludeOperators,
    excludeAircraft,
    excludeTypes,
    hydrate,
  } = useFilters();

  // URL → Store (on mount / navigation)
  useEffect(() => {
    const urlStart = searchParams.get("start");
    const urlEnd = searchParams.get("end");
    const urlTz = searchParams.get("tz");
    const urlOp = searchParams.get("op");
    const urlAc = searchParams.get("ac");
    const urlType = searchParams.get("type");
    // Exclusions — `n` prefix for "not"
    const urlNotOp = searchParams.get("nop");
    const urlNotAc = searchParams.get("nac");
    const urlNotType = searchParams.get("ntype");

    const list = (raw: string | null) => (raw ? raw.split(",").filter(Boolean) : []);

    // start/end/timezone stay merge-only: a bare first load must leave them
    // alone so PreferencesLoader can apply the user's default window.
    const params: Record<string, unknown> = {};
    if (urlStart) params.start = urlStart;
    if (urlEnd) params.end = urlEnd;
    if (urlTz) params.timezone = urlTz;

    // The six selection lists are authoritative: absent from the URL means
    // empty, not "keep whatever the last page left in the store". Without this
    // a selection made on one page silently follows the user everywhere else,
    // including back through the browser's Back arrow.
    params.operators = list(urlOp);
    params.aircraft = list(urlAc);
    params.types = list(urlType) as AircraftType[];
    params.excludeOperators = list(urlNotOp);
    params.excludeAircraft = list(urlNotAc);
    params.excludeTypes = list(urlNotType);

    hydrate(params as Record<string, never>);
    // Signal that URL → store sync is complete so data hooks can fetch
    useFilters.getState()._markUrlSynced();
    // Brief delay before enabling store→URL sync
    setTimeout(() => {
      isHydrating.current = false;
    }, 100);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store → URL (debounced 300ms)
  useEffect(() => {
    if (isHydrating.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Seed from the live URL and overwrite only the filter keys, so params the
      // route itself owns survive. The Focus view carries its subject in
      // `scope`/`subject`; rebuilding from filter state alone would strip them
      // 300ms after arrival and the page would lose what it is focused on.
      // Read from window rather than the `searchParams` hook so this effect does
      // not re-run on its own router.replace.
      const params = buildFilterUrlParams(
        {
          start,
          end,
          timezone,
          operators,
          aircraft,
          types,
          excludeOperators,
          excludeAircraft,
          excludeTypes,
        },
        new URLSearchParams(window.location.search),
      );

      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      router.replace(url, { scroll: false });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    start,
    end,
    timezone,
    operators,
    aircraft,
    types,
    excludeOperators,
    excludeAircraft,
    excludeTypes,
    pathname,
    router,
  ]);
}
