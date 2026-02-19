"use client";

import { Suspense, useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { FlightDetailDrawer } from "@/components/flight-board/flight-detail-drawer";
import { useWorkPackages, type SerializedWorkPackage } from "@/lib/hooks/use-work-packages";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFilters } from "@/lib/hooks/use-filters";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useTransformedData } from "@/lib/hooks/use-transformed-data";
import { CustomerBadge } from "@/components/shared/customer-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlightBoardChartHandle } from "@/components/flight-board/flight-board-chart";
import type { ActiveChip } from "@/components/shared/active-chips";

// Dynamic import — ECharts requires window
const FlightBoardChart = dynamic(
  () => import("@/components/flight-board/flight-board-chart").then((mod) => mod.FlightBoardChart),
  { ssr: false, loading: () => <LoadingSkeleton variant="chart" /> },
);

function FlightBoardPageInner() {
  const [zoomLevel, setZoomLevel] = useState("all");
  const [selectedWp, setSelectedWp] = useState<SerializedWorkPackage | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    loaded: prefsLoaded,
    compactMode: condensed,
    defaultZoom,
    update: updatePreferences,
  } = usePreferences();
  const zoomInitializedRef = useRef(false);

  // Sync from localStorage after hydration to avoid mismatch
  useEffect(() => {
    const stored = localStorage.getItem("flightBoardExpanded");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: deferred to avoid SSR hydration mismatch
    if (stored === "true") setIsExpanded(true);
  }, []);

  // Initialize zoom from user preference / system config once prefs have loaded
  useEffect(() => {
    if (!prefsLoaded || zoomInitializedRef.current) return;
    zoomInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: deferred to avoid SSR hydration mismatch
    if (defaultZoom) setZoomLevel(defaultZoom);
  }, [prefsLoaded, defaultZoom]);
  const [viewOpen, setViewOpen] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const chartRef = useRef<FlightBoardChartHandle>(null);

  const { workPackages, isLoading, error } = useWorkPackages();
  const { customers } = useCustomers();
  const { timezone, start: filterStart, end: filterEnd } = useFilters();

  // ✅ PATCH #1: Compute filter span in hours for preset disable logic
  const filterSpanHours = useMemo(() => {
    if (!filterStart || !filterEnd) return 0;
    const spanMs = new Date(filterEnd).getTime() - new Date(filterStart).getTime();
    return spanMs / 3600000;
  }, [filterStart, filterEnd]);

  // Apply actions transforms (sort, breaks, highlights, groupBy, status filter)
  const {
    data: transformedWps,
    registrations,
    highlightMap,
    groups,
  } = useTransformedData(workPackages);

  const handleBarClick = useCallback((wp: SerializedWorkPackage) => {
    setSelectedWp(wp);
    setDrawerOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("flightBoardExpanded", String(next));
      return next;
    });
  }, []);

  const toggleCondensed = useCallback(() => {
    updatePreferences({ compactMode: !condensed });
  }, [condensed, updatePreferences]);

  const handleZoomChange = useCallback(() => setZoomLevel("all"), []);

  const handleZoomIn = useCallback(() => {
    const range = chartRef.current?.getZoomRange();
    if (!range) return;
    setZoomLevel("all");
    const { start, end } = range;
    const span = end - start;
    const shrink = span * 0.25;
    chartRef.current?.dispatchZoom(
      Math.min(start + shrink / 2, 99),
      Math.max(end - shrink / 2, start + shrink / 2 + 1),
    );
  }, []);

  const handleZoomOut = useCallback(() => {
    const range = chartRef.current?.getZoomRange();
    if (!range) return;
    setZoomLevel("all");
    const { start, end } = range;
    const span = end - start;
    const expand = span * 0.25;
    chartRef.current?.dispatchZoom(
      Math.max(0, start - expand / 2),
      Math.min(100, end + expand / 2),
    );
  }, []);

  const handleNow = useCallback(() => {
    if (transformedWps.length === 0) return;
    setZoomLevel("all");

    // ✅ STEP 6: Use filter bounds (not data bounds)
    const filterStartMs = new Date(filterStart).getTime();
    const filterEndMs = new Date(filterEnd).getTime();
    const totalMs = filterEndMs - filterStartMs || 86400000;

    const now = Date.now();

    // ✅ STEP 6: Use current zoom span (not hardcoded 24h)
    const currentRange = chartRef.current?.getZoomRange();
    const currentSpan = currentRange ? currentRange.end - currentRange.start : 50;
    const rangeMs = (currentSpan / 100) * totalMs;

    const startMs = now - rangeMs / 2;
    const endMs = now + rangeMs / 2;

    const startPct = Math.max(0, ((startMs - filterStartMs) / totalMs) * 100);
    const endPct = Math.min(100, ((endMs - filterStartMs) / totalMs) * 100);

    chartRef.current?.dispatchZoom(startPct, endPct);
  }, [transformedWps, filterStart, filterEnd]);

  const handleFit = useCallback(() => {
    setZoomLevel("all");
    chartRef.current?.dispatchZoom(0, 100);
  }, []);

  // Build format chips for non-default zoom
  const formatChips: ActiveChip[] = useMemo(
    () =>
      zoomLevel !== "all"
        ? [
            {
              id: "zoom",
              label: `Zoom: ${zoomLevel}`,
              icon: "fa-solid fa-magnifying-glass",
              onRemove: () => setZoomLevel("3d"),
            },
          ]
        : [],
    [zoomLevel],
  );

  const ZOOM_LEVELS = [
    { id: "6h", label: "6h" },
    { id: "12h", label: "12h" },
    { id: "1d", label: "1d" },
    { id: "3d", label: "3d" },
    { id: "1w", label: "1w" },
  ];

  return (
    <div className={cn("flex flex-col gap-3", !isExpanded && "h-full min-h-0")}>
      <TopMenuBar
        title="Flight Board"
        icon="fa-solid fa-plane-departure"
        formatChips={formatChips}
        actions={
          <div className="flex items-center gap-1">
            {/* Inline items — slide out to the left when viewOpen */}
            <div
              className={cn(
                "flex items-center gap-1 overflow-hidden transition-all duration-200",
                viewOpen ? "max-w-[600px] opacity-100" : "max-w-0 opacity-0",
              )}
            >
              {/* Zoom presets */}
              <div className="flex items-center rounded-md border bg-muted/50 p-0.5 shrink-0">
                {ZOOM_LEVELS.map((level) => {
                  const levelHours = parseInt(level.id); // "6h" → 6, "12h" → 12, etc.
                  const disabled = filterSpanHours < levelHours;

                  return (
                    <Button
                      key={level.id}
                      variant={zoomLevel === level.id ? "default" : "ghost"}
                      size="sm"
                      disabled={disabled} // ✅ Disable when filter span < preset hours
                      title={
                        disabled
                          ? `Disabled: filter range is only ${filterSpanHours.toFixed(1)}h`
                          : undefined
                      }
                      className={cn(
                        "h-7 px-2 text-xs",
                        zoomLevel !== level.id && "text-muted-foreground",
                      )}
                      onClick={() => setZoomLevel(level.id)}
                    >
                      {level.label}
                    </Button>
                  );
                })}
              </div>

              {/* Zoom +/- */}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={handleZoomIn}
                title="Zoom in"
              >
                <i className="fa-solid fa-magnifying-glass-plus text-xs" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={handleZoomOut}
                title="Zoom out"
              >
                <i className="fa-solid fa-magnifying-glass-minus text-xs" />
              </Button>

              {/* Expand/Collapse */}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={toggleExpanded}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                <i className={cn("fa-solid", isExpanded ? "fa-compress" : "fa-expand")} />
              </Button>

              {/* Condensed view */}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={toggleCondensed}
                title={condensed ? "Normal density" : "Condensed view"}
              >
                <i className={cn("fa-solid", condensed ? "fa-bars" : "fa-bars-staggered")} />
              </Button>

              {/* Center on Now */}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={handleNow}
                title="Center on Now"
              >
                <i className="fa-solid fa-clock text-xs" />
              </Button>

              {/* Fit All */}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={handleFit}
                title="Fit All Data"
              >
                <i className="fa-solid fa-arrows-left-right-to-line text-xs" />
              </Button>

              {/* Hand tool (pan mode) */}
              <Button
                variant={panMode ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => setPanMode((v) => !v)}
                title={panMode ? "Switch to pointer" : "Hand tool (drag to pan)"}
              >
                <i className="fa-solid fa-hand text-xs" />
              </Button>
            </div>

            {/* View toggle button */}
            <Button
              variant={viewOpen ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs gap-1.5 shrink-0"
              onClick={() => setViewOpen((v) => !v)}
            >
              <i className="fa-solid fa-sliders" />
              View
            </Button>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-xs shrink-0"
              onClick={handleRefresh}
            >
              <i className="fa-solid fa-arrows-rotate" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Gantt Chart */}
      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton variant="chart" />
      ) : (
        <div
          className={cn(
            "rounded-lg border border-border bg-card overflow-hidden",
            !isExpanded && "flex-1 min-h-0 flex flex-col",
          )}
        >
          <FlightBoardChart
            ref={chartRef}
            workPackages={transformedWps}
            zoomLevel={zoomLevel}
            timezone={timezone}
            filterStart={filterStart}
            filterEnd={filterEnd}
            isExpanded={isExpanded}
            condensed={condensed}
            onBarClick={handleBarClick}
            onZoomChange={handleZoomChange}
            transformedRegistrations={registrations}
            highlightMap={highlightMap}
            groups={groups}
            panMode={panMode}
          />
        </div>
      )}

      {/* Interaction hints */}
      <p className="text-[11px] text-muted-foreground flex-shrink-0">
        Ctrl+Scroll to zoom · Shift+Scroll to pan · Click bar for details · Hand tool to drag-pan
      </p>

      {/* Legend */}
      {customers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1 flex-shrink-0">
          {customers
            .filter((c) => c.isActive)
            .map((c) => (
              <CustomerBadge key={c.id} name={c.displayName} color={c.color} />
            ))}
        </div>
      )}

      {/* Detail Drawer */}
      <FlightDetailDrawer wp={selectedWp} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

export default function FlightBoardPage() {
  return (
    <Suspense fallback={null}>
      <FlightBoardPageInner />
    </Suspense>
  );
}
