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
import type { DailyDemand, DailyCapacity, DailyUtilization } from "@/types";

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
}

interface CapacityTableProps {
  demand: DailyDemand[];
  capacity: DailyCapacity[];
  utilization: DailyUtilization[];
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

export function CapacityTable({ demand, capacity, utilization }: CapacityTableProps) {
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

      // Shift breakdown
      if (cap) {
        for (const shift of cap.byShift) {
          subRows.push({
            date: d.date,
            label: `${shift.shift} Shift`,
            type: "shift",
            demandMH: 0,
            capacityMH: shift.realMH,
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
        capacityMH: cap?.realCapacityMH ?? 0,
        utilizationPercent: util?.utilizationPercent ?? 0,
        surplusDeficit: util?.surplusDeficitMH ?? 0,
        overtimeFlag: util?.overtimeFlag ?? false,
        criticalFlag: util?.criticalFlag ?? false,
        aircraftCount: d.aircraftCount,
        byCustomer: d.byCustomer,
        byShift: cap?.byShift ?? [],
        subRows,
      };
    });
  }, [demand, capacity, utilization]);

  const columns = useMemo(
    (): ColumnDef<CapacityRow>[] => [
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
    ],
    [],
  );

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
    exportToCsv("capacity-report.csv", rows, [
      { header: "Date", accessor: (r) => r.date },
      { header: "Aircraft Count", accessor: (r) => r.aircraftCount },
      { header: "Demand MH", accessor: (r) => r.demandMH.toFixed(1) },
      { header: "Capacity MH", accessor: (r) => r.capacityMH.toFixed(1) },
      {
        header: "Utilization %",
        accessor: (r) => r.utilizationPercent.toFixed(1),
      },
      {
        header: "Surplus/Deficit MH",
        accessor: (r) => r.surplusDeficit.toFixed(1),
      },
      { header: "Overtime Flag", accessor: (r) => (r.overtimeFlag ? "Yes" : "No") },
      { header: "Critical Flag", accessor: (r) => (r.criticalFlag ? "Yes" : "No") },
    ]);
  }, [rows]);

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
