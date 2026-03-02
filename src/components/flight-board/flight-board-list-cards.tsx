"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { useCustomers } from "@/lib/hooks/use-customers";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface FlightBoardListCardsProps {
  workPackages: SerializedWorkPackage[];
  onCardClick: (wp: SerializedWorkPackage) => void;
  isExpanded: boolean;
  timezone: string;
}

const INITIAL_BATCH = 30;
const BATCH_SIZE = 30;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  New: "outline",
  Approved: "default",
  Closed: "secondary",
  Printed: "default",
  Canceled: "destructive",
};

function formatCardDateTime(
  arrivalIso: string,
  departureIso: string,
  timezone: string,
): { text: string; tzAbbr: string } {
  const arr = new Date(arrivalIso);
  const dep = new Date(departureIso);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // Extract short tz abbreviation (e.g. "UTC", "EST")
  const tzFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  });
  const tzParts = tzFmt.formatToParts(arr);
  const tzAbbr = tzParts.find((p) => p.type === "timeZoneName")?.value ?? timezone;

  const arrDate = dateFmt.format(arr);
  const depDate = dateFmt.format(dep);
  const arrTime = timeFmt.format(arr);
  const depTime = timeFmt.format(dep);

  const text =
    arrDate === depDate
      ? `${arrDate} ${arrTime} → ${depTime}`
      : `${arrDate} ${arrTime} → ${depDate} ${depTime}`;

  return { text, tzAbbr };
}

function formatGroundTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function getMhSourceLabel(source: string): string {
  switch (source) {
    case "manual":
      return "Override";
    case "workpackage":
      return "WP MH";
    case "contract":
      return "Contract";
    default:
      return "Default";
  }
}

export function FlightBoardListCards({
  workPackages,
  onCardClick,
  isExpanded,
  timezone,
}: FlightBoardListCardsProps) {
  const { getColor } = useCustomers();
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when data changes (e.g. new filters applied)
  const wpRef = useRef(workPackages);
  useEffect(() => {
    if (wpRef.current !== workPackages) {
      wpRef.current = workPackages;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset on data change
      setVisibleCount(INITIAL_BATCH);
    }
  }, [workPackages]);

  const visibleWps = workPackages.slice(0, visibleCount);
  const hasMore = visibleCount < workPackages.length;

  // Lazy loading via IntersectionObserver
  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + BATCH_SIZE, workPackages.length));
  }, [workPackages.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (workPackages.length === 0) {
    return (
      <EmptyState
        icon="fa-solid fa-plane"
        title="No work packages"
        message="No work packages match the current filters."
      />
    );
  }

  return (
    <div className={cn("flex flex-col", !isExpanded && "h-full")}>
      {/* Scrollable card area */}
      <div className={cn(!isExpanded && "flex-1 min-h-0 overflow-y-auto")}>
        {visibleWps.map((wp) => {
          const color = getColor(wp.customer);
          return (
            <button
              key={wp.id}
              onClick={() => onCardClick(wp)}
              className="w-full text-left border-b border-border px-4 py-3 cursor-pointer hover:bg-accent/10 active:bg-accent/20 transition-colors"
            >
              {/* Line 1: Registration + date/time + tz + ground time + Status badge */}
              {(() => {
                const { text: dtText, tzAbbr } = formatCardDateTime(
                  wp.arrival,
                  wp.departure,
                  timezone,
                );
                return (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                      <span className="font-bold text-base whitespace-nowrap">
                        {wp.aircraftReg}
                      </span>
                      <span className="text-sm whitespace-nowrap">{dtText}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {tzAbbr} ({formatGroundTime(wp.groundHours)})
                      </span>
                    </div>
                    <Badge
                      variant={STATUS_VARIANT[wp.status] ?? "secondary"}
                      className="text-[10px] shrink-0 ml-2"
                    >
                      {wp.status}
                    </Badge>
                  </div>
                );
              })()}

              {/* Line 2: Customer + WP indicator */}
              <div className="flex items-center justify-between mb-1 text-sm">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-muted-foreground truncate">{wp.customer}</span>
                </div>
                <span
                  className={cn(
                    "shrink-0 ml-2 text-[12px] truncate",
                    wp.hasWorkpackage ? "text-emerald-500" : "text-muted-foreground",
                  )}
                >
                  WP: {wp.workpackageNo ?? wp.title ?? (wp.hasWorkpackage ? "✓" : "—")}
                </span>
              </div>

              {/* Line 3: Secondary info hint */}
              <div className="text-xs italic text-muted-foreground">
                {wp.inferredType}
                {wp.flightId && <> · {wp.flightId}</>}
                {" · "}
                {wp.effectiveMH} MH ({getMhSourceLabel(wp.mhSource)})
              </div>
            </button>
          );
        })}
        {/* Sentinel for lazy loading */}
        {hasMore && <div ref={sentinelRef} className="h-1" />}
      </div>
      {/* Status bar */}
      <div className="flex-shrink-0 px-4 py-1.5 text-xs text-muted-foreground">
        {Math.min(visibleCount, workPackages.length)} of {workPackages.length} work packages
      </div>
    </div>
  );
}
