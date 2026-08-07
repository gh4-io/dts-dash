"use client";

import { Suspense, useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { FlightDetailDrawer } from "@/components/flight-board/flight-detail-drawer";
import {
  useWorkPackages,
  useWorkPackagesStore,
  type SerializedWorkPackage,
} from "@/lib/hooks/use-work-packages";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFilters } from "@/lib/hooks/use-filters";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { useTransformedData } from "@/lib/hooks/use-transformed-data";
import { CustomerBadge } from "@/components/shared/customer-badge";
import { PrintButton } from "@/components/shared/print-button";
import { FlightBoardListCards } from "@/components/flight-board/flight-board-list-cards";
import { FlightBoardListTable } from "@/components/flight-board/flight-board-list-table";
import { FlightBoardViewControls } from "@/components/flight-board/flight-board-view-controls";
import { Button } from "@/components/ui/button";
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
    // Default view: list for phone always, list for tablet in portrait, gantt otherwise
    const isTabletPortrait = device.type === "tablet" && !device.isLandscape;
    const defaultViewMode = device.type === "phone" || isTabletPortrait ? "list" : "gantt";

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: deferred hydration from localStorage to avoid SSR mismatch
    if (expanded) setIsExpanded(true);
    setViewMode(defaultViewMode);
    setHydrated(true);
  }, [device.type, device.isLandscape]);

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
  const filters = useFilters();
  const { timezone, start: filterStart, end: filterEnd } = filters;
  const refetchWps = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.start) params.start = filters.start;
    if (filters.end) params.end = filters.end;
    if (filters.operators.length > 0) params.operators = filters.operators.join(",");
    if (filters.aircraft.length > 0) params.aircraft = filters.aircraft.join(",");
    if (filters.types.length > 0) params.types = filters.types.join(",");
    useWorkPackagesStore.getState().fetchAll(params);
  }, [filters]);

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

  return (
    <div className={cn("flex flex-col gap-3", !isExpanded && "h-full min-h-0")}>
      <TopMenuBar
        title="Flight Board"
        icon="fa-solid fa-plane-departure"
        formatChips={formatChips}
        actions={
          <FlightBoardViewControls
            viewMode={viewMode}
            setViewMode={setViewMode}
            viewOpen={viewOpen}
            setViewOpen={setViewOpen}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            filterSpanHours={filterSpanHours}
            isExpanded={isExpanded}
            condensed={condensed}
            hydrated={hydrated}
            panMode={panMode}
            useVerticalView={useVerticalView}
            isPhone={device.type === "phone"}
            isDesktop={device.type === "desktop"}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onToggleCondensed={toggleCondensed}
            onNow={handleNow}
            onFit={handleFit}
            onToggleExpanded={toggleExpanded}
            onTogglePanMode={() => setPanMode((v) => !v)}
            printButton={
              device.type === "desktop" ? (
                <PrintButton
                  contentRef={printRef}
                  documentTitle="Flight Board — CVG Line Maintenance"
                  onBeforePrint={handleBeforePrint}
                  onAfterPrint={handleAfterPrint}
                />
              ) : undefined
            }
            refreshButton={
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-xs shrink-0"
                onClick={handleRefresh}
              >
                <i className="fa-solid fa-arrows-rotate" />
                Refresh
              </Button>
            }
          />
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
        ) : device.type === "phone" ? (
          <div
            className={cn("-mx-4 overflow-hidden", !isExpanded && "flex-1 min-h-0 flex flex-col")}
          >
            <FlightBoardListCards
              workPackages={transformedWps}
              onCardClick={handleBarClick}
              isExpanded={isExpanded}
              timezone={timezone}
            />
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg border border-border bg-card overflow-hidden print:border-0",
              !isExpanded && "flex-1 min-h-0 flex flex-col",
            )}
          >
            <FlightBoardListTable
              workPackages={transformedWps}
              onRowClick={handleBarClick}
              isExpanded={isExpanded}
            />
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
      <FlightDetailDrawer
        wp={selectedWp}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onWpUpdated={refetchWps}
      />
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
