"use client";

import { useState, useEffect, useCallback } from "react";
import { RotationPatternList } from "@/components/admin/capacity/rotation-pattern-list";
import { StaffingConfigSelector } from "@/components/admin/capacity/staffing-config-selector";
import { ShiftDefinitionsGrid } from "@/components/admin/capacity/shift-definitions-grid";
import { WeeklyMatrixPanel } from "@/components/admin/capacity/weekly-matrix-panel";
import type { RotationPattern, StaffingShift, StaffingConfigSummary } from "@/types";

export default function StaffingPage() {
  const [patterns, setPatterns] = useState<RotationPattern[]>([]);
  const [configs, setConfigs] = useState<StaffingConfigSummary[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [shifts, setShifts] = useState<StaffingShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rotationsCollapsed, setRotationsCollapsed] = useState(false);
  const [shiftsCollapsed, setShiftsCollapsed] = useState(false);

  // Fetch patterns
  useEffect(() => {
    fetch("/api/admin/capacity/rotation-patterns")
      .then((r) => r.json())
      .then(setPatterns)
      .catch(() => setPatterns([]));
  }, [refreshKey]);

  // Fetch configs
  useEffect(() => {
    fetch("/api/admin/capacity/staffing-configs")
      .then((r) => r.json())
      .then((data: StaffingConfigSummary[]) => {
        setConfigs(data);
        // Auto-select: active config > first config > null
        if (!selectedConfigId || !data.find((c) => c.id === selectedConfigId)) {
          const active = data.find((c) => c.isActive);
          setSelectedConfigId(active?.id ?? data[0]?.id ?? null);
        }
        setLoading(false);
      })
      .catch(() => {
        setConfigs([]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Fetch shifts for selected config
  useEffect(() => {
    if (!selectedConfigId) {
      setShifts([]);
      return;
    }
    fetch(`/api/admin/capacity/staffing-shifts?configId=${selectedConfigId}`)
      .then((r) => r.json())
      .then(setShifts)
      .catch(() => setShifts([]));
  }, [selectedConfigId, refreshKey]);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin text-xl text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Config selector toolbar */}
      <div className="rounded-lg border border-border bg-card px-4 py-2.5">
        <StaffingConfigSelector
          configs={configs}
          selectedId={selectedConfigId}
          onSelect={setSelectedConfigId}
          onRefresh={triggerRefresh}
        />
      </div>

      {/* Three-panel layout */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-3"
        style={{ minHeight: "calc(100vh - 280px)" }}
      >
        {/* Left: Rotation Patterns */}
        <div className="rounded-lg border border-border bg-card overflow-hidden lg:max-h-[calc(100vh-280px)]">
          <RotationPatternList
            patterns={patterns}
            onRefresh={triggerRefresh}
            collapsed={rotationsCollapsed}
            onToggleCollapse={() => setRotationsCollapsed((v) => !v)}
          />
        </div>

        {/* Center: Shift Definitions */}
        <div className="rounded-lg border border-border bg-card overflow-hidden lg:max-h-[calc(100vh-280px)]">
          {selectedConfigId ? (
            <ShiftDefinitionsGrid
              configId={selectedConfigId}
              shifts={shifts}
              patterns={patterns}
              onRefresh={triggerRefresh}
              collapsed={shiftsCollapsed}
              onToggleCollapse={() => setShiftsCollapsed((v) => !v)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <i className="fa-solid fa-layer-group text-3xl mb-3 opacity-30" />
              <p className="text-sm">No config selected</p>
              <p className="text-xs mt-1">Create or select a staffing configuration above</p>
            </div>
          )}
        </div>

        {/* Right: Weekly Matrix + Stats */}
        <div className="rounded-lg border border-border bg-card overflow-hidden lg:max-h-[calc(100vh-280px)]">
          <WeeklyMatrixPanel configId={selectedConfigId} />
        </div>
      </div>
    </div>
  );
}
