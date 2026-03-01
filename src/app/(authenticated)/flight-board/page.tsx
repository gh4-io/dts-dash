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
import { PrintButton } from "@/components/shared/print-button";
import { FlightBoardListCards } from "@/components/flight-board/flight-board-list-cards";
import { FlightBoardListTable } from "@/components/flight-board/flight-board-list-table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/lib/hooks/use-sidebar";
import { useDeviceType } from "@/lib/hooks/use-device-type";
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
  const [hydrated, setHydrated] = useState(false);
  const device = useDeviceType();
  const [viewMode, setViewMode] = useState<"gantt" | "list">("gantt");
  const [viewOpen, setViewOpen] = useState(false);
  const [panMode, setPanMode] = useState(false);

  const {
    loaded: prefsLoaded,
    compactMode: condensed,
    defaultZoom,
    update: updatePreferences,
  } = usePreferences();
  const zoomInitializedRef = useRef(false);
  const chartRef = useRef<FlightBoardChartHandle>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Determine if we're too narrow for horizontal inline expansion
  const sidebarMode = useSidebar((s) => s.mode);
  const [windowWidth, setWindowWidth] = useState(1920);

  // Sync from localStorage and device type after first render
  useEffect(() => {
    // Set hydration and load persistent state from localStorage
    const expandedRaw = localStorage.getItem("flightBoardExpanded");
    const expanded = expandedRaw !== null ? expandedRaw === "true" : device.type === "phone";
    const viewFromStorage = localStorage.getItem("flightBoardViewMode");
    const defaultViewMode = device.type === "phone" ? "list" : "gantt";
    const viewModeFromStorage =
      viewFromStorage === "list" || viewFromStorage === "gantt" ? viewFromStorage : defaultViewMode;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: deferred hydration from localStorage to avoid SSR mismatch
    if (expanded) setIsExpanded(true);
    if (viewModeFromStorage !== "gantt") setViewMode(viewModeFromStorage);
    setHydrated(true);
  }, [device.type]);

  useEffect(() => {
    const handleResize = () => {
      setViewOpen(false);
      setWindowWidth(window.innerWidth);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initialize state from current window on mount
    setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sidebar expanded ≈ needs ~1600px; sidebar folded/icons ≈ needs ~1280px
  const narrowThreshold = sidebarMode === "expanded" ? 1600 : 1280;
  const useVerticalView = windowWidth < narrowThreshold;

  // Initialize zoom from user preference / system config once prefs have loaded
  useEffect(() => {
    if (!prefsLoaded || zoomInitializedRef.current) return;
    zoomInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: deferred hydration from user preferences
    if (defaultZoom) setZoomLevel(defaultZoom);
  }, [prefsLoaded, defaultZoom]);

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
    shiftHighlights,
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

  const handleBeforePrint = useCallback(async () => {
    if (viewMode === "gantt") {
      await chartRef.current?.prepareForPrint();
    }
  }, [viewMode]);

  const handleAfterPrint = useCallback(() => {
    chartRef.current?.restoreAfterPrint();
  }, []);

  // SUPPRESSED: Zoom format chips hidden — zoom preset tags not shown in TopMenuBar.
  const formatChips: ActiveChip[] = [];

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
            {/* View panel — always visible (both Gantt and List modes) */}
            {!useVerticalView && (
              <>
                {/* Horizontal inline expansion */}
                <div
                  className={cn(
                    "flex items-center gap-1 overflow-hidden transition-all duration-200",
                    viewOpen ? "max-w-[700px] opacity-100" : "max-w-0 opacity-0",
                  )}
                >
                  {/* Gantt / List toggle — hidden on phone */}
                  {device.type !== "phone" && (
                    <div className="flex items-center rounded-md border bg-muted/50 p-0.5 shrink-0">
                      <Button
                        variant={viewMode === "gantt" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setViewMode("gantt");
                          localStorage.setItem("flightBoardViewMode", "gantt");
                        }}
                        title="Gantt chart"
                      >
                        <i className="fa-solid fa-chart-gantt" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "default" : "ghost"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setViewMode("list");
                          localStorage.setItem("flightBoardViewMode", "list");
                        }}
                        title="List view"
                      >
                        <i className="fa-solid fa-list" />
                      </Button>
                    </div>
                  )}

                  {/* Gantt-specific controls */}
                  {viewMode === "gantt" && (
                    <>
                      <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
                      {/* Zoom presets */}
                      <div className="flex items-center rounded-md border bg-muted/50 p-0.5 shrink-0">
                        {ZOOM_LEVELS.map((level) => {
                          const levelHours = parseInt(level.id);
                          const disabled = filterSpanHours < levelHours;
                          return (
                            <Button
                              key={level.id}
                              variant={zoomLevel === level.id ? "default" : "ghost"}
                              size="sm"
                              disabled={disabled}
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
                      {hydrated && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 shrink-0"
                          onClick={toggleCondensed}
                          title={condensed ? "Normal density" : "Condensed view"}
                        >
                          <i
                            className={cn("fa-solid", condensed ? "fa-bars" : "fa-bars-staggered")}
                          />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={handleNow}
                        title="Center on Now"
                      >
                        <i className="fa-solid fa-clock text-xs" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={handleFit}
                        title="Fit All Data"
                      >
                        <i className="fa-solid fa-arrows-left-right-to-line text-xs" />
                      </Button>
                      <Button
                        variant={panMode ? "default" : "ghost"}
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0"
                        onClick={() => setPanMode((v) => !v)}
                        title={panMode ? "Switch to pointer" : "Hand tool (drag to pan)"}
                      >
                        <i className="fa-solid fa-hand text-xs" />
                      </Button>
                    </>
                  )}

                  {/* Expand/Collapse — always visible */}
                  <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0"
                    onClick={toggleExpanded}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    <i className={cn("fa-solid", isExpanded ? "fa-compress" : "fa-expand")} />
                  </Button>
                </div>
                <Button
                  variant={viewOpen ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-xs gap-1.5 shrink-0"
                  onClick={() => setViewOpen((v) => !v)}
                >
                  <i className="fa-solid fa-sliders" />
                  View
                </Button>
              </>
            )}

            {useVerticalView && (
              <Popover open={viewOpen} onOpenChange={setViewOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={viewOpen ? "default" : "outline"}
                    size="sm"
                    className="h-9 text-xs gap-1.5 shrink-0"
                  >
                    <i className="fa-solid fa-sliders" />
                    View
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-1.5 space-y-0.5">
                  {/* Gantt / List toggle */}
                  <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
                    <Button
                      variant={viewMode === "gantt" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs flex-1"
                      onClick={() => {
                        setViewMode("gantt");
                        localStorage.setItem("flightBoardViewMode", "gantt");
                      }}
                      title="Gantt chart"
                    >
                      <i className="fa-solid fa-chart-gantt mr-1.5" />
                      Gantt
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs flex-1"
                      onClick={() => {
                        setViewMode("list");
                        localStorage.setItem("flightBoardViewMode", "list");
                      }}
                      title="List view"
                    >
                      <i className="fa-solid fa-list mr-1.5" />
                      List
                    </Button>
                  </div>

                  {/* Gantt-specific controls */}
                  {viewMode === "gantt" && (
                    <>
                      <div className="border-t border-border my-1" />

                      {/* Zoom presets — single row */}
                      <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
                        {ZOOM_LEVELS.map((level) => {
                          const levelHours = parseInt(level.id);
                          const disabled = filterSpanHours < levelHours;
                          return (
                            <Button
                              key={level.id}
                              variant={zoomLevel === level.id ? "default" : "ghost"}
                              size="sm"
                              disabled={disabled}
                              title={
                                disabled
                                  ? `Disabled: filter range is only ${filterSpanHours.toFixed(1)}h`
                                  : undefined
                              }
                              className={cn(
                                "h-7 px-2 text-xs flex-1",
                                zoomLevel !== level.id && "text-muted-foreground",
                              )}
                              onClick={() => {
                                setZoomLevel(level.id);
                                setViewOpen(false);
                              }}
                            >
                              {level.label}
                            </Button>
                          );
                        })}
                      </div>

                      <div className="border-t border-border my-1" />

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 text-xs"
                        onClick={handleZoomIn}
                      >
                        <i className="fa-solid fa-magnifying-glass-plus w-4 text-center text-muted-foreground" />
                        Zoom In
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 text-xs"
                        onClick={handleZoomOut}
                      >
                        <i className="fa-solid fa-magnifying-glass-minus w-4 text-center text-muted-foreground" />
                        Zoom Out
                      </Button>

                      <div className="border-t border-border my-1" />

                      {hydrated && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start gap-2 text-xs"
                          onClick={() => {
                            toggleCondensed();
                            setViewOpen(false);
                          }}
                        >
                          <i
                            className={cn(
                              "fa-solid w-4 text-center text-muted-foreground",
                              condensed ? "fa-bars" : "fa-bars-staggered",
                            )}
                          />
                          {condensed ? "Normal Density" : "Condensed"}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 text-xs"
                        onClick={() => {
                          handleNow();
                          setViewOpen(false);
                        }}
                      >
                        <i className="fa-solid fa-clock w-4 text-center text-muted-foreground" />
                        Center on Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2 text-xs"
                        onClick={() => {
                          handleFit();
                          setViewOpen(false);
                        }}
                      >
                        <i className="fa-solid fa-arrows-left-right-to-line w-4 text-center text-muted-foreground" />
                        Fit All Data
                      </Button>

                      <div className="border-t border-border my-1" />

                      <Button
                        variant={panMode ? "default" : "ghost"}
                        size="sm"
                        className="h-8 w-full justify-start gap-2 text-xs"
                        onClick={() => {
                          setPanMode((v) => !v);
                          setViewOpen(false);
                        }}
                      >
                        <i className="fa-solid fa-hand w-4 text-center text-muted-foreground" />
                        {panMode ? "Pointer Mode" : "Pan Mode"}
                      </Button>
                    </>
                  )}

                  <div className="border-t border-border my-1" />

                  {/* Expand/Collapse — always visible */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 text-xs"
                    onClick={() => {
                      toggleExpanded();
                      setViewOpen(false);
                    }}
                  >
                    <i
                      className={cn(
                        "fa-solid w-4 text-center text-muted-foreground",
                        isExpanded ? "fa-compress" : "fa-expand",
                      )}
                    />
                    {isExpanded ? "Collapse" : "Expand"}
                  </Button>
                </PopoverContent>
              </Popover>
            )}

            {/* Print */}
            <PrintButton
              contentRef={printRef}
              documentTitle="Flight Board — CVG Line Maintenance"
              onBeforePrint={handleBeforePrint}
              onAfterPrint={handleAfterPrint}
            />

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

      {/* Printable content wrapper */}
      <div ref={printRef} className="flex flex-col gap-3 flex-1 min-h-0">
        {/* Chart / List */}
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : isLoading ? (
          <LoadingSkeleton variant="chart" />
        ) : viewMode === "gantt" ? (
          <div
            className={cn(
              "rounded-lg border border-border bg-card overflow-hidden print:border-0",
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
              shiftHighlights={shiftHighlights}
              panMode={panMode}
            />
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg border border-border bg-card overflow-hidden print:border-0",
              !isExpanded && "flex-1 min-h-0 flex flex-col",
            )}
          >
            {device.type === "phone" ? (
              <FlightBoardListCards
                workPackages={transformedWps}
                onCardClick={handleBarClick}
                isExpanded={isExpanded}
              />
            ) : (
              <FlightBoardListTable
                workPackages={transformedWps}
                onRowClick={handleBarClick}
                isExpanded={isExpanded}
              />
            )}
          </div>
        )}

        {/* Legend — hidden on phone (colors shown inline on list cards) */}
        {customers.length > 0 && device.type !== "phone" && (
          <div className="flex flex-wrap items-center gap-4 px-1 flex-shrink-0">
            {customers
              .filter((c) => c.isActive)
              .map((c) => (
                <CustomerBadge key={c.id} name={c.displayName} color={c.color} />
              ))}
          </div>
        )}
      </div>

      {/* Interaction hints — Gantt only (hidden in print) */}
      {viewMode === "gantt" && (
        <p className="text-[11px] text-muted-foreground flex-shrink-0 print-hide">
          Ctrl+Scroll to zoom · Shift+Scroll to pan · Click bar for details · Hand tool to drag-pan
        </p>
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
