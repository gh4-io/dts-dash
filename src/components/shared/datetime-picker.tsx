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
  timezone?: string; // IANA timezone (default UTC)
}

/** Extract wall-clock components for a UTC date in a given timezone */
function getWallClock(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  return {
    year: parseInt(get("year")),
    month: parseInt(get("month")) - 1, // 0-indexed for Date constructor
    day: parseInt(get("day")),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Convert wall-clock year/month/day/hour/minute in a timezone to a UTC ISO string */
function wallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): string {
  // Create a tentative UTC date with the wall-clock components
  const tentative = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));

  // See what that tentative UTC looks like in the target timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(tentative);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const wallStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  const wallAsUtc = new Date(wallStr + "Z");

  // Offset = tentative - wallAsUtc; correct = tentative + offset
  const offset = tentative.getTime() - wallAsUtc.getTime();
  return new Date(tentative.getTime() + offset).toISOString();
}

export function DateTimePicker({ value, onChange, label, icon, timezone = "UTC" }: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Wall-clock components in the selected timezone
  const wc = React.useMemo(() => {
    const date = value ? new Date(value) : new Date();
    return getWallClock(date, timezone);
  }, [value, timezone]);

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) return;
    // Keep current wall-clock time, change the date
    onChange(
      wallClockToUtc(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        parseInt(wc.hour),
        parseInt(wc.minute),
        timezone,
      )
    );
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;
    onChange(wallClockToUtc(wc.year, wc.month, wc.day, h, m, timezone));
  };

  const formatDisplay = () => {
    const y = wc.year;
    const mo = (wc.month + 1).toString().padStart(2, "0");
    const d = wc.day.toString().padStart(2, "0");
    return `${y}-${mo}-${d} ${wc.hour}:${wc.minute}`;
  };

  // Create a Date for the Calendar that represents the wall-clock date
  // Use noon to avoid date-boundary issues across browser timezones
  const calendarDate = new Date(wc.year, wc.month, wc.day, 12, 0, 0);

  const tzLabel = timezone === "UTC" ? "UTC" : "Eastern";

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
          selected={calendarDate}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t p-3">
          <label className="text-xs text-muted-foreground">
            Time ({tzLabel})
          </label>
          <input
            type="time"
            value={`${wc.hour}:${wc.minute}`}
            onChange={handleTimeChange}
            className="mt-1 block w-full rounded-md border bg-background px-2 py-1 text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
