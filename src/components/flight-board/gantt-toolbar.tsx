"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GanttToolbarProps {
  activeZoom: string;
  onZoomChange: (level: string) => void;
  onRefresh: () => void;
}

const ZOOM_LEVELS = [
  { id: "6h", label: "6h" },
  { id: "12h", label: "12h" },
  { id: "1d", label: "1d" },
  { id: "3d", label: "3d" },
  { id: "1w", label: "1w" },
];

export function GanttToolbar({ activeZoom, onZoomChange, onRefresh }: GanttToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
        {ZOOM_LEVELS.map((level) => (
          <Button
            key={level.id}
            variant={activeZoom === level.id ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 px-2.5 text-xs", activeZoom !== level.id && "text-muted-foreground")}
            onClick={() => onZoomChange(level.id)}
          >
            {level.label}
          </Button>
        ))}
      </div>
      <div className="ml-auto">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onRefresh}>
          <i className="fa-solid fa-arrows-rotate" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
