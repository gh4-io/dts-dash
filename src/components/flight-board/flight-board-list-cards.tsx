"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/lib/hooks/use-customers";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { EmptyState } from "@/components/shared/empty-state";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface FlightBoardListCardsProps {
  workPackages: SerializedWorkPackage[];
  onCardClick: (wp: SerializedWorkPackage) => void;
}

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

export function FlightBoardListCards({ workPackages, onCardClick }: FlightBoardListCardsProps) {
  const { getColor } = useCustomers();
  const { tablePageSize } = usePreferences();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(workPackages.length / tablePageSize));
  const pagedWps = useMemo(
    () => workPackages.slice(page * tablePageSize, (page + 1) * tablePageSize),
    [workPackages, page, tablePageSize],
  );

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
    <div className="space-y-2">
      {pagedWps.map((wp) => {
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

            {/* Row 2: Registration */}
            <div className="text-base font-semibold mb-0.5">{wp.aircraftReg}</div>

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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} ({workPackages.length} total)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <i className="fa-solid fa-chevron-left text-xs" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
