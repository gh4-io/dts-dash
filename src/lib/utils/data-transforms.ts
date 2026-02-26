/**
 * Pure data transformation functions for Actions menu features.
 * No React dependencies — usable in hooks, workers, or tests.
 */

import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";
import type {
  SortLevel,
  ControlBreak,
  HighlightRule,
  GroupByConfig,
  ActionColumnKey,
  ColumnFilterRule,
} from "@/lib/hooks/use-actions";
import {
  SHIFT_NAMES,
  SHIFT_SORT_ORDER,
  getPrimaryShift,
  getOverlappingShifts,
  type ShiftName,
} from "@/lib/utils/shift-helpers";

// ─── Helpers ───

/** Separator prefix for control break entries in the registrations array */
export const BREAK_PREFIX = "___break___";

/** Get a WP field value by action column key */
function getFieldValue(
  wp: SerializedWorkPackage,
  key: ActionColumnKey,
  timezone?: string,
): string | number | null {
  switch (key) {
    case "customer":
      return wp.customer;
    case "aircraftReg":
      return wp.aircraftReg;
    case "inferredType":
      return wp.inferredType;
    case "status":
      return wp.status;
    case "groundHours":
      return wp.groundHours;
    case "arrival":
      return wp.arrival;
    case "departure":
      return wp.departure;
    case "effectiveMH":
      return wp.effectiveMH;
    case "shift":
      return timezone ? getPrimaryShift(wp.arrival, timezone) : null;
    default:
      return null;
  }
}

/** Evaluate a condition (operator/value) against a field value */
export function evaluateCondition(
  value: string | number | null,
  operator: string,
  target: string,
  targets?: string[],
): boolean {
  if (value === null || value === undefined) return false;

  const strVal = String(value);
  const numVal = typeof value === "number" ? value : parseFloat(strVal);
  const numTarget = parseFloat(target);

  switch (operator) {
    case "=":
      return strVal.toLowerCase() === target.toLowerCase();
    case "!=":
      return strVal.toLowerCase() !== target.toLowerCase();
    case ">":
      return !isNaN(numVal) && !isNaN(numTarget) && numVal > numTarget;
    case "<":
      return !isNaN(numVal) && !isNaN(numTarget) && numVal < numTarget;
    case ">=":
      return !isNaN(numVal) && !isNaN(numTarget) && numVal >= numTarget;
    case "<=":
      return !isNaN(numVal) && !isNaN(numTarget) && numVal <= numTarget;
    case "in": {
      if (!targets || targets.length === 0) return false;
      const set = new Set(targets.map((t) => t.toLowerCase()));
      return set.has(strVal.toLowerCase());
    }
    case "not in": {
      if (!targets || targets.length === 0) return true;
      const set = new Set(targets.map((t) => t.toLowerCase()));
      return !set.has(strVal.toLowerCase());
    }
    default:
      return false;
  }
}

/**
 * Evaluate a shift condition using multi-value overlap matching.
 * A WP matches if any of its overlapping shifts satisfies the operator.
 */
function evaluateShiftCondition(
  overlaps: ShiftName[],
  operator: string,
  target: string,
  targets?: string[],
): boolean {
  const lowerTarget = target.toLowerCase();

  switch (operator) {
    case "=":
      return overlaps.some((s) => s.toLowerCase() === lowerTarget);
    case "!=":
      return !overlaps.some((s) => s.toLowerCase() === lowerTarget);
    case "in": {
      if (!targets || targets.length === 0) return false;
      const set = new Set(targets.map((t) => t.toLowerCase()));
      return overlaps.some((s) => set.has(s.toLowerCase()));
    }
    case "not in": {
      if (!targets || targets.length === 0) return true;
      const set = new Set(targets.map((t) => t.toLowerCase()));
      return !overlaps.some((s) => set.has(s.toLowerCase()));
    }
    default:
      return false;
  }
}

// ─── Transforms ───

/** Filter WPs by column filter rules (client-side) */
export function applyColumnFilters(
  wps: SerializedWorkPackage[],
  filters: ColumnFilterRule[],
  timezone?: string,
): SerializedWorkPackage[] {
  if (filters.length === 0) return wps;
  return wps.filter((wp) =>
    filters.every((rule) => {
      if (rule.column === "shift" && timezone) {
        const overlaps = getOverlappingShifts(wp.arrival, wp.departure, timezone);
        return evaluateShiftCondition(overlaps, rule.operator, rule.value, rule.values);
      }
      const val = getFieldValue(wp, rule.column, timezone);
      if (rule.operator === "in" || rule.operator === "not in") {
        return evaluateCondition(val, rule.operator, "", rule.values);
      }
      return evaluateCondition(val, rule.operator, rule.value);
    }),
  );
}

/** Sort WPs by multiple levels (stable sort via comparator chain) */
export function applySorts(
  wps: SerializedWorkPackage[],
  sorts: SortLevel[],
  timezone?: string,
): SerializedWorkPackage[] {
  if (sorts.length === 0) return wps;

  return [...wps].sort((a, b) => {
    for (const { column, direction } of sorts) {
      const aVal = getFieldValue(a, column as ActionColumnKey, timezone);
      const bVal = getFieldValue(b, column as ActionColumnKey, timezone);
      const mult = direction === "asc" ? 1 : -1;

      if (aVal === bVal) continue;
      if (aVal === null) return 1 * mult;
      if (bVal === null) return -1 * mult;

      // Shift uses custom sort order (Day=1, Swing=2, Night=3)
      if (column === "shift") {
        const aOrder = SHIFT_SORT_ORDER[aVal as ShiftName] ?? 99;
        const bOrder = SHIFT_SORT_ORDER[bVal as ShiftName] ?? 99;
        const diff = aOrder - bOrder;
        if (diff !== 0) return diff * mult;
        continue;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        const diff = aVal - bVal;
        if (diff !== 0) return diff * mult;
      } else {
        const cmp = String(aVal).localeCompare(String(bVal));
        if (cmp !== 0) return cmp * mult;
      }
    }
    return 0;
  });
}

