"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { TopMenuBar } from "@/components/shared/top-menu-bar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
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
import { trackAction } from "@/lib/analytics/track";
import type { ActiveChip } from "@/components/shared/active-chips";
import { FOCUS_SCOPES, type FocusScope } from "@/lib/utils/flight-board-focus";

// Dynamic import — ECharts requires window
const FlightBoardChart = dynamic(
  () => import("@/components/flight-board/flight-board-chart").then((mod) => mod.FlightBoardChart),
  { ssr: false, loading: () => <LoadingSkeleton variant="chart" /> },
);

/** What the board remembers for the session so Back restores the view you left. */
interface CachedView {
  viewMode?: "gantt" | "list";
  zoomLevel?: string;
  zoomStart?: number;
  zoomEnd?: number;
}

const CACHE_PREFIX = "fbView:";

function readCachedView(key: string): CachedView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as CachedView) : null;
  } catch {
    // sessionStorage can be unavailable (private mode, blocked storage).
    // The cache is a convenience, never a correctness requirement.
    return null;
  }
}

function writeCachedView(key: string, patch: CachedView) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...(readCachedView(key) ?? {}), ...patch };
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(next));
  } catch {
    /* best effort — see readCachedView */
  }
}

export interface FlightBoardViewProps {
  title: string;
  /** Font Awesome class for the heading. */
  icon: string;
  /**
   * Session key for the remembered view state. Distinct per view so the board
   * and each Focus subject keep their own zoom instead of fighting over one.
   */
  viewKey: string;
  /**
   * Pins the view to a single subject (the Focus view). The subject narrows the
   * rows but is never written to the filter store, so it cannot follow the user
   * back to the board — and never appears as a removable chip.
   */
  focus?: { scope: FocusScope; subject: string } | null;
  /** Renders a back link above the title. */
  backHref?: string;
  backLabel?: string;
}

