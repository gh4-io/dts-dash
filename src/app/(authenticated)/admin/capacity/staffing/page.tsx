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

      {/* Three-panel layout.
          The side columns were pinned at 320px for every width from lg up, so the
          weekly matrix stayed 277px of usable space on a 4K display while the middle
          column swallowed the extra — the Saturday and Tot columns were clipped no
          matter how large the screen. Give the matrix room as the viewport grows;
          490px at 2xl clears its 433px content width in every view mode.
          Below 2xl the rotations panel condenses (pattern dots and the Select
          toggle hide, Add drops to a bare "+"), so it gives width back to the
          shift grid rather than holding 320px it can no longer fill.

          The shift grid has a hard floor of 420px (`minmax(420px, 1fr)`) — it is
          the working surface and must not keep shrinking. At lg the weekly matrix
          therefore drops out of the side-by-side row and stacks full width
          beneath, so the squeeze lands on the panel that can afford it. */}
      <div
        className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_minmax(420px,1fr)] xl:grid-cols-[200px_minmax(420px,1fr)_400px] 2xl:grid-cols-[340px_minmax(420px,1fr)_490px]"
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

        {/* Right: Weekly Matrix + Stats.
            At lg there is no third column — it stacks full width under the other
            two rather than competing with the shift grid for horizontal space. */}
        <div className="rounded-lg border border-border bg-card overflow-hidden lg:col-span-2 lg:max-h-none xl:col-span-1 xl:max-h-[calc(100vh-280px)]">
          <WeeklyMatrixPanel configId={selectedConfigId} />
        </div>
      </div>
    </div>
  );
}
