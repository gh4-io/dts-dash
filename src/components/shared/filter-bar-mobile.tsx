"use client";

import { useEffect, useMemo } from "react";
import { useFilters } from "@/lib/hooks/use-filters";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import type { AircraftType } from "@/types";

const AIRCRAFT_TYPES: AircraftType[] = ["B777", "B767", "B747", "B757", "B737"];

interface FilterBarMobileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilterBarMobile({ open, onOpenChange }: FilterBarMobileProps) {
  const {
    start, end, timezone, operators, aircraft, types,
    setStart, setEnd, setTimezone, setOperators, setAircraft, setTypes, reset,
  } = useFilters();

  const { customers, fetch: fetchCustomers } = useCustomers();
  const { workPackages } = useWorkPackagesStore();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const operatorOptions: MultiSelectOption[] = useMemo(
    () =>
      customers.map((c) => ({
        value: c.name,
        label: c.displayName,
        color: c.color,
      })),
    [customers]
  );

  const aircraftOptions: MultiSelectOption[] = useMemo(() => {
    const regs = new Set(workPackages.map((wp) => wp.aircraftReg));
    return Array.from(regs)
      .sort()
      .map((reg) => ({ value: reg, label: reg }));
  }, [workPackages]);

  const typeOptions: MultiSelectOption[] = AIRCRAFT_TYPES.map((t) => ({
    value: t,
    label: t,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader className="border-b border-border pb-3">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <i className="fa-solid fa-filter text-muted-foreground" />
            Filters
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Date Range</label>
            <div className="space-y-2">
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
            </div>
          </div>

          {/* Station */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Station</label>
            <Badge variant="secondary" className="h-9 px-3 gap-1.5 font-normal">
              <i className="fa-solid fa-location-dot text-muted-foreground" />
              CVG
              <i className="fa-solid fa-lock text-[9px] text-muted-foreground" />
            </Badge>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Timezone</label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="h-9 w-full text-xs">
                <i className="fa-solid fa-clock mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Operator */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Operator</label>
            <MultiSelect
              options={operatorOptions}
              selected={operators}
              onChange={setOperators}
              placeholder="All Operators"
              icon="fa-solid fa-building"
              label="Operator"
            />
          </div>

          {/* Aircraft */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Aircraft</label>
            <MultiSelect
              options={aircraftOptions}
              selected={aircraft}
              onChange={setAircraft}
              placeholder="All Aircraft"
              icon="fa-solid fa-plane"
              label="Aircraft"
              searchable
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <MultiSelect
              options={typeOptions}
              selected={types}
              onChange={(v) => setTypes(v as AircraftType[])}
              placeholder="All Types"
              icon="fa-solid fa-plane-circle-check"
              label="Type"
              searchable={false}
            />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => {
              reset();
            }}
          >
            <i className="fa-solid fa-rotate-left mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
