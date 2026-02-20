"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { TimeColumn, type TimeColumnItem } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/lib/hooks/use-preferences";

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
    hour: parseInt(get("hour")),
    minute: parseInt(get("minute")),
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
  const { timeFormat } = usePreferences();

  // Wall-clock components in the selected timezone
  const wc = React.useMemo(() => {
    const date = value ? new Date(value) : new Date();
    return getWallClock(date, timezone);
  }, [value, timezone]);

  const is12h = timeFormat === "12h";

  // Derive display hour + meridiem from 24h wall-clock hour
  const displayHour = React.useMemo(() => {
    if (!is12h) return wc.hour;
    return wc.hour % 12 || 12;
  }, [wc.hour, is12h]);

  const meridiem = React.useMemo<"AM" | "PM">(() => {
    return wc.hour >= 12 ? "PM" : "AM";
  }, [wc.hour]);

  // Commit a new wall-clock hour (24h) + minute
  const commitTime = React.useCallback(
    (h24: number, m: number) => {
      onChange(wallClockToUtc(wc.year, wc.month, wc.day, h24, m, timezone));
    },
    [wc.year, wc.month, wc.day, timezone, onChange],
  );

  // Convert a 12h display hour + meridiem back to 24h
  const to24h = (h12: number, mer: "AM" | "PM"): number => {
    if (mer === "AM") return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  };

  const handleHourSelect = (v: number | string) => {
    const h = v as number;
    if (is12h) {
      commitTime(to24h(h, meridiem), wc.minute);
    } else {
      commitTime(h, wc.minute);
    }
  };

  const handleMinuteSelect = (v: number | string) => {
    commitTime(wc.hour, v as number);
  };

  const handleMeridiemSelect = (v: number | string) => {
    const newMer = v as "AM" | "PM";
    commitTime(to24h(displayHour, newMer), wc.minute);
  };

  const handleNow = () => {
    const now = new Date();
    const nowWc = getWallClock(now, timezone);
    onChange(
      wallClockToUtc(wc.year, wc.month, wc.day, nowWc.hour, nowWc.minute, timezone),
    );
  };

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) return;
    onChange(
      wallClockToUtc(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        wc.hour,
        wc.minute,
        timezone,
      ),
    );
  };

  const formatDisplay = () => {
    const y = wc.year;
    const mo = (wc.month + 1).toString().padStart(2, "0");
    const d = wc.day.toString().padStart(2, "0");
    const hStr = wc.hour.toString().padStart(2, "0");
    const mStr = wc.minute.toString().padStart(2, "0");

    if (is12h) {
      const p = wc.hour >= 12 ? "PM" : "AM";
      const h12 = wc.hour === 0 ? 12 : wc.hour > 12 ? wc.hour - 12 : wc.hour;
      return `${y}-${mo}-${d} ${h12}:${mStr} ${p}`;
    }

    return `${y}-${mo}-${d} ${hStr}:${mStr}`;
  };

  // UTC equivalent annotation for non-UTC timezones
  const utcAnnotation = React.useMemo(() => {
    if (timezone === "UTC" || !value) return null;
    const date = new Date(value);
    const utcH = date.getUTCHours().toString().padStart(2, "0");
    const utcM = date.getUTCMinutes().toString().padStart(2, "0");
    return `${utcH}:${utcM}Z`;
  }, [value, timezone]);

  // Create a Date for the Calendar that represents the wall-clock date
  // Use noon to avoid date-boundary issues across browser timezones
  const calendarDate = new Date(wc.year, wc.month, wc.day, 12, 0, 0);

  const tzLabel = timezone === "UTC" ? "UTC" : "Eastern";

  // Build column items
  const hourItems = React.useMemo((): TimeColumnItem[] => {
    const start = is12h ? 1 : 0;
    const end = is12h ? 12 : 23;
    const items: TimeColumnItem[] = [];
    for (let i = start; i <= end; i++) {
      items.push({ value: i, label: i.toString().padStart(2, "0") });
    }
    return items;
  }, [is12h]);

  const minuteItems = React.useMemo((): TimeColumnItem[] => {
    const items: TimeColumnItem[] = [];
    for (let i = 0; i <= 59; i++) {
      items.push({ value: i, label: i.toString().padStart(2, "0") });
    }
    return items;
  }, []);

  const meridiemItems: TimeColumnItem[] = [
    { value: "AM", label: "AM" },
    { value: "PM", label: "PM" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal h-9 px-3 text-xs",
            !value && "text-muted-foreground",
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
        <div className="border-t">
          <div className="flex items-center justify-between px-3 pt-2">
            <label className="text-xs text-muted-foreground">
              Time ({tzLabel})
            </label>
            {utcAnnotation && (
              <span className="text-[11px] text-muted-foreground">
                {utcAnnotation}
              </span>
            )}
          </div>
          {/* Scroll-column time picker */}
          <div className="flex border-t mt-2">
            <TimeColumn
              title="Hours"
              items={hourItems}
              selectedValue={displayHour}
              onSelect={handleHourSelect}
            />
            <TimeColumn
              title="Min"
              items={minuteItems}
              selectedValue={wc.minute}
              onSelect={handleMinuteSelect}
              isLast={!is12h}
            />
            {is12h && (
              <TimeColumn
                title="AM/PM"
                items={meridiemItems}
                selectedValue={meridiem}
                onSelect={handleMeridiemSelect}
                isLast
              />
            )}
          </div>
          {/* Footer with Now shortcut */}
          <div className="flex items-center justify-end border-t px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleNow}
              className="text-xs"
            >
              Now
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
