"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useFilters } from "./use-filters";
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

    const params: Record<string, unknown> = {};
    if (urlStart) params.start = urlStart;
    if (urlEnd) params.end = urlEnd;
    if (urlTz) params.timezone = urlTz;
    if (urlOp) params.operators = urlOp.split(",").filter(Boolean);
    if (urlAc) params.aircraft = urlAc.split(",").filter(Boolean);
    if (urlType)
      params.types = urlType.split(",").filter(Boolean) as AircraftType[];

    if (Object.keys(params).length > 0) {
      hydrate(params as Record<string, never>);
    }
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
      const params = new URLSearchParams();

      if (start) params.set("start", start);
      if (end) params.set("end", end);
      if (timezone && timezone !== "UTC") params.set("tz", timezone);
      if (operators.length > 0) params.set("op", operators.join(","));
      if (aircraft.length > 0) params.set("ac", aircraft.join(","));
      if (types.length > 0) params.set("type", types.join(","));

      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      router.replace(url, { scroll: false });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [start, end, timezone, operators, aircraft, types, pathname, router]);
}
