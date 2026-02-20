"use client";

import { useMemo } from "react";
import { useActions } from "./use-actions";
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
}

/**
 * Hook that applies all action transforms to incoming work packages.
 * Pipeline: columnFilters → sort → registrations → controlBreaks → groupBy → highlights
 */
export function useTransformedData(
  workPackages: SerializedWorkPackage[]
): TransformedData {
  const { sorts, controlBreaks, highlights, groupBy, columnFilters } =
    useActions();

  return useMemo(() => {
    // 1. Column filters (client-side)
    const filtered = applyColumnFilters(workPackages, columnFilters);

    // 2. Sort
    const sorted = applySorts(filtered, sorts);

    // 3. Build registrations from sorted data
    const regSet = new Set<string>();
    sorted.forEach((wp) => regSet.add(wp.aircraftReg));
    let regs = Array.from(regSet);

    // 4. Control breaks
    const { registrations: breakRegs, breakLabels } = applyControlBreaks(
      regs,
      sorted,
      controlBreaks
    );
    regs = breakRegs;

    // 5. Group by
    const groups = applyGroupBy(regs, sorted, groupBy);

    // 6. Highlights
    const highlightMap = applyHighlights(sorted, highlights);

    return {
      data: sorted,
      registrations: regs,
      breakLabels,
      highlightMap,
      groups,
    };
  }, [workPackages, sorts, controlBreaks, highlights, groupBy, columnFilters]);
}

export { BREAK_PREFIX };
