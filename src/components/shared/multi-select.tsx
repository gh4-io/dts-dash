"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string; // Optional color dot
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  icon?: string; // FA class
  label: string;
  searchable?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  icon,
  label,
  searchable = true,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between h-9 px-3 text-xs min-w-[120px]"
        >
          <span className="flex items-center gap-1.5 truncate">
            {icon && <i className={cn(icon, "text-muted-foreground")} />}
            <span className="hidden sm:inline mr-0.5 text-muted-foreground">{label}:</span>
            <span className="truncate">{displayText}</span>
          </span>
          <i className="fa-solid fa-chevron-down ml-1 text-[10px] text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />}
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => toggleOption(option.value)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center",
                        selected.includes(option.value)
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {selected.includes(option.value) && (
                        <i className="fa-solid fa-check text-[9px] text-primary-foreground" />
                      )}
                    </div>
                    {option.color && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <span className="truncate text-sm">{option.label}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
