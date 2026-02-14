"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: string; // ISO 8601
  onChange: (iso: string) => void;
  label: string;
  icon?: string; // FA class
}

export function DateTimePicker({ value, onChange, label, icon }: DateTimePickerProps) {
  const date = value ? new Date(value) : new Date();
  const [open, setOpen] = React.useState(false);

  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) return;
    const updated = new Date(date);
    updated.setUTCFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onChange(updated.toISOString());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const updated = new Date(date);
    updated.setUTCHours(h, m, 0, 0);
    onChange(updated.toISOString());
  };

  const formatDisplay = () => {
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")} ${hours}:${minutes}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal h-9 px-3 text-xs",
            !value && "text-muted-foreground"
          )}
        >
          {icon && <i className={cn(icon, "mr-1.5 text-muted-foreground")} />}
          <span className="hidden sm:inline mr-1 text-muted-foreground">{label}:</span>
          <span>{formatDisplay()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t p-3">
          <label className="text-xs text-muted-foreground">
            Time (UTC)
          </label>
          <input
            type="time"
            value={`${hours}:${minutes}`}
            onChange={handleTimeChange}
            className="mt-1 block w-full rounded-md border bg-background px-2 py-1 text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
