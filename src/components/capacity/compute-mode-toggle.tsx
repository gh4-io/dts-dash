"use client";

import type { CapacityComputeMode } from "@/types";

interface ComputeModeToggleProps {
  computeMode: CapacityComputeMode;
  autoMode: CapacityComputeMode;
  modeOverride: CapacityComputeMode | null;
  activeStaffingConfigName: string | null;
  onModeChange: (mode: CapacityComputeMode | null) => void;
}

const MODE_OPTIONS: { value: CapacityComputeMode; label: string; icon: string }[] = [
  { value: "staffing", label: "Rotation", icon: "fa-solid fa-calendar-days" },
  { value: "headcount", label: "Headcount", icon: "fa-solid fa-people-group" },
];

export function ComputeModeToggle({
  computeMode,
  autoMode,
  modeOverride,
  activeStaffingConfigName,
  onModeChange,
}: ComputeModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Model
      </span>
      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {MODE_OPTIONS.map((opt) => {
          const isActive = computeMode === opt.value;
          const isDefault = autoMode === opt.value;
          return (
            <button
              key={opt.value}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onModeChange(opt.value === autoMode ? null : opt.value)}
              title={`${opt.label}${isDefault ? " (server default)" : ""}`}
            >
              <i className={`${opt.icon} text-[9px]`} />
              {opt.label}
              {isDefault && <span className="text-[8px] opacity-60 ml-0.5">*</span>}
            </button>
          );
        })}
      </div>
      {computeMode === "staffing" && activeStaffingConfigName && (
        <span
          className="text-[10px] text-muted-foreground truncate max-w-[120px]"
          title={activeStaffingConfigName}
        >
          {activeStaffingConfigName}
        </span>
      )}
      {modeOverride && (
        <button
          onClick={() => onModeChange(null)}
          className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          title="Reset to server default"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      )}
    </div>
  );
}
