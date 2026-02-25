"use client";

import type { CapacityComputeMode } from "@/types";

interface ComputeModeBadgeProps {
  computeMode: CapacityComputeMode;
  activeStaffingConfigName: string | null;
}

export function ComputeModeBadge({ computeMode, activeStaffingConfigName }: ComputeModeBadgeProps) {
  const isStaffing = computeMode === "staffing";
  const icon = isStaffing ? "fa-calendar-days" : "fa-people-group";
  const modeLabel = isStaffing ? "Rotation" : "Headcount Plan";
  const configName = activeStaffingConfigName ?? "Default";

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]
        bg-muted/50 text-muted-foreground border border-border"
      title={`Capacity model: ${modeLabel}${isStaffing ? ` (${configName})` : ""}`}
    >
      <i className={`fa-solid ${icon} text-[9px]`} />
      <span className="font-medium">{modeLabel}</span>
      {isStaffing && activeStaffingConfigName && (
        <>
          <span className="text-border">|</span>
          <span className="truncate max-w-[120px]">{configName}</span>
        </>
      )}
    </div>
  );
}
