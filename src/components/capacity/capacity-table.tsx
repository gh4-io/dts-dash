"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
  type Row,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/utils/csv-export";
import { usePreferences } from "@/lib/hooks/use-preferences";
import type { DailyDemandV2, DailyCapacityV2, DailyUtilizationV2, CapacityLensId } from "@/types";

interface CapacityRow {
  date: string;
  demandMH: number;
  capacityMH: number;
  utilizationPercent: number;
  surplusDeficit: number;
  overtimeFlag: boolean;
  criticalFlag: boolean;
  aircraftCount: number;
  byCustomer: Record<string, number>;
  byShift: { shift: string; headcount: number; realMH: number }[];
  // Lens overlay fields
  allocatedMH?: number;
  forecastMH?: number;
  workedMH?: number;
  billedMH?: number;
  peakConcurrency?: number;
  eventCount?: number;
  subRows?: CapacitySubRow[];
}

interface CapacitySubRow {
  date: string;
  label: string;
  type: "customer" | "shift";
  demandMH: number;
  capacityMH: number;
  utilizationPercent: number;
  surplusDeficit: number;
  overtimeFlag: boolean;
  criticalFlag: boolean;
  aircraftCount: number;
  byCustomer: Record<string, number>;
  byShift: { shift: string; headcount: number; realMH: number }[];
  allocatedMH?: number;
  forecastMH?: number;
  workedMH?: number;
  billedMH?: number;
  peakConcurrency?: number;
  eventCount?: number;
}

interface CapacityTableProps {
  demand: DailyDemandV2[];
  capacity: DailyCapacityV2[];
  utilization: DailyUtilizationV2[];
  activeLens: CapacityLensId;
  eventCountByDate?: Map<string, number>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getUtilizationBadge(percent: number, critical: boolean, overtime: boolean) {
  if (critical) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-500">
        <i className="fa-solid fa-triangle-exclamation text-[9px]" />
        {percent.toFixed(1)}%
      </span>
    );
  }
  if (overtime) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <i className="fa-solid fa-clock text-[9px]" />
        {percent.toFixed(1)}%
      </span>
    );
  }
  if (percent > 80) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
        {percent.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
      {percent.toFixed(1)}%
    </span>
  );
}

