"use client";

import { useMemo } from "react";
import { useActions } from "./use-actions";
import { useFilters } from "./use-filters";
import type { SerializedWorkPackage } from "./use-work-packages";
import {
  applyColumnFilters,
  applySorts,
  applyControlBreaks,
  applyHighlights,
  applyGroupBy,
  BREAK_PREFIX,
} from "@/lib/utils/data-transforms";

export interface TransformedData {
  /** Filtered + sorted WPs */
  data: SerializedWorkPackage[];
  /** Y-axis registrations (may include break separators) */
  registrations: string[];
  /** Map of separator indices → break label text */
  breakLabels: Map<number, string>;
  /** Map of WP index (in `data`) → highlight hex color */
  highlightMap: Map<number, string>;
  /** Group-by result, or null if not grouping */
  groups: {
    groupedRegistrations: string[];
    wpToGroupIndex: Map<number, number>;
  } | null;
  /** Active shift highlight rules for chart background shading */
  shiftHighlights: { shift: string; color: string }[];
}

/**
 * Hook that applies all action transforms to incoming work packages.
 * Pipeline: columnFilters → sort → registrations → controlBreaks → groupBy → highlights
 */
export function useTransformedData(workPackages: SerializedWorkPackage[]): TransformedData {
  const { sorts, controlBreaks, highlights, groupBy, columnFilters } = useActions();
  const { timezone } = useFilters();

  return useMemo(() => {
    // 1. Column filters (client-side)
    const filtered = applyColumnFilters(workPackages, columnFilters, timezone);

    // 2. Sort
    const sorted = applySorts(filtered, sorts, timezone);

    // 3. Build registrations from sorted data
    const regSet = new Set<string>();
    sorted.forEach((wp) => regSet.add(wp.aircraftReg));
    let regs = Array.from(regSet);

    // 4. Control breaks
    const { registrations: breakRegs, breakLabels } = applyControlBreaks(
      regs,
      sorted,
      controlBreaks,
      timezone,
    );
    regs = breakRegs;

    // 5. Group by
    const groups = applyGroupBy(regs, sorted, groupBy, timezone);

    // 6. Highlights (shift rules are skipped here — they control chart backgrounds)
    const highlightMap = applyHighlights(sorted, highlights, timezone);

    // 7. Extract active shift highlight rules for chart background shading
    const shiftHighlights = highlights
      .filter((r) => r.enabled && r.column === "shift" && r.operator === "=" && r.value)
      .map((r) => ({ shift: r.value, color: r.color }));

    return {
      data: sorted,
      registrations: regs,
      breakLabels,
      highlightMap,
      groups,
      shiftHighlights,
    };
  }, [workPackages, sorts, controlBreaks, highlights, groupBy, columnFilters, timezone]);
}

export { BREAK_PREFIX };
