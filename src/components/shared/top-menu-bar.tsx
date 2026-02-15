"use client";

import { useMemo, useEffect } from "react";
import { useFilterUrlSync } from "@/lib/hooks/use-filter-url-sync";
import { useFilters } from "@/lib/hooks/use-filters";
import { useActions, ACTION_COLUMNS, type ColumnFilterRule } from "@/lib/hooks/use-actions";
import { useCustomers } from "@/lib/hooks/use-customers";
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

interface TopMenuBarProps {
  title: string;
  icon: string;
  actions?: ReactNode;
  formatChips?: ActiveChip[];
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
}: TopMenuBarProps) {
  useFilterUrlSync();

  const {
    start,
    end,
    timezone,
    operators,
    aircraft,
    types,
    setStart,
    setEnd,
    setTimezone,
    setOperators,
    setAircraft,
    setTypes,
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

  // Ensure customers are loaded (previously handled by FilterDropdown)
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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

  // Build active chips from filter state + actions state + page-provided format chips
  const chips = useMemo<ActiveChip[]>(() => {
    const result: ActiveChip[] = [];

    // Date range chip (non-removable, informational)
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const fmt = (d: Date) =>
        d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
      result.push({
        id: "date-range",
        label: `${fmt(s)} \u2013 ${fmt(e)}`,
        icon: "fa-solid fa-calendar",
      });
    }

    // Timezone chip (removable — resets to UTC)
    if (timezone && timezone !== "UTC") {
      result.push({
        id: "tz",
        label: "Eastern",
        icon: "fa-solid fa-clock",
        onRemove: () => setTimezone("UTC"),
      });
    }

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

    // Aircraft chips
    for (const ac of aircraft) {
      result.push({
        id: `ac-${ac}`,
        label: ac,
        icon: "fa-solid fa-plane",
        onRemove: () => setAircraft(aircraft.filter((a) => a !== ac)),
      });
    }

    // Type chips
    for (const t of types) {
      result.push({
        id: `type-${t}`,
        label: t,
        icon: "fa-solid fa-plane-circle-check",
        onRemove: () =>
          setTypes(types.filter((ty) => ty !== t) as AircraftType[]),
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
    start,
    end,
    timezone,
    operators,
    aircraft,
    types,
    columnFilters,
    sorts,
    controlBreaks,
    highlights,
    groupBy,
    formatChips,
    customerColorMap,
    customerDisplayMap,
    setTimezone,
    setOperators,
    setAircraft,
    setTypes,
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
    setTimezone("UTC");
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
      </div>

      {/* Row 2: Filter Controls */}
      <div className="flex items-center gap-2">
        {/* Date pickers — desktop only */}
        <div className="hidden md:flex items-center gap-2">
          <DateTimePicker
            value={start}
            onChange={setStart}
            label="Start"
            icon="fa-solid fa-calendar"
            timezone={timezone}
          />
          <DateTimePicker
            value={end}
            onChange={setEnd}
            label="End"
            icon="fa-solid fa-calendar-check"
            timezone={timezone}
          />
        </div>

        {/* Actions menu — between dates and TZ */}
        <ActionsMenu />

        {/* Timezone select — desktop only */}
        <div className="hidden md:block">
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs">
              <i className="fa-solid fa-clock mr-1.5 text-muted-foreground" />
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
      <ActiveChips chips={chips} onClearAll={handleClearAll} />
    </div>
  );
}
