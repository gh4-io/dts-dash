"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  validateCronExpression,
  cronToHuman,
  buildCronExpression,
  type CronPresetFrequency,
} from "@/lib/utils/cron-helpers";

interface CronScheduleBuilderProps {
  value: string;
  onChange: (expression: string) => void;
}

const MINUTE_INTERVALS = [1, 2, 5, 10, 15, 20, 30];
const HOUR_INTERVALS = [1, 2, 3, 4, 6, 8, 12];
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CronScheduleBuilder({ value, onChange }: CronScheduleBuilderProps) {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [frequency, setFrequency] = useState<CronPresetFrequency>("hours");
  const [interval, setInterval] = useState(6);
  const [minute, setMinute] = useState(0);
  const [hour, setHour] = useState(0);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customExpr, setCustomExpr] = useState(value || "0 */6 * * *");

  /** Build and emit a cron expression, merging overrides with current state */
  function emitPreset(
    overrides: {
      frequency?: CronPresetFrequency;
      interval?: number;
      minute?: number;
      hour?: number;
      daysOfWeek?: number[];
      dayOfMonth?: number;
    } = {},
  ) {
    const expr = buildCronExpression({
      frequency: overrides.frequency ?? frequency,
      interval: overrides.interval ?? interval,
      minute: overrides.minute ?? minute,
      hour: overrides.hour ?? hour,
      daysOfWeek: overrides.daysOfWeek ?? daysOfWeek,
      dayOfMonth: overrides.dayOfMonth ?? dayOfMonth,
    });
    onChange(expr);
  }

  const handleModeChange = (newMode: "preset" | "custom") => {
    setMode(newMode);
    if (newMode === "preset") {
      emitPreset();
    } else {
      setCustomExpr(value);
    }
  };

  const handleCustomChange = (expr: string) => {
    setCustomExpr(expr);
    onChange(expr);
  };

  const validationError = validateCronExpression(mode === "custom" ? customExpr : value);
  const humanText = !validationError ? cronToHuman(value) : null;

  const toggleDay = (day: number) => {
    const next = daysOfWeek.includes(day)
      ? daysOfWeek.filter((d) => d !== day)
      : [...daysOfWeek, day].sort();
    setDaysOfWeek(next);
    emitPreset({ daysOfWeek: next });
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-md border border-border p-0.5">
        <Button
          type="button"
          variant={mode === "preset" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => handleModeChange("preset")}
        >
          Presets
        </Button>
        <Button
          type="button"
          variant={mode === "custom" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => handleModeChange("custom")}
        >
          Custom
        </Button>
      </div>

      {mode === "preset" ? (
        <div className="space-y-3">
          {/* Frequency selector */}
          <div>
            <Label className="text-xs">Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(v) => {
                const f = v as CronPresetFrequency;
                setFrequency(f);
                emitPreset({ frequency: f });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Every N Minutes</SelectItem>
                <SelectItem value="hours">Every N Hours</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sub-options per frequency */}
          {frequency === "minutes" && (
            <div>
              <Label className="text-xs">Interval</Label>
              <Select
                value={String(interval)}
                onValueChange={(v) => {
                  const n = Number(v);
                  setInterval(n);
                  emitPreset({ interval: n });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_INTERVALS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Every {n} minute{n !== 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frequency === "hours" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Interval</Label>
                <Select
                  value={String(interval)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    setInterval(n);
                    emitPreset({ interval: n });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_INTERVALS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Every {n} hour{n !== 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Minute Offset</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => {
                    const m = Math.max(0, Math.min(59, Number(e.target.value)));
                    setMinute(m);
                    emitPreset({ minute: m });
                  }}
                />
              </div>
            </div>
          )}

          {frequency === "daily" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Hour</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => {
                    const h = Math.max(0, Math.min(23, Number(e.target.value)));
                    setHour(h);
                    emitPreset({ hour: h });
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Minute</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => {
                    const m = Math.max(0, Math.min(59, Number(e.target.value)));
                    setMinute(m);
                    emitPreset({ minute: m });
                  }}
                />
              </div>
            </div>
          )}

          {frequency === "weekly" && (
            <>
              <div>
                <Label className="text-xs">Days</Label>
                <div className="flex gap-1 pt-1">
                  {DOW_LABELS.map((label, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={daysOfWeek.includes(i) ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-10 px-0 text-xs"
                      onClick={() => toggleDay(i)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Hour</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={hour}
                    onChange={(e) => {
                      const h = Math.max(0, Math.min(23, Number(e.target.value)));
                      setHour(h);
                      emitPreset({ hour: h });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Minute</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={minute}
                    onChange={(e) => {
                      const m = Math.max(0, Math.min(59, Number(e.target.value)));
                      setMinute(m);
                      emitPreset({ minute: m });
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {frequency === "monthly" && (
            <>
              <div>
                <Label className="text-xs">Day of Month</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => {
                    const d = Math.max(1, Math.min(28, Number(e.target.value)));
                    setDayOfMonth(d);
                    emitPreset({ dayOfMonth: d });
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Hour</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={hour}
                    onChange={(e) => {
                      const h = Math.max(0, Math.min(23, Number(e.target.value)));
                      setHour(h);
                      emitPreset({ hour: h });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Minute</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={minute}
                    onChange={(e) => {
                      const m = Math.max(0, Math.min(59, Number(e.target.value)));
                      setMinute(m);
                      emitPreset({ minute: m });
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Custom mode */
        <div>
          <Label className="text-xs">Cron Expression (5 fields)</Label>
          <Input
            value={customExpr}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="* * * * *"
            className="font-mono"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            minute hour day-of-month month day-of-week
          </p>
        </div>
      )}

      {/* Preview */}
      <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
        {validationError ? (
          <p className="text-xs text-destructive">
            <i className="fa-solid fa-circle-exclamation mr-1" />
            {validationError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            <i className="fa-solid fa-clock mr-1" />
            {humanText}
            <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">{value}</span>
          </p>
        )}
      </div>
    </div>
  );
}
