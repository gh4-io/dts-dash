"use client";

import { useReducer, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { AppConfig, ShiftDefinition } from "@/types";

interface ConfigPanelProps {
  config: AppConfig;
  onConfigChange: (updates: Partial<AppConfig>) => Promise<void>;
  onRefetch: () => void;
}

type LocalState = {
  defaultMH: number;
  wpMHMode: "include" | "exclude";
  shifts: ShiftDefinition[];
  isDirty: boolean;
};

type Action =
  | { type: "SET_MH"; value: number }
  | { type: "SET_WP_MODE"; value: "include" | "exclude" }
  | { type: "SET_HEADCOUNT"; shiftName: string; delta: number }
  | { type: "APPLIED" };

function reducer(state: LocalState, action: Action): LocalState {
  switch (action.type) {
    case "SET_MH":
      return { ...state, defaultMH: action.value, isDirty: true };
    case "SET_WP_MODE":
      return { ...state, wpMHMode: action.value, isDirty: true };
    case "SET_HEADCOUNT":
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.name === action.shiftName
            ? { ...s, headcount: Math.max(0, s.headcount + action.delta) }
            : s
        ),
        isDirty: true,
      };
    case "APPLIED":
      return { ...state, isDirty: false };
    default:
      return state;
  }
}

/**
 * Config panel for capacity modeling parameters.
 * Key this component on config version from parent to reset state on upstream changes:
 *   <ConfigPanel key={configKey} config={config} ... />
 */
export function ConfigPanel({
  config,
  onConfigChange,
  onRefetch,
}: ConfigPanelProps) {
  const [state, dispatch] = useReducer(reducer, {
    defaultMH: config.defaultMH,
    wpMHMode: config.wpMHMode,
    shifts: config.shifts,
    isDirty: false,
  });

  const handleDefaultMHChange = useCallback((value: number[]) => {
    dispatch({ type: "SET_MH", value: value[0] });
  }, []);

  const handleWpMHToggle = useCallback((checked: boolean) => {
    dispatch({ type: "SET_WP_MODE", value: checked ? "include" : "exclude" });
  }, []);

  const handleHeadcountChange = useCallback(
    (shiftName: string, delta: number) => {
      dispatch({ type: "SET_HEADCOUNT", shiftName, delta });
    },
    []
  );

  const handleApply = useCallback(async () => {
    await onConfigChange({
      defaultMH: state.defaultMH,
      wpMHMode: state.wpMHMode,
      shifts: state.shifts,
    });
    dispatch({ type: "APPLIED" });
    onRefetch();
  }, [state.defaultMH, state.wpMHMode, state.shifts, onConfigChange, onRefetch]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
        <i className="fa-solid fa-sliders" />
        Capacity Configuration
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Default MH Slider */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Default MH per WP
          </Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[state.defaultMH]}
              onValueChange={handleDefaultMHChange}
              min={0.5}
              max={10}
              step={0.5}
              className="flex-1"
            />
            <span className="text-sm font-mono w-10 text-right tabular-nums">
              {state.defaultMH.toFixed(1)}
            </span>
          </div>
        </div>

        {/* WP MH Include/Exclude Toggle */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            WP Man-Hours
          </Label>
          <div className="flex items-center gap-2">
            <Switch
              checked={state.wpMHMode === "include"}
              onCheckedChange={handleWpMHToggle}
            />
            <span className="text-sm">
              {state.wpMHMode === "include"
                ? "Use WP hours when available"
                : "Use default MH only"}
            </span>
          </div>
        </div>

        {/* Shift Headcounts */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Shift Headcounts
          </Label>
          <div className="flex gap-3">
            {state.shifts.map((shift) => (
              <ShiftControl
                key={shift.name}
                shift={shift}
                onIncrement={() => handleHeadcountChange(shift.name, 1)}
                onDecrement={() => handleHeadcountChange(shift.name, -1)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Apply Button */}
      {state.isDirty && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={handleApply}>
            <i className="fa-solid fa-check mr-1.5" />
            Apply Changes
          </Button>
        </div>
      )}
    </div>
  );
}

function ShiftControl({
  shift,
  onIncrement,
  onDecrement,
}: {
  shift: ShiftDefinition;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const shiftIcon =
    shift.name === "Day"
      ? "fa-sun"
      : shift.name === "Swing"
        ? "fa-cloud-sun"
        : "fa-moon";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <i className={`fa-solid ${shiftIcon} text-[9px]`} />
        {shift.name}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onDecrement}
          disabled={shift.headcount <= 0}
          className="h-6 w-6 rounded border border-border bg-muted text-xs hover:bg-accent disabled:opacity-30 flex items-center justify-center"
        >
          -
        </button>
        <span className="text-sm font-mono w-6 text-center tabular-nums">
          {shift.headcount}
        </span>
        <button
          onClick={onIncrement}
          className="h-6 w-6 rounded border border-border bg-muted text-xs hover:bg-accent flex items-center justify-center"
        >
          +
        </button>
      </div>
      <span className="text-[9px] text-muted-foreground">
        {String(shift.startHour).padStart(2, "0")}–
        {String(shift.endHour).padStart(2, "0")}
      </span>
    </div>
  );
}
