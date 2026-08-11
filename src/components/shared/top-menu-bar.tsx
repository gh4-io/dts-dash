"use client";

import { useMemo, useEffect } from "react";
import { useFilterUrlSync } from "@/lib/hooks/use-filter-url-sync";
import { useFilters } from "@/lib/hooks/use-filters";
import { useActions, ACTION_COLUMNS, type ColumnFilterRule } from "@/lib/hooks/use-actions";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useWorkPackagesStore } from "@/lib/hooks/use-work-packages";
import { getTimelineFromWindow } from "@/lib/utils/timeline-defaults";
import { DateTimePicker } from "./datetime-picker";
import { ActionsMenu } from "./actions-menu";
import { ActiveChips, type ActiveChip } from "./active-chips";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReactNode } from "react";
import type { AircraftType } from "@/types";

/**
 * Pins the timezone on pages whose data is computed on a fixed clock rather
 * than the viewer's display preference (OI-119). The selector is shown locked
 * with `reason` as its tooltip, and the date pickers follow `timezone` so the
 * window you type matches the window that is computed.
 */
export interface TimezoneLock {
  /** IANA zone the page's data is actually bucketed on */
  timezone: string;
  /** Why the display selector does not apply on this page */
  reason: string;
}

interface TopMenuBarProps {
  title: string;
  icon: string;
  actions?: ReactNode;
  formatChips?: ActiveChip[];
  timezoneLock?: TimezoneLock | null;
}

/** Get a column label by key */
function colLabel(key: string): string {
  return ACTION_COLUMNS.find((c) => c.key === key)?.label ?? key;
}

/** Format a ColumnFilterRule into a chip label */
function formatColumnFilterChip(cf: ColumnFilterRule): string {
  const col = colLabel(cf.column);
  if (cf.operator === "in" || cf.operator === "not in") {
    return `${col} ${cf.operator} (${cf.values.length})`;
  }
  return `${col} ${cf.operator} ${cf.value}`;
}