export function FlightBoardView({
  title,
  icon,
  viewKey,
  focus = null,
  backHref,
  backLabel = "Flight Board",
}: FlightBoardViewProps) {
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
  /** Zoom window restored from the session cache, waiting for the chart to exist. */
  const pendingZoomRef = useRef<{ start: number; end: number } | null>(null);

  // Depend on whether a subject is pinned, not on the `focus` object itself —
  // the Focus page rebuilds that object every render, which would re-run the
  // hydration effect continuously. A change of subject moves `viewKey` anyway.
  const isFocus = focus !== null;

  // Determine if we're too narrow for horizontal inline expansion
  const sidebarMode = useSidebar((s) => s.mode);
  const [windowWidth, setWindowWidth] = useState(1920);

  // Sync from localStorage and device type after first render. Re-runs on
  // viewKey so navigating between Focus subjects picks up that view's cache.
  useEffect(() => {
    const expandedRaw = localStorage.getItem("flightBoardExpanded");
    const expanded = expandedRaw !== null ? expandedRaw === "true" : device.type === "phone";
    // Default view: list for phone always, list for tablet in portrait, gantt otherwise.
    // The Focus view defaults to list on every device — following one of these
    // links asks a question whose answer is a set of rows, not a timeline. The
    // Gantt is still one click away, and the choice is remembered per subject.
    const isTabletPortrait = device.type === "tablet" && !device.isLandscape;
    const defaultViewMode =
      isFocus || device.type === "phone" || isTabletPortrait ? "list" : "gantt";
    const cached = readCachedView(viewKey);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: deferred hydration from localStorage to avoid SSR mismatch
    if (expanded) setIsExpanded(true);
    setViewMode(cached?.viewMode ?? defaultViewMode);
    if (cached?.zoomLevel) {
      setZoomLevel(cached.zoomLevel);
      // A remembered level wins over the saved preference below.
      zoomInitializedRef.current = true;
    }
    pendingZoomRef.current =
      cached?.zoomStart != null && cached?.zoomEnd != null
        ? { start: cached.zoomStart, end: cached.zoomEnd }
        : null;
    setHydrated(true);
  }, [device.type, device.isLandscape, viewKey, isFocus]);

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

  // Narrow to the pinned subject before any transform runs, so the Gantt lanes,
  // the list, the legend and the drawer all agree. useWorkPackages already
  // fetches the whole window, so this costs nothing extra — and crucially it
  // keeps the subject out of both the fetch params and the filter store.
  const scopedWps = useMemo(() => {
    if (!focus) return workPackages;
    const { match } = FOCUS_SCOPES[focus.scope];
    return workPackages.filter((wp) => match(wp, focus.subject));
  }, [workPackages, focus]);

  // Apply actions transforms (sort, breaks, highlights, groupBy, status filter)
  const {
    data: transformedWps,
    registrations,
    highlightMap,
    groups,
    shiftHighlights,
  } = useTransformedData(scopedWps);

  // Remember the view for the session so the browser Back arrow returns to the
  // board as it was left, not to the device default.
  useEffect(() => {
    if (!hydrated) return;
    writeCachedView(viewKey, { viewMode, zoomLevel });
  }, [hydrated, viewKey, viewMode, zoomLevel]);

  // Re-apply a remembered zoom window once the chart and its data exist. The
  // chart is dynamically imported, so poll briefly rather than assume a ref.
  useEffect(() => {
    const pending = pendingZoomRef.current;
    if (!hydrated || !pending || viewMode !== "gantt" || transformedWps.length === 0) return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (chartRef.current) {
        chartRef.current.dispatchZoom(pending.start, pending.end);
        pendingZoomRef.current = null;
      }
      if (pendingZoomRef.current === null || attempts >= 10) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [hydrated, viewMode, transformedWps.length]);

  const handleBarClick = useCallback((wp: SerializedWorkPackage) => {
    setSelectedWp(wp);
    setDrawerOpen(true);
    trackAction("gantt_bar_click", {
      aircraft_reg: wp.aircraftReg,
      customer: wp.customer,
      ground_hours: wp.groundHours,
    });
  }, []);

  // `selectedWp` is the snapshot taken when the bar was clicked. Edits made from
  // inside the drawer (MH override, ground events) refetch the store, so re-read
  // the live row by id — otherwise the drawer keeps showing pre-edit values.
  const drawerWp = useMemo(
    () => (selectedWp ? (workPackages.find((w) => w.id === selectedWp.id) ?? selectedWp) : null),
    [selectedWp, workPackages],
  );

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

  // Fired by the chart after every user zoom/pan, once the header instance's
  // option already reflects the new window — so getZoomRange() is current.
  const handleZoomChange = useCallback(() => {
    setZoomLevel("all");
    const range = chartRef.current?.getZoomRange();
    if (range) {
      writeCachedView(viewKey, { zoomLevel: "all", zoomStart: range.start, zoomEnd: range.end });
    }
  }, [viewKey]);

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

  // A pinned subject with no rows in the current window is reachable by design:
  // the Focus view inherits the window it was opened from rather than widening it.
  const subjectEmpty = focus !== null && !isLoading && !error && scopedWps.length === 0;

  return (
    <div className={cn("flex flex-col gap-3", !isExpanded && "h-full min-h-0")}>
      {backHref && (
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-fit print-hide"
        >
          <i className="fa-solid fa-arrow-left" />
          {backLabel}
        </Link>
      )}

      <TopMenuBar
        title={title}
        icon={icon}
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
                  documentTitle={`${title} — CVG Line Maintenance`}
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
        ) : subjectEmpty ? (
          <EmptyState
            icon="fa-plane-slash"
            title={`No ${focus.subject} activity in this window`}
            message="Widen the start and end dates above to look further back or ahead."
          />
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
      {viewMode === "gantt" && !subjectEmpty && (
        <p className="text-[11px] text-muted-foreground flex-shrink-0 print-hide">
          Ctrl+Scroll to zoom · Shift+Scroll to pan · Click bar for details · Hand tool to drag-pan
        </p>
      )}

      {/* Detail Drawer */}
      <FlightDetailDrawer
        wp={drawerWp}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onWpUpdated={refetchWps}
      />
    </div>
  );
}
