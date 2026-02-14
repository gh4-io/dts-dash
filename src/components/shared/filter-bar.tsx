"use client";

import { useEffect, useMemo } from "react";
import { useFilters } from "@/lib/hooks/use-filters";
import { useFilterUrlSync } from "@/lib/hooks/use-filter-url-sync";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useWorkPackagesStore } from "@/lib/hooks/use-work-packages";
import { DateTimePicker } from "./datetime-picker";
import { MultiSelect, type MultiSelectOption } from "./multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AircraftType } from "@/types";

const AIRCRAFT_TYPES: AircraftType[] = ["B777", "B767", "B747", "B757", "B737"];

export function FilterBar() {
  // Sync URL ↔ Store
  useFilterUrlSync();

  const {
    start, end, timezone, operators, aircraft, types,
    setStart, setEnd, setTimezone, setOperators, setAircraft, setTypes, reset,
  } = useFilters();

  const { customers, fetch: fetchCustomers } = useCustomers();
  const { workPackages } = useWorkPackagesStore();

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Build operator options from customers
  const operatorOptions: MultiSelectOption[] = useMemo(
    () =>
      customers.map((c) => ({
        value: c.name,
        label: c.displayName,
        color: c.color,
      })),
    [customers]
  );

  // Build aircraft options from loaded data
  const aircraftOptions: MultiSelectOption[] = useMemo(() => {
    const regs = new Set(workPackages.map((wp) => wp.aircraftReg));
    return Array.from(regs)
      .sort()
      .map((reg) => ({ value: reg, label: reg }));
  }, [workPackages]);

  // Type options
  const typeOptions: MultiSelectOption[] = AIRCRAFT_TYPES.map((t) => ({
    value: t,
    label: t,
  }));

  // Active filter pills
  const hasActiveFilters = operators.length > 0 || aircraft.length > 0 || types.length > 0;

  return (
    <div className="space-y-2">
      {/* Row 1: Date range + Station + Timezone */}
      <div className="flex flex-wrap items-center gap-2">
        <DateTimePicker
          value={start}
          onChange={setStart}
          label="Start"
          icon="fa-solid fa-calendar"
        />
        <DateTimePicker
          value={end}
          onChange={setEnd}
          label="End"
          icon="fa-solid fa-calendar-check"
        />
        <Badge variant="secondary" className="h-9 px-3 gap-1.5 font-normal">
          <i className="fa-solid fa-location-dot text-muted-foreground" />
          CVG
          <i className="fa-solid fa-lock text-[9px] text-muted-foreground" />
        </Badge>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs">
            <i className="fa-solid fa-clock mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UTC">UTC</SelectItem>
            <SelectItem value="America/New_York">Eastern</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Entity filters + Reset */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          options={operatorOptions}
          selected={operators}
          onChange={setOperators}
          placeholder="All Operators"
          icon="fa-solid fa-building"
          label="Operator"
        />
        <MultiSelect
          options={aircraftOptions}
          selected={aircraft}
          onChange={setAircraft}
          placeholder="All Aircraft"
          icon="fa-solid fa-plane"
          label="Aircraft"
          searchable
        />
        <MultiSelect
          options={typeOptions}
          selected={types}
          onChange={(v) => setTypes(v as AircraftType[])}
          placeholder="All Types"
          icon="fa-solid fa-plane-circle-check"
          label="Type"
          searchable={false}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="h-9 text-xs text-muted-foreground"
        >
          <i className="fa-solid fa-rotate-left mr-1.5" />
          Reset
        </Button>
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {operators.map((op) => (
            <Badge key={op} variant="secondary" className="gap-1 text-xs">
              {op}
              <button
                onClick={() => setOperators(operators.filter((o) => o !== op))}
                className="ml-0.5 hover:text-destructive"
              >
                <i className="fa-solid fa-xmark text-[9px]" />
              </button>
            </Badge>
          ))}
          {aircraft.map((ac) => (
            <Badge key={ac} variant="secondary" className="gap-1 text-xs">
              {ac}
              <button
                onClick={() => setAircraft(aircraft.filter((a) => a !== ac))}
                className="ml-0.5 hover:text-destructive"
              >
                <i className="fa-solid fa-xmark text-[9px]" />
              </button>
            </Badge>
          ))}
          {types.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 text-xs">
              {t}
              <button
                onClick={() => setTypes(types.filter((ty) => ty !== t))}
                className="ml-0.5 hover:text-destructive"
              >
                <i className="fa-solid fa-xmark text-[9px]" />
              </button>
            </Badge>
          ))}
          <button
            onClick={() => {
              setOperators([]);
              setAircraft([]);
              setTypes([]);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
