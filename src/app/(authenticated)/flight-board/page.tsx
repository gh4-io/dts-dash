"use client";

import { Suspense, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { FilterBar } from "@/components/shared/filter-bar";
import { GanttToolbar } from "@/components/flight-board/gantt-toolbar";
import { FlightDetailDrawer } from "@/components/flight-board/flight-detail-drawer";
import { useWorkPackages, type SerializedWorkPackage } from "@/lib/hooks/use-work-packages";
import { useCustomers } from "@/lib/hooks/use-customers";
import { CustomerBadge } from "@/components/shared/customer-badge";

// Dynamic import — ECharts requires window
const FlightBoardChart = dynamic(
  () =>
    import("@/components/flight-board/flight-board-chart").then(
      (mod) => mod.FlightBoardChart
    ),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[400px] rounded-lg border border-border bg-card">
      <div className="text-center text-muted-foreground">
        <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 block" />
        <p className="text-sm">Loading chart...</p>
      </div>
    </div>
  );
}

export default function FlightBoardPage() {
  const [zoomLevel, setZoomLevel] = useState("3d");
  const [selectedWp, setSelectedWp] = useState<SerializedWorkPackage | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { workPackages, isLoading, error } = useWorkPackages();
  const { customers } = useCustomers();

  const handleBarClick = useCallback((wp: SerializedWorkPackage) => {
    setSelectedWp(wp);
    setDrawerOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    // Re-fetch by triggering the hook (store refetch)
    window.location.reload();
  }, []);

  return (
    <div className="space-y-3">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <i className="fa-solid fa-plane-departure mr-2" />
          Flight Board
        </h1>
      </div>

      {/* Filter Bar */}
      <Suspense fallback={null}>
        <FilterBar />
      </Suspense>

      {/* Toolbar */}
      <GanttToolbar
        activeZoom={zoomLevel}
        onZoomChange={setZoomLevel}
        onRefresh={handleRefresh}
      />

      {/* Gantt Chart */}
      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : isLoading ? (
        <ChartSkeleton />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <FlightBoardChart
            workPackages={workPackages}
            zoomLevel={zoomLevel}
            onBarClick={handleBarClick}
          />
        </div>
      )}

      {/* Legend */}
      {customers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          {customers
            .filter((c) => c.isActive)
            .map((c) => (
              <CustomerBadge key={c.id} name={c.displayName} color={c.color} />
            ))}
        </div>
      )}

      {/* Detail Drawer */}
      <FlightDetailDrawer
        wp={selectedWp}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
