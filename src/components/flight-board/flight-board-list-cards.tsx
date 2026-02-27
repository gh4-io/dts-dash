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

function formatTimeRange(arrival: string, departure: string): string {
  const a = new Date(arrival);
  const d = new Date(departure);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) +
    " " +
    dt.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
  const diffMs = d.getTime() - a.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.round((diffMs % 3600000) / 60000);
  return `${fmt(a)} → ${fmt(d)} UTC (${hours}h ${mins}m)`;
}

export function FlightBoardListCards({
  workPackages,
  onCardClick,
  isExpanded,
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
      <div className={cn("space-y-2 p-1", !isExpanded && "flex-1 min-h-0 overflow-y-auto")}>
        {visibleWps.map((wp) => {
          const color = getColor(wp.customer);
          return (
            <button
              key={wp.id}
              onClick={() => onCardClick(wp)}
              className="w-full text-left rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
            >
              {/* Row 1: Customer + Status */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-1.5 text-sm font-medium truncate">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {wp.customer}
                </span>
                <Badge
                  variant={STATUS_VARIANT[wp.status] ?? "secondary"}
                  className="text-[10px] shrink-0"
                >
                  {wp.status}
                </Badge>
              </div>

              {/* Row 2: WP title + Registration */}
              <div className="flex items-baseline gap-2 mb-0.5">
                {wp.title && <span className="text-xs text-muted-foreground">{wp.title}</span>}
                <span className="text-base font-semibold">{wp.aircraftReg}</span>
              </div>

              {/* Row 3: Time range */}
              <div className="text-xs text-muted-foreground mb-0.5">
                {formatTimeRange(wp.arrival, wp.departure)}
              </div>

              {/* Row 4: Type, flight, MH */}
              <div className="text-xs text-muted-foreground">
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
      <div className="flex-shrink-0 px-3 py-1.5 text-xs text-muted-foreground">
        {Math.min(visibleCount, workPackages.length)} of {workPackages.length} work packages
      </div>
    </div>
  );
}
