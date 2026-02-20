"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FlightBoardFormatPanelProps {
  activeZoom: string;
  onZoomChange: (level: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onNow: () => void;
  onFit: () => void;
  showNow: boolean;
  filterSpanHours: number; // ✅ PATCH #1: For disabling presets
}

const ZOOM_LEVELS = [
  { id: "6h", label: "6h" },
  { id: "12h", label: "12h" },
  { id: "1d", label: "1d" },
  { id: "3d", label: "3d" },
  { id: "1w", label: "1w" },
];

export function FlightBoardFormatPanel({
  activeZoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  isExpanded,
  onToggleExpanded,
  onNow,
  onFit,
  showNow,
  filterSpanHours,
}: FlightBoardFormatPanelProps) {
  return (
    <div className="space-y-3">
      {/* Zoom presets */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Zoom
        </label>
        <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
          {ZOOM_LEVELS.map((level) => {
            const levelHours = parseInt(level.id); // "6h" → 6, "12h" → 12, etc.
            const disabled = filterSpanHours < levelHours;

            return (
              <Button
                key={level.id}
                variant={activeZoom === level.id ? "default" : "ghost"}
                size="sm"
                disabled={disabled} // ✅ PATCH #1: Disable when filter span < preset hours
                title={disabled ? `Disabled: filter range is only ${filterSpanHours.toFixed(1)}h` : undefined}
                className={cn(
                  "h-7 px-2.5 text-xs flex-1",
                  activeZoom !== level.id && "text-muted-foreground"
                )}
                onClick={() => onZoomChange(level.id)}
              >
                {level.label}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onZoomIn}
            title="Zoom in"
          >
            <i className="fa-solid fa-magnifying-glass-plus text-xs" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onZoomOut}
            title="Zoom out"
          >
            <i className="fa-solid fa-magnifying-glass-minus text-xs" />
          </Button>
        </div>
      </div>

      {/* View */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          View
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs w-full justify-start"
          onClick={onToggleExpanded}
        >
          <i
            className={cn("fa-solid", isExpanded ? "fa-compress" : "fa-expand")}
          />
          {isExpanded ? "Collapse" : "Expand"}
        </Button>
      </div>

      {/* Navigation */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Navigation
        </label>
        <div className="flex flex-col gap-1">
          {showNow && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs w-full justify-start"
              onClick={onNow}
            >
              <i className="fa-solid fa-clock text-xs" />
              Center on Now
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs w-full justify-start"
            onClick={onFit}
          >
            <i className="fa-solid fa-arrows-left-right-to-line text-xs" />
            Fit All Data
          </Button>
        </div>
      </div>
    </div>
  );
}