export function CapacityTable({
  demand,
  capacity,
  utilization,
  activeLens,
  eventCountByDate,
}: CapacityTableProps) {
  const { tablePageSize } = usePreferences();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pageIndex, setPageIndex] = useState(0);

  const rows = useMemo((): CapacityRow[] => {
    const capMap = new Map(capacity.map((c) => [c.date, c]));
    const utilMap = new Map(utilization.map((u) => [u.date, u]));

    return demand.map((d) => {
      const cap = capMap.get(d.date);
      const util = utilMap.get(d.date);

      // Build sub-rows: customers + shifts
      const subRows: CapacitySubRow[] = [];

      // Customer breakdown
      for (const [customer, mh] of Object.entries(d.byCustomer)) {
        subRows.push({
          date: d.date,
          label: customer,
          type: "customer",
          demandMH: mh,
          capacityMH: 0,
          utilizationPercent: 0,
          surplusDeficit: 0,
          overtimeFlag: false,
          criticalFlag: false,
          aircraftCount: 0,
          byCustomer: {},
          byShift: [],
        });
      }

      // Shift breakdown (V2 → legacy sub-row format)
      if (cap) {
        for (const shift of cap.byShift) {
          subRows.push({
            date: d.date,
            label: `${shift.shiftName} Shift`,
            type: "shift",
            demandMH: 0,
            capacityMH: shift.productiveMH,
            utilizationPercent: 0,
            surplusDeficit: 0,
            overtimeFlag: false,
            criticalFlag: false,
            aircraftCount: 0,
            byCustomer: {},
            byShift: [],
          });
        }
      }

      return {
        date: d.date,
        demandMH: d.totalDemandMH,
        capacityMH: cap?.totalProductiveMH ?? 0,
        utilizationPercent: util?.utilizationPercent ?? 0,
        surplusDeficit: util?.gapMH ?? 0,
        overtimeFlag: util?.overtimeFlag ?? false,
        criticalFlag: util?.criticalFlag ?? false,
        aircraftCount: d.aircraftCount,
        byCustomer: d.byCustomer,
        byShift:
          cap?.byShift.map((s) => ({
            shift: s.shiftName,
            headcount: s.effectiveHeadcount,
            realMH: s.productiveMH,
          })) ?? [],
        // Lens overlay fields
        allocatedMH: d.totalAllocatedDemandMH,
        forecastMH: d.totalForecastedDemandMH,
        workedMH: d.totalWorkedMH,
        billedMH: d.totalBilledMH,
        peakConcurrency: d.peakConcurrency,
        eventCount: eventCountByDate?.get(d.date),
        subRows,
      };
    });
  }, [demand, capacity, utilization, eventCountByDate]);

  const columns = useMemo((): ColumnDef<CapacityRow>[] => {
    const base: ColumnDef<CapacityRow>[] = [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }: { row: Row<CapacityRow> }) => {
          if (!row.getCanExpand()) return null;
          return (
            <button
              onClick={row.getToggleExpandedHandler()}
              className="text-muted-foreground hover:text-foreground"
            >
              <i
                className={`fa-solid fa-chevron-${row.getIsExpanded() ? "down" : "right"} text-[10px]`}
              />
            </button>
          );
        },
        size: 32,
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }: { row: Row<CapacityRow> }) => {
          if (row.depth > 0) {
            const sub = row.original as unknown as CapacitySubRow;
            return (
              <span className="pl-4 text-muted-foreground flex items-center gap-1.5">
                <i
                  className={`fa-solid ${sub.type === "customer" ? "fa-building" : "fa-clock"} text-[9px]`}
                />
                {sub.label}
              </span>
            );
          }
          return <span className="font-medium">{formatDate(row.original.date)}</span>;
        },
      },
      {
        accessorKey: "aircraftCount",
        header: "Aircraft",
        cell: ({ row }: { row: Row<CapacityRow> }) => {
          if (row.depth > 0) return null;
          return <span className="tabular-nums">{row.original.aircraftCount}</span>;
        },
        size: 80,
      },
      {
        accessorKey: "demandMH",
        header: "Demand MH",
        cell: ({ row }: { row: Row<CapacityRow> }) => {
          const val =
            row.depth > 0
              ? (row.original as unknown as CapacitySubRow).demandMH
              : row.original.demandMH;
          if (val === 0 && row.depth > 0) return <span className="text-muted-foreground">—</span>;
          return <span className="tabular-nums">{val.toFixed(1)}</span>;
        },
        size: 100,
      },
      {
        accessorKey: "capacityMH",
        header: "Capacity MH",
        cell: ({ row }: { row: Row<CapacityRow> }) => {
          const val =
            row.depth > 0
              ? (row.original as unknown as CapacitySubRow).capacityMH
              : row.original.capacityMH;
          if (val === 0 && row.depth > 0) return <span className="text-muted-foreground">—</span>;
          return <span className="tabular-nums">{val.toFixed(1)}</span>;
        },
        size: 110,
      },
      {
        accessorKey: "utilizationPercent",
        header: "Utilization",
        cell: ({ row }: { row: Row<CapacityRow> }) => {
          if (row.depth > 0) return null;
          return getUtilizationBadge(
            row.original.utilizationPercent,
            row.original.criticalFlag,
            row.original.overtimeFlag,
          );
        },
        size: 110,
      },
      {
        accessorKey: "surplusDeficit",
        header: "Surplus / Deficit",
        cell: ({ row }: { row: Row<CapacityRow> }) => {
          if (row.depth > 0) return null;
          const val = row.original.surplusDeficit;
          const isDeficit = val < 0;
          return (
            <span
              className={`tabular-nums ${isDeficit ? "text-red-500" : "text-green-600 dark:text-green-400"}`}
            >
              {isDeficit ? "" : "+"}
              {val.toFixed(1)} MH
            </span>
          );
        },
        size: 130,
      },
    ];

    // Dynamic lens columns
    switch (activeLens) {
      case "allocated":
        base.push({
          accessorKey: "allocatedMH",
          header: () => <span className="text-amber-400">Allocated MH</span>,
          cell: ({ row }: { row: Row<CapacityRow> }) => {
            if (row.depth > 0) return null;
            const val = row.original.allocatedMH;
            return val != null ? (
              <span className="tabular-nums text-amber-400">{val.toFixed(1)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
          size: 110,
        });
        break;
      case "forecast":
        base.push({
          accessorKey: "forecastMH",
          header: () => <span className="text-teal-400">Forecast MH</span>,
          cell: ({ row }: { row: Row<CapacityRow> }) => {
            if (row.depth > 0) return null;
            const val = row.original.forecastMH;
            return val != null ? (
              <span className="tabular-nums text-teal-400">{val.toFixed(1)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
          size: 110,
        });
        break;
      case "worked":
        base.push({
          accessorKey: "workedMH",
          header: () => <span className="text-green-400">Worked MH</span>,
          cell: ({ row }: { row: Row<CapacityRow> }) => {
            if (row.depth > 0) return null;
            const val = row.original.workedMH;
            return val != null ? (
              <span className="tabular-nums text-green-400">{val.toFixed(1)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
          size: 100,
        });
        base.push({
          id: "workedVariance",
          header: () => <span className="text-green-400">Variance</span>,
          cell: ({ row }: { row: Row<CapacityRow> }) => {
            if (row.depth > 0) return null;
            const worked = row.original.workedMH;
            const demand = row.original.demandMH;
            if (worked == null || demand === 0)
              return <span className="text-muted-foreground">—</span>;
            const variance = ((demand - worked) / demand) * 100;
            return (
              <span
                className={`tabular-nums ${Math.abs(variance) > 20 ? "text-amber-400" : "text-green-400"}`}
              >
                {variance >= 0 ? "+" : ""}
                {variance.toFixed(1)}%
              </span>
            );
          },
          size: 90,
        });
        break;
      case "billed":
        base.push({
          accessorKey: "billedMH",
          header: () => <span className="text-indigo-400">Billed MH</span>,
          cell: ({ row }: { row: Row<CapacityRow> }) => {
            if (row.depth > 0) return null;
            const val = row.original.billedMH;
            return val != null ? (
              <span className="tabular-nums text-indigo-400">{val.toFixed(1)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
          size: 100,
        });
        break;
      case "concurrent":
        base.push({
          accessorKey: "peakConcurrency",
          header: () => <span className="text-purple-400">Peak Concurrent</span>,
          cell: ({ row }: { row: Row<CapacityRow> }) => {
            if (row.depth > 0) return null;
            const val = row.original.peakConcurrency;
            return val != null ? (
              <span className="tabular-nums text-purple-400">{val}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
          size: 130,
        });
        break;
      case "events":
        base.push({
          accessorKey: "eventCount",
          header: () => <span className="text-sky-400">Events</span>,
          cell: ({ row }: { row: Row<CapacityRow> }) => {
            if (row.depth > 0) return null;
            const val = row.original.eventCount;
            return val != null && val > 0 ? (
              <span className="tabular-nums text-sky-400">{val}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
          size: 80,
        });
        break;
    }

    return base;
  }, [activeLens]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is safe here
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, expanded, pagination: { pageIndex, pageSize: tablePageSize } },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater({ pageIndex, pageSize: tablePageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
    getSubRows: (row) => row.subRows as CapacityRow[] | undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const handleExportCsv = useCallback(() => {
    const csvColumns: { header: string; accessor: (r: CapacityRow) => string }[] = [
      { header: "Date", accessor: (r) => r.date },
      { header: "Aircraft Count", accessor: (r) => String(r.aircraftCount) },
      { header: "Demand MH", accessor: (r) => r.demandMH.toFixed(1) },
      { header: "Capacity MH", accessor: (r) => r.capacityMH.toFixed(1) },
      { header: "Utilization %", accessor: (r) => r.utilizationPercent.toFixed(1) },
      { header: "Surplus/Deficit MH", accessor: (r) => r.surplusDeficit.toFixed(1) },
      { header: "Overtime Flag", accessor: (r) => (r.overtimeFlag ? "Yes" : "No") },
      { header: "Critical Flag", accessor: (r) => (r.criticalFlag ? "Yes" : "No") },
    ];

    // Add lens-specific columns to CSV
    switch (activeLens) {
      case "allocated":
        csvColumns.push({
          header: "Allocated MH",
          accessor: (r) => (r.allocatedMH ?? 0).toFixed(1),
        });
        break;
      case "forecast":
        csvColumns.push({ header: "Forecast MH", accessor: (r) => (r.forecastMH ?? 0).toFixed(1) });
        break;
      case "worked":
        csvColumns.push({ header: "Worked MH", accessor: (r) => (r.workedMH ?? 0).toFixed(1) });
        break;
      case "billed":
        csvColumns.push({ header: "Billed MH", accessor: (r) => (r.billedMH ?? 0).toFixed(1) });
        break;
      case "concurrent":
        csvColumns.push({
          header: "Peak Concurrency",
          accessor: (r) => String(r.peakConcurrency ?? 0),
        });
        break;
      case "events":
        csvColumns.push({ header: "Events", accessor: (r) => String(r.eventCount ?? 0) });
        break;
    }

    exportToCsv("capacity-report.csv", rows, csvColumns);
  }, [rows, activeLens]);

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Table Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-table-list" />
          Daily Detail
        </h3>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <i className="fa-solid fa-file-csv mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs cursor-pointer select-none"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && (
                        <i className="fa-solid fa-sort-up text-[9px]" />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <i className="fa-solid fa-sort-down text-[9px]" />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  <i className="fa-solid fa-inbox text-2xl mb-2 block" />
                  No capacity data for selected filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.depth > 0 ? "bg-muted/30" : row.original.criticalFlag ? "bg-red-500/5" : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} (
            {rows.length} days)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <i className="fa-solid fa-chevron-left text-xs" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