export function TopMenuBar({
  title,
  icon,
  actions,
  formatChips = [],
  timezoneLock = null,
}: TopMenuBarProps) {
  useFilterUrlSync();

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
    setStart,
    setEnd,
    setTimezone,
    setOperators,
    setAircraft,
    setTypes,
    setExcludeOperators,
    setExcludeAircraft,
    setExcludeTypes,
  } = useFilters();

  const {
    sorts,
    controlBreaks,
    highlights,
    groupBy,
    columnFilters,
    removeSortLevel,
    disableBreak,
    disableHighlight,
    clearGroupBy,
    removeColumnFilter,
    resetAll,
  } = useActions();

  const { customers, fetch: fetchCustomers } = useCustomers();
  const fetchFacets = useWorkPackagesStore((s) => s.fetchFacets);

  // A locked page ignores the stored display preference outright — showing one
  // zone in the pickers while computing another is the defect OI-119 filed.
  const shownTimezone = timezoneLock?.timezone ?? timezone;

  // Ensure customers are loaded (previously handled by FilterDropdown)
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Load the filter option lists. The TopMenuBar is on every page, so doing it
  // here is what makes the Columns filter dialog usable outside the two pages
  // that fetch work packages — the capacity page had no operator values at all.
  useEffect(() => {
    fetchFacets({ ...(start && { start }), ...(end && { end }) });
  }, [fetchFacets, start, end]);

  // Build a lookup for operator colors
  const customerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      map.set(c.name, c.color);
    }
    return map;
  }, [customers]);

  // Build a lookup for operator display names
  const customerDisplayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      map.set(c.name, c.displayName);
    }
    return map;
  }, [customers]);

  // System default timezone for chip comparison
  const defaultTz = useMemo(() => getTimelineFromWindow().defaultTimezone, []);

  // Build active chips from filter state + actions state + page-provided format chips
  const chips = useMemo<ActiveChip[]>(() => {
    const result: ActiveChip[] = [];

    // Timezone chip — disabled due to graphical preference (value visible in TZ selector above)
    // To re-enable: uncomment and chip will only show when user changes from system default
    // if (timezone && timezone !== defaultTz) {
    //   const label = timezone === "UTC" ? "UTC" : "Eastern";
    //   result.push({
    //     id: "tz",
    //     label,
    //     icon: "fa-solid fa-clock",
    //     onRemove: () => setTimezone(defaultTz),
    //   });
    // }

    // Operator chips
    for (const op of operators) {
      result.push({
        id: `op-${op}`,
        label: customerDisplayMap.get(op) ?? op,
        icon: "fa-solid fa-building",
        color: customerColorMap.get(op),
        onRemove: () => setOperators(operators.filter((o) => o !== op)),
      });
    }

    // Operator exclusion chips
    for (const op of excludeOperators) {
      result.push({
        id: `nop-${op}`,
        label: `\u2260 ${customerDisplayMap.get(op) ?? op}`,
        icon: "fa-solid fa-building",
        color: customerColorMap.get(op),
        onRemove: () => setExcludeOperators(excludeOperators.filter((o) => o !== op)),
      });
    }

    // Aircraft chips
    for (const ac of aircraft) {
      result.push({
        id: `ac-${ac}`,
        label: ac,
        icon: "fa-solid fa-plane",
        onRemove: () => setAircraft(aircraft.filter((a) => a !== ac)),
      });
    }

    // Aircraft exclusion chips
    for (const ac of excludeAircraft) {
      result.push({
        id: `nac-${ac}`,
        label: `\u2260 ${ac}`,
        icon: "fa-solid fa-plane",
        onRemove: () => setExcludeAircraft(excludeAircraft.filter((a) => a !== ac)),
      });
    }

    // Type chips
    for (const t of types) {
      result.push({
        id: `type-${t}`,
        label: t,
        icon: "fa-solid fa-plane-circle-check",
        onRemove: () => setTypes(types.filter((ty) => ty !== t) as AircraftType[]),
      });
    }

    // Type exclusion chips
    for (const t of excludeTypes) {
      result.push({
        id: `ntype-${t}`,
        label: `\u2260 ${t}`,
        icon: "fa-solid fa-plane-circle-check",
        onRemove: () => setExcludeTypes(excludeTypes.filter((ty) => ty !== t)),
      });
    }

    // Column filter chips (from actions)
    for (const cf of columnFilters) {
      const label = formatColumnFilterChip(cf);
      result.push({
        id: `cf-${cf.id}`,
        label,
        icon: "fa-solid fa-filter",
        onRemove: () => removeColumnFilter(cf.id),
      });
    }

    // Sort chips
    sorts.forEach((s, idx) => {
      result.push({
        id: `sort-${idx}`,
        label: `Sort: ${colLabel(s.column)} ${s.direction.toUpperCase()}`,
        icon: "fa-solid fa-arrow-down-short-wide",
        onRemove: () => removeSortLevel(idx),
      });
    });

    // Control break chips
    controlBreaks
      .filter((b) => b.enabled)
      .forEach((b) => {
        result.push({
          id: `break-${b.column}`,
          label: `Break: ${colLabel(b.column)}`,
          icon: "fa-solid fa-grip-lines",
          onRemove: () => disableBreak(b.column),
        });
      });

    // Highlight chips
    highlights
      .filter((h) => h.enabled)
      .forEach((h) => {
        result.push({
          id: `hl-${h.id}`,
          label: `${colLabel(h.column)} ${h.operator} ${h.value}`,
          color: h.color,
          onRemove: () => disableHighlight(h.id),
        });
      });

    // Group by chip
    if (groupBy && groupBy.columns.length > 0) {
      result.push({
        id: "groupby",
        label: `Group: ${groupBy.columns.map(colLabel).join(", ")}`,
        icon: "fa-solid fa-layer-group",
        onRemove: clearGroupBy,
      });
    }

    // Page-specific format chips
    result.push(...formatChips);

    return result;
  }, [
    operators,
    aircraft,
    types,
    excludeOperators,
    excludeAircraft,
    excludeTypes,
    columnFilters,
    sorts,
    controlBreaks,
    highlights,
    groupBy,
    formatChips,
    customerColorMap,
    customerDisplayMap,
    setOperators,
    setAircraft,
    setTypes,
    setExcludeOperators,
    setExcludeAircraft,
    setExcludeTypes,
    removeSortLevel,
    disableBreak,
    disableHighlight,
    clearGroupBy,
    removeColumnFilter,
  ]);

  const handleClearAll = () => {
    setOperators([]);
    setAircraft([]);
    setTypes([]);
    setExcludeOperators([]);
    setExcludeAircraft([]);
    setExcludeTypes([]);
    setTimezone(defaultTz);
    resetAll();
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Page Title (standalone) */}
      <div>
        <h1 className="text-2xl font-bold">
          <i className={`${icon} mr-2.5`} />
          {title}
        </h1>
        <p className="print-only text-xs text-muted-foreground mt-1" suppressHydrationWarning>
          Printed {new Date().toLocaleString()}
        </p>
      </div>

      {/* Row 2: Filter Controls */}
      <div className="flex items-center gap-2 print-hide">
        {/* Date pickers — desktop only */}
        <div className="hidden md:flex items-center gap-2">
          <DateTimePicker
            value={start}
            onChange={setStart}
            label="Start"
            icon="fa-solid fa-calendar"
            timezone={shownTimezone}
          />
          <DateTimePicker
            value={end}
            onChange={setEnd}
            label="End"
            icon="fa-solid fa-calendar-check"
            timezone={shownTimezone}
          />
        </div>

        {/* Actions menu — between dates and TZ */}
        <ActionsMenu />

        {/* Timezone select — desktop only */}
        <div className="hidden md:block" title={timezoneLock?.reason}>
          <Select value={shownTimezone} onValueChange={setTimezone} disabled={!!timezoneLock}>
            <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs">
              <i
                className={`fa-solid mr-1.5 text-muted-foreground ${
                  timezoneLock ? "fa-lock" : "fa-clock"
                }`}
              />
              <span className="mr-1 text-muted-foreground">TZ:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">Eastern</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Spacer */}
        <div className="ml-auto" />

        {/* Actions slot (e.g. view toggle, Refresh button) */}
        {actions}
      </div>

      {/* Row 3: Active chips */}
      <div className="print-hide">
        <ActiveChips chips={chips} onClearAll={handleClearAll} />
      </div>
    </div>
  );
}
