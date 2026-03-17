"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ZOOM_LEVELS = [
  { id: "6h", label: "6h" },
  { id: "12h", label: "12h" },
  { id: "1d", label: "1d" },
  { id: "3d", label: "3d" },
  { id: "1w", label: "1w" },
];

export interface FlightBoardViewControlsProps {
  viewMode: "gantt" | "list";
  setViewMode: (mode: "gantt" | "list") => void;
  viewOpen: boolean;
  setViewOpen: (open: boolean) => void;
  zoomLevel: string;
  setZoomLevel: (level: string) => void;
  filterSpanHours: number;
  isExpanded: boolean;
  condensed: boolean;
  hydrated: boolean;
  panMode: boolean;
  useVerticalView: boolean;
  isPhone: boolean;
  isDesktop: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleCondensed: () => void;
  onNow: () => void;
  onFit: () => void;
  onToggleExpanded: () => void;
  onTogglePanMode: () => void;
  printButton?: React.ReactNode;
  refreshButton?: React.ReactNode;
}

export function FlightBoardViewControls({
  viewMode,
  setViewMode,
  viewOpen,
  setViewOpen,
  zoomLevel,
  setZoomLevel,
  filterSpanHours,
  isExpanded,
  condensed,
  hydrated,
  panMode,
  useVerticalView,
  isPhone,
  onZoomIn,
  onZoomOut,
  onToggleCondensed,
  onNow,
  onFit,
  onToggleExpanded,
  onTogglePanMode,
  printButton,
  refreshButton,
}: FlightBoardViewControlsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Horizontal inline expansion — wide screens */}
      {!useVerticalView && (
        <>
          <div
            className={cn(
              "flex items-center gap-1 overflow-hidden transition-all duration-200",
              viewOpen ? "max-w-[700px] opacity-100" : "max-w-0 opacity-0",
            )}
          >
            {/* Gantt / List toggle — hidden on phone */}
            {!isPhone && (
              <div className="flex items-center rounded-md border bg-muted/50 p-0.5 shrink-0">
                <Button
                  variant={viewMode === "gantt" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setViewMode("gantt")}
                  title="Gantt chart"
                >
                  <i className="fa-solid fa-chart-gantt" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <i className="fa-solid fa-list" />
                </Button>
              </div>
            )}

            {/* Gantt-specific controls */}
            {viewMode === "gantt" && (
              <GanttControls
                zoomLevel={zoomLevel}
                setZoomLevel={setZoomLevel}
                filterSpanHours={filterSpanHours}
                condensed={condensed}
                hydrated={hydrated}
                panMode={panMode}
                isExpanded={isExpanded}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onToggleCondensed={onToggleCondensed}
                onNow={onNow}
                onFit={onFit}
                onTogglePanMode={onTogglePanMode}
                layout="inline"
              />
            )}

            {/* Expand/Collapse — always visible */}
            <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              onClick={onToggleExpanded}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <i className={cn("fa-solid", isExpanded ? "fa-compress" : "fa-expand")} />
            </Button>
          </div>
          <Button
            variant={viewOpen ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs gap-1.5 shrink-0"
            onClick={() => setViewOpen(!viewOpen)}
          >
            <i className="fa-solid fa-sliders" />
            View
          </Button>
        </>
      )}

      {/* Popover — narrow screens */}
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
                onClick={() => setViewMode("gantt")}
                title="Gantt chart"
              >
                <i className="fa-solid fa-chart-gantt mr-1.5" />
                Gantt
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs flex-1"
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <i className="fa-solid fa-list mr-1.5" />
                List
              </Button>
            </div>

            {/* Gantt-specific controls */}
            {viewMode === "gantt" && (
              <GanttControls
                zoomLevel={zoomLevel}
                setZoomLevel={(l) => {
                  setZoomLevel(l);
                  setViewOpen(false);
                }}
                filterSpanHours={filterSpanHours}
                condensed={condensed}
                hydrated={hydrated}
                panMode={panMode}
                isExpanded={isExpanded}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onToggleCondensed={() => {
                  onToggleCondensed();
                  setViewOpen(false);
                }}
                onNow={() => {
                  onNow();
                  setViewOpen(false);
                }}
                onFit={() => {
                  onFit();
                  setViewOpen(false);
                }}
                onTogglePanMode={() => {
                  onTogglePanMode();
                  setViewOpen(false);
                }}
                layout="popover"
              />
            )}

            <div className="border-t border-border my-1" />

            {/* Expand/Collapse — always visible */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() => {
                onToggleExpanded();
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

      {/* Print & Refresh slots */}
      {printButton}
      {refreshButton}
    </div>
  );
}

/* ── Gantt-specific controls (shared between inline & popover layouts) ── */

interface GanttControlsProps {
  zoomLevel: string;
  setZoomLevel: (level: string) => void;
  filterSpanHours: number;
  condensed: boolean;
  hydrated: boolean;
  panMode: boolean;
  isExpanded: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleCondensed: () => void;
  onNow: () => void;
  onFit: () => void;
  onTogglePanMode: () => void;
  layout: "inline" | "popover";
}

function GanttControls({
  zoomLevel,
  setZoomLevel,
  filterSpanHours,
  condensed,
  hydrated,
  panMode,
  onZoomIn,
  onZoomOut,
  onToggleCondensed,
  onNow,
  onFit,
  onTogglePanMode,
  layout,
}: GanttControlsProps) {
  if (layout === "inline") {
    return (
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
          onClick={onZoomIn}
          title="Zoom in"
        >
          <i className="fa-solid fa-magnifying-glass-plus text-xs" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={onZoomOut}
          title="Zoom out"
        >
          <i className="fa-solid fa-magnifying-glass-minus text-xs" />
        </Button>
        {hydrated && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={onToggleCondensed}
            title={condensed ? "Normal density" : "Condensed view"}
          >
            <i className={cn("fa-solid", condensed ? "fa-bars" : "fa-bars-staggered")} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={onNow}
          title="Center on Now"
        >
          <i className="fa-solid fa-clock text-xs" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={onFit}
          title="Fit All Data"
        >
          <i className="fa-solid fa-arrows-left-right-to-line text-xs" />
        </Button>
        <Button
          variant={panMode ? "default" : "ghost"}
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={onTogglePanMode}
          title={panMode ? "Switch to pointer" : "Hand tool (drag to pan)"}
        >
          <i className="fa-solid fa-hand text-xs" />
        </Button>
      </>
    );
  }

  // Popover layout
  return (
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
              onClick={() => setZoomLevel(level.id)}
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
        onClick={onZoomIn}
      >
        <i className="fa-solid fa-magnifying-glass-plus w-4 text-center text-muted-foreground" />
        Zoom In
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 text-xs"
        onClick={onZoomOut}
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
          onClick={onToggleCondensed}
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
        onClick={onNow}
      >
        <i className="fa-solid fa-clock w-4 text-center text-muted-foreground" />
        Center on Now
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start gap-2 text-xs"
        onClick={onFit}
      >
        <i className="fa-solid fa-arrows-left-right-to-line w-4 text-center text-muted-foreground" />
        Fit All Data
      </Button>

      <div className="border-t border-border my-1" />

      <Button
        variant={panMode ? "default" : "ghost"}
        size="sm"
        className="h-8 w-full justify-start gap-2 text-xs"
        onClick={onTogglePanMode}
      >
        <i className="fa-solid fa-hand w-4 text-center text-muted-foreground" />
        {panMode ? "Pointer Mode" : "Pan Mode"}
      </Button>
    </>
  );
}