/**
 * Apply control breaks — insert separator entries into the registrations array.
 * Returns new registrations + a mapping of break label positions.
 */
export function applyControlBreaks(
  registrations: string[],
  wps: SerializedWorkPackage[],
  breaks: ControlBreak[],
  timezone?: string,
): { registrations: string[]; breakLabels: Map<number, string> } {
  const activeBreaks = breaks.filter((b) => b.enabled);
  if (activeBreaks.length === 0) {
    return { registrations, breakLabels: new Map() };
  }

  // Build reg → WPs lookup
  const regWps = new Map<string, SerializedWorkPackage[]>();
  for (const wp of wps) {
    const list = regWps.get(wp.aircraftReg) || [];
    list.push(wp);
    regWps.set(wp.aircraftReg, list);
  }

  // Build composite break key for each registration
  const regBreakKey = (reg: string): string => {
    const wpList = regWps.get(reg) || [];
    if (wpList.length === 0) return "";
    // Use first WP's values for the break columns
    return activeBreaks
      .map((b) => {
        const val = getFieldValue(wpList[0], b.column as ActionColumnKey, timezone);
        return val !== null ? String(val) : "";
      })
      .join(" — ");
  };

  // Sort registrations by break key so same-group items are adjacent
  const sortedRegs = [...registrations].sort((a, b) => {
    const ka = regBreakKey(a);
    const kb = regBreakKey(b);
    return ka.localeCompare(kb);
  });

  // Group sorted registrations by break key
  const groups: { key: string; regs: string[] }[] = [];
  let currentKey = "";
  for (const reg of sortedRegs) {
    const key = regBreakKey(reg);
    if (key !== currentKey || groups.length === 0) {
      groups.push({ key, regs: [reg] });
      currentKey = key;
    } else {
      groups[groups.length - 1].regs.push(reg);
    }
  }

  // Build new registrations with separator entries
  const newRegs: string[] = [];
  const breakLabels = new Map<number, string>();

  for (const group of groups) {
    if (group.key) {
      const sepIdx = newRegs.length;
      newRegs.push(`${BREAK_PREFIX}${group.key}`);
      breakLabels.set(sepIdx, group.key);
    }
    newRegs.push(...group.regs);
  }

  return { registrations: newRegs, breakLabels };
}

/**
 * Apply highlights — returns a Map of WP index → hex color.
 * First matching enabled rule wins.
 */
export function applyHighlights(
  wps: SerializedWorkPackage[],
  rules: HighlightRule[],
  timezone?: string,
): Map<number, string> {
  const map = new Map<number, string>();
  const activeRules = rules.filter((r) => r.enabled);
  if (activeRules.length === 0) return map;

  for (let i = 0; i < wps.length; i++) {
    for (const rule of activeRules) {
      // Shift rules control chart background shading, not bar colors
      if (rule.column === "shift") continue;

      const val = getFieldValue(wps[i], rule.column as ActionColumnKey, timezone);
      if (evaluateCondition(val, rule.operator, rule.value)) {
        map.set(i, rule.color);
        break;
      }
    }
  }

  return map;
}

/**
 * Apply group-by — collapse registrations into group-level rows.
 * Returns grouped registrations and a map of WP index → group row index.
 */
export function applyGroupBy(
  registrations: string[],
  wps: SerializedWorkPackage[],
  config: GroupByConfig | null,
  timezone?: string,
): { groupedRegistrations: string[]; wpToGroupIndex: Map<number, number> } | null {
  if (!config || config.columns.length === 0) return null;

  // Build composite group key for each WP
  const wpGroupKey = (wp: SerializedWorkPackage): string =>
    config.columns
      .map((col) => {
        const val = getFieldValue(wp, col as ActionColumnKey, timezone);
        return val !== null ? String(val) : "(empty)";
      })
      .join(" — ");

  // Collect unique group keys in order of first appearance
  const groupOrder: string[] = [];
  const seen = new Set<string>();
  for (const wp of wps) {
    const key = wpGroupKey(wp);
    if (!seen.has(key)) {
      groupOrder.push(key);
      seen.add(key);
    }
  }

  // Map each WP to its group index
  const wpToGroupIndex = new Map<number, number>();
  for (let i = 0; i < wps.length; i++) {
    const key = wpGroupKey(wps[i]);
    wpToGroupIndex.set(i, groupOrder.indexOf(key));
  }

  return { groupedRegistrations: groupOrder, wpToGroupIndex };
}

/** Get sorted unique values for a column from WPs */
export function getUniqueValues(
  wps: SerializedWorkPackage[],
  columnKey: ActionColumnKey,
  timezone?: string,
): string[] {
  if (columnKey === "shift") return [...SHIFT_NAMES];
  const vals = new Set<string>();
  for (const wp of wps) {
    const v = getFieldValue(wp, columnKey, timezone);
    if (v !== null && v !== undefined) vals.add(String(v));
  }
  return Array.from(vals).sort((a, b) => a.localeCompare(b));
}
