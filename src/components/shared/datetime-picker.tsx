"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { TimePickerInput } from "@/components/ui/time-picker-input";
import { TimePeriodSelect } from "@/components/ui/time-picker-period-select";
import { type Period } from "@/components/ui/time-picker-utils";
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

  const minuteRef = React.useRef<HTMLInputElement>(null);
  const hourRef = React.useRef<HTMLInputElement>(null);
  const periodRef = React.useRef<HTMLButtonElement>(null);

  // Wall-clock components in the selected timezone
  const wc = React.useMemo(() => {
    const date = value ? new Date(value) : new Date();
    return getWallClock(date, timezone);
  }, [value, timezone]);

  // Build a local Date that the TimePicker components can manipulate.
  // The local hours/minutes represent the wall-clock time in the selected tz.
  const timeDate = React.useMemo(() => {
    return new Date(2000, 0, 1, wc.hour, wc.minute, 0, 0);
  }, [wc.hour, wc.minute]);

  const [period, setPeriod] = React.useState<Period>(wc.hour >= 12 ? "PM" : "AM");

  // Sync period when wall-clock hour changes externally
  React.useEffect(() => {
    setPeriod(wc.hour >= 12 ? "PM" : "AM");
  }, [wc.hour]);

  const handleTimeChange = React.useCallback(
    (newDate: Date | undefined) => {
      if (!newDate) return;
      const h = newDate.getHours();
      const m = newDate.getMinutes();
      onChange(wallClockToUtc(wc.year, wc.month, wc.day, h, m, timezone));
    },
    [wc.year, wc.month, wc.day, timezone, onChange],
  );

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

    if (timeFormat === "12h") {
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
  const is12h = timeFormat === "12h";

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
        <div className="border-t p-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">
              Time ({tzLabel})
            </label>
            {utcAnnotation && (
              <span className="text-[11px] text-muted-foreground">
                {utcAnnotation}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <TimePickerInput
              picker={is12h ? "12hours" : "hours"}
              period={is12h ? period : undefined}
              date={timeDate}
              setDate={handleTimeChange}
              ref={hourRef}
              onRightFocus={() => minuteRef.current?.focus()}
            />
            <span className="text-sm font-medium text-muted-foreground">:</span>
            <TimePickerInput
              picker="minutes"
              date={timeDate}
              setDate={handleTimeChange}
              ref={minuteRef}
              onLeftFocus={() => hourRef.current?.focus()}
              onRightFocus={is12h ? () => periodRef.current?.focus() : undefined}
            />
            {is12h && (
              <TimePeriodSelect
                period={period}
                setPeriod={setPeriod}
                date={timeDate}
                setDate={handleTimeChange}
                ref={periodRef}
                onLeftFocus={() => minuteRef.current?.focus()}
              />
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
