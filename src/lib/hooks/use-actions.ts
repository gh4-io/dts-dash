"use client";

import { create } from "zustand";

// ─── Types ───

export interface SortLevel {
  column: string;
  direction: "asc" | "desc";
}

export interface ControlBreak {
  column: string;
  enabled: boolean;
}

export interface HighlightRule {
  id: string;
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=";
  value: string;
  color: string;
  enabled: boolean;
}

export interface GroupByConfig {
  columns: string[];
}

export interface ColumnFilterRule {
  id: string;
  column: ActionColumnKey;
  operator: "=" | "!=" | "in" | "not in" | ">" | "<" | ">=" | "<=";
  value: string;       // for scalar operators
  values: string[];    // for set operators (in / not in)
}

interface ActionsState {
  sorts: SortLevel[];
  controlBreaks: ControlBreak[];
  highlights: HighlightRule[];
  groupBy: GroupByConfig | null;
  columnFilters: ColumnFilterRule[];
}

interface ActionsActions {
  setSorts: (sorts: SortLevel[]) => void;
  setControlBreaks: (breaks: ControlBreak[]) => void;
  setHighlights: (rules: HighlightRule[]) => void;
  setGroupBy: (config: GroupByConfig | null) => void;
  setColumnFilters: (filters: ColumnFilterRule[]) => void;
  removeSortLevel: (index: number) => void;
  disableBreak: (column: string) => void;
  disableHighlight: (id: string) => void;
  clearGroupBy: () => void;
  removeColumnFilter: (id: string) => void;
  resetAll: () => void;
  activeCount: () => number;
}

export const useActions = create<ActionsState & ActionsActions>()((set, get) => ({
  sorts: [],
  controlBreaks: [],
  highlights: [],
  groupBy: null,
  columnFilters: [],

  setSorts: (sorts) => set({ sorts }),
  setControlBreaks: (breaks) => set({ controlBreaks: breaks }),
  setHighlights: (rules) => set({ highlights: rules }),
  setGroupBy: (config) => set({ groupBy: config }),
  setColumnFilters: (filters) => set({ columnFilters: filters }),

  removeSortLevel: (index) =>
    set((s) => ({ sorts: s.sorts.filter((_, i) => i !== index) })),
  disableBreak: (column) =>
    set((s) => ({
      controlBreaks: s.controlBreaks.map((b) =>
        b.column === column ? { ...b, enabled: false } : b
      ),
    })),
  disableHighlight: (id) =>
    set((s) => ({
      highlights: s.highlights.map((h) =>
        h.id === id ? { ...h, enabled: false } : h
      ),
    })),
  clearGroupBy: () => set({ groupBy: null }),
  removeColumnFilter: (id) =>
    set((s) => ({
      columnFilters: s.columnFilters.filter((f) => f.id !== id),
    })),
  resetAll: () =>
    set({
      sorts: [],
      controlBreaks: [],
      highlights: [],
      groupBy: null,
      columnFilters: [],
    }),

  activeCount: () => {
    const s = get();
    let count = 0;
    count += s.sorts.length;
    count += s.controlBreaks.filter((b) => b.enabled).length;
    count += s.highlights.filter((h) => h.enabled).length;
    if (s.groupBy) count += 1;
    count += s.columnFilters.length;
    return count;
  },
}));

// ─── Column definitions for actions ───

export const ACTION_COLUMNS = [
  { key: "customer", label: "Operator", type: "string" as const },
  { key: "aircraftReg", label: "Aircraft", type: "string" as const },
  { key: "inferredType", label: "Type", type: "string" as const },
  { key: "status", label: "Status", type: "string" as const },
  { key: "groundHours", label: "Ground Time", type: "number" as const },
  { key: "arrival", label: "Arrival", type: "date" as const },
  { key: "departure", label: "Departure", type: "date" as const },
  { key: "effectiveMH", label: "Man-Hours", type: "number" as const },
] as const;

export type ActionColumnKey = (typeof ACTION_COLUMNS)[number]["key"];
