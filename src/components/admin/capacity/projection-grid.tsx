"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCustomers } from "@/lib/hooks/use-customers";
import type { WeeklyProjection, ProjectionShiftCode } from "@/types";

const ISO_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ISO_DAY_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const SHIFTS: ProjectionShiftCode[] = ["DAY", "SWING", "NIGHT"];
const SHIFT_COLORS: Record<ProjectionShiftCode, string> = {
  DAY: "text-amber-500",
  SWING: "text-orange-500",
  NIGHT: "text-indigo-400",
};

interface ProjectionGridProps {
  projections: WeeklyProjection[];
  onSave: (
    rows: Array<{
      customer: string;
      dayOfWeek: number;
      shiftCode: string;
      projectedMh: number;
    }>,
  ) => Promise<void>;
  onClearAll: () => Promise<void>;
}

type CellKey = `${string}|${number}|${ProjectionShiftCode}`;
type GridState = Map<CellKey, number>;

function cellKey(customer: string, day: number, shift: ProjectionShiftCode): CellKey {
  return `${customer}|${day}|${shift}`;
}

export function ProjectionGrid({ projections, onSave, onClearAll }: ProjectionGridProps) {
  const [comboOpen, setComboOpen] = useState(false);
  const [comboSearch, setComboSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const { customers: knownCustomers, fetch: fetchCustomers } = useCustomers();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Derive the list of customers from existing projections
  const initialCustomers = useMemo(() => {
    const names = new Set<string>();
    for (const p of projections) names.add(p.customer);
    return Array.from(names).sort();
  }, [projections]);

  const [customers, setCustomers] = useState<string[]>(initialCustomers);

  // Build grid state from projections
  const initialGrid = useMemo(() => {
    const grid: GridState = new Map();
    for (const p of projections) {
      grid.set(cellKey(p.customer, p.dayOfWeek, p.shiftCode as ProjectionShiftCode), p.projectedMh);
    }
    return grid;
  }, [projections]);

  const [grid, setGrid] = useState<GridState>(initialGrid);
  const [dirty, setDirty] = useState(false);

  // Sync when projections reload
  useMemo(() => {
    setGrid(initialGrid);
    setCustomers(initialCustomers);
    setDirty(false);
  }, [initialGrid, initialCustomers]);

  const handleCellChange = useCallback((key: CellKey, value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setGrid((prev) => {
      const next = new Map(prev);
      next.set(key, num);
      return next;
    });
    setDirty(true);
  }, []);

  const addCustomer = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || customers.includes(trimmed)) return;
      setCustomers((prev) => [...prev, trimmed].sort());
      setDirty(true);
      setComboOpen(false);
      setComboSearch("");
    },
    [customers],
  );

  // Customer options: known customers not yet added to the grid
  const customerOptions = useMemo(() => {
    return knownCustomers
      .map((c) => c.name)
      .filter((name) => !customers.includes(name))
      .sort();
  }, [knownCustomers, customers]);

  const removeCustomer = useCallback((name: string) => {
    if (!confirm(`Remove ${name} and all their projections?`)) return;
    setCustomers((prev) => prev.filter((c) => c !== name));
    setGrid((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.startsWith(`${name}|`)) next.delete(key);
      }
      return next;
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const rows: Array<{
        customer: string;
        dayOfWeek: number;
        shiftCode: string;
        projectedMh: number;
      }> = [];

      for (const customer of customers) {
        for (let dow = 1; dow <= 7; dow++) {
          for (const shift of SHIFTS) {
            const val = grid.get(cellKey(customer, dow, shift)) ?? 0;
            if (val > 0) {
              rows.push({ customer, dayOfWeek: dow, shiftCode: shift, projectedMh: val });
            }
          }
        }
      }

      await onSave(rows);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [customers, grid, onSave]);

  // Compute column totals per day
  const dayTotals = useMemo(() => {
    const totals: number[] = [];
    for (let dow = 1; dow <= 7; dow++) {
      let sum = 0;
      for (const customer of customers) {
        for (const shift of SHIFTS) {
          sum += grid.get(cellKey(customer, dow, shift)) ?? 0;
        }
      }
      totals.push(Math.round(sum * 10) / 10);
    }
    return totals;
  }, [customers, grid]);

  const weekTotal = useMemo(() => dayTotals.reduce((s, v) => s + v, 0), [dayTotals]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs w-56 justify-start">
              <i className="fa-solid fa-plus mr-1.5 text-muted-foreground" />
              <span className="text-muted-foreground">Add customer...</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or type new..."
                value={comboSearch}
                onValueChange={setComboSearch}
                className="text-xs"
              />
              <CommandList>
                <CommandEmpty>
                  {comboSearch.trim() ? (
                    <button
                      className="w-full px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
                      onClick={() => addCustomer(comboSearch)}
                    >
                      <i className="fa-solid fa-plus mr-1.5 text-muted-foreground" />
                      Add &quot;{comboSearch.trim()}&quot;
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Type a customer name</span>
                  )}
                </CommandEmpty>
                <CommandGroup heading="Existing customers">
                  {customerOptions.map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      onSelect={() => addCustomer(name)}
                      className="text-xs"
                    >
                      {name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-destructive"
          onClick={onClearAll}
        >
          <i className="fa-solid fa-trash mr-1.5" />
          Clear All
        </Button>
        <Button size="sm" className="h-8 text-xs" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? (
            <i className="fa-solid fa-spinner fa-spin mr-1.5" />
          ) : (
            <i className="fa-solid fa-floppy-disk mr-1.5" />
          )}
          Save
        </Button>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          <i className="fa-solid fa-bullseye text-3xl mb-3 block opacity-30" />
          <p className="text-sm font-medium">No Projections</p>
          <p className="text-xs mt-1">Add a customer above to start entering weekly MH targets.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground w-40 sticky left-0 bg-muted/30 z-10">
                  Customer
                </th>
                <th className="px-1 py-2 text-center text-[10px] font-medium text-muted-foreground w-14">
                  Shift
                </th>
                {ISO_DAY_LABELS.map((label, i) => (
                  <th
                    key={label}
                    className="px-1 py-2 text-center text-[10px] font-medium text-muted-foreground"
                  >
                    <div>{ISO_DAY_SHORT[i]}</div>
                    <div className="text-[9px] font-normal">{label}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-[10px] font-semibold text-muted-foreground border-l border-border">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {customers.map((customer) => (
                <CustomerRows
                  key={customer}
                  customer={customer}
                  grid={grid}
                  onCellChange={handleCellChange}
                  onRemove={() => removeCustomer(customer)}
                />
              ))}
              {/* Totals row */}
              <tr className="bg-muted/20 font-semibold">
                <td className="px-3 py-2 text-[10px] sticky left-0 bg-muted/20 z-10">Total</td>
                <td />
                {dayTotals.map((total, i) => (
                  <td key={i} className="px-1 py-2 text-center tabular-nums">
                    {total > 0 ? (
                      total.toFixed(1)
                    ) : (
                      <span className="text-muted-foreground/30">-</span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2 text-center tabular-nums border-l border-border">
                  {weekTotal > 0 ? weekTotal.toFixed(1) : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {dirty && (
        <p className="text-xs text-amber-500">
          <i className="fa-solid fa-triangle-exclamation mr-1" />
          You have unsaved changes.
        </p>
      )}
    </div>
  );
}

// ─── Customer Sub-Rows (3 shift rows per customer) ──────────────────────────

function CustomerRows({
  customer,
  grid,
  onCellChange,
  onRemove,
}: {
  customer: string;
  grid: GridState;
  onCellChange: (key: CellKey, value: string) => void;
  onRemove: () => void;
}) {
  const customerTotal = useMemo(() => {
    let sum = 0;
    for (let dow = 1; dow <= 7; dow++) {
      for (const shift of SHIFTS) {
        sum += grid.get(cellKey(customer, dow, shift)) ?? 0;
      }
    }
    return Math.round(sum * 10) / 10;
  }, [customer, grid]);

  return (
    <>
      {SHIFTS.map((shift, shiftIdx) => {
        const shiftTotal = (() => {
          let sum = 0;
          for (let dow = 1; dow <= 7; dow++) {
            sum += grid.get(cellKey(customer, dow, shift)) ?? 0;
          }
          return Math.round(sum * 10) / 10;
        })();

        return (
          <tr key={`${customer}_${shift}`} className="hover:bg-accent/10 transition-colors">
            {/* Customer name cell — spans only the first shift row visually */}
            <td
              className={`px-3 py-1 sticky left-0 bg-card z-10 ${shiftIdx === 0 ? "pt-2" : ""} ${shiftIdx === SHIFTS.length - 1 ? "pb-2" : ""}`}
            >
              {shiftIdx === 0 && (
                <div className="flex items-center gap-1.5 group">
                  <span className="text-xs font-medium truncate max-w-[110px]">{customer}</span>
                  <button
                    onClick={onRemove}
                    className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-opacity"
                    title="Remove customer"
                  >
                    <i className="fa-solid fa-xmark text-[9px]" />
                  </button>
                </div>
              )}
            </td>
            {/* Shift label */}
            <td className={`px-1 py-1 text-center ${SHIFT_COLORS[shift]}`}>
              <span className="text-[10px] font-medium">
                {shift === "DAY" ? "D" : shift === "SWING" ? "S" : "N"}
              </span>
            </td>
            {/* 7 day cells */}
            {Array.from({ length: 7 }, (_, i) => {
              const dow = i + 1;
              const key = cellKey(customer, dow, shift);
              const val = grid.get(key) ?? 0;
              return (
                <td key={dow} className="px-0.5 py-0.5">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={val || ""}
                    onChange={(e) => onCellChange(key, e.target.value)}
                    placeholder="-"
                    className="w-full h-6 text-center text-[11px] tabular-nums bg-transparent border border-border/40 rounded px-1 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/20"
                  />
                </td>
              );
            })}
            {/* Shift total */}
            <td className="px-2 py-1 text-center tabular-nums text-[10px] border-l border-border">
              {shiftIdx === 0 ? (
                <span className="font-semibold">
                  {customerTotal > 0 ? customerTotal.toFixed(1) : "-"}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {shiftTotal > 0 ? shiftTotal.toFixed(1) : "-"}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
