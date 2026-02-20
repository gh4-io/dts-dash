"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useFilters } from "@/lib/hooks/use-filters";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useWorkPackagesStore } from "@/lib/hooks/use-work-packages";
import { MultiSelect, type MultiSelectOption } from "./multi-select";
import { FilterBarMobile } from "./filter-bar-mobile";
import type { AircraftType } from "@/types";

export function FilterDropdown() {
  const {
    operators,
    aircraft,
    types,
    setOperators,
    setAircraft,
    setTypes,
  } = useFilters();

  const { customers, fetch: fetchCustomers } = useCustomers();
  const { workPackages } = useWorkPackagesStore();

  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Extract unique aircraft types from work packages (dynamic, not hardcoded)
  const typeOptions: MultiSelectOption[] = useMemo(() => {
    const uniqueTypes = new Set<string>();
    workPackages.forEach((wp) => {
      if (wp.inferredType && wp.inferredType !== "Unknown") {
        uniqueTypes.add(wp.inferredType);
      }
    });
    return Array.from(uniqueTypes)
      .sort()
      .map((t) => ({ value: t as AircraftType, label: t }));
  }, [workPackages]);

  const activeCount = operators.length + aircraft.length + types.length;

  const handleReset = () => {
    setOperators([]);
    setAircraft([]);
    setTypes([]);
  };

  return (
    <>
      {/* Desktop: Popover */}
      <div className="hidden md:block">
        <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5"
            >
              <i className="fa-solid fa-filter text-muted-foreground" />
              Filters
              {activeCount > 0 && (
                <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-3 space-y-3" align="start">
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
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDesktopOpen(false)}
              >
                Done
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile: Sheet trigger */}
      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={() => setMobileOpen(true)}
        >
          <i className="fa-solid fa-filter" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
        <FilterBarMobile open={mobileOpen} onOpenChange={setMobileOpen} />
      </div>
    </>
  );
}
