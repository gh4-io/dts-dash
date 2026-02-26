"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/lib/hooks/use-customers";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { EmptyState } from "@/components/shared/empty-state";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface FlightBoardListTableProps {
  workPackages: SerializedWorkPackage[];
  onRowClick: (wp: SerializedWorkPackage) => void;
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

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) +
    " " +
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })
  );
}

function fmtGroundTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export function FlightBoardListTable({ workPackages, onRowClick }: FlightBoardListTableProps) {
  const { getColor } = useCustomers();
  const { tablePageSize } = usePreferences();
  const [sorting, setSorting] = useState<SortingState>([{ id: "arrival", desc: false }]);
  const [pageIndex, setPageIndex] = useState(0);

  const columns = useMemo(
    (): ColumnDef<SerializedWorkPackage>[] => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={STATUS_VARIANT[row.original.status] ?? "secondary"}
            className="text-[10px]"
          >
            {row.original.status}
          </Badge>
        ),
        size: 90,
      },
      {
        accessorKey: "aircraftReg",
        header: "Reg",
        cell: ({ row }) => <span className="font-semibold">{row.original.aircraftReg}</span>,
        size: 90,
      },
      {
        accessorKey: "customer",
        header: "Customer",
        cell: ({ row }) => {
          const color = getColor(row.original.customer);
          return (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{row.original.customer}</span>
            </span>
          );
        },
        size: 160,
      },
      {
        accessorKey: "arrival",
        header: "Arrival",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">{fmtDateTime(row.original.arrival)}</span>
        ),
        size: 130,
      },
      {
        accessorKey: "departure",
        header: "Departure",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">{fmtDateTime(row.original.departure)}</span>
        ),
        size: 130,
      },
      {
        accessorKey: "groundHours",
        header: "Ground Time",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">{fmtGroundTime(row.original.groundHours)}</span>
        ),
        size: 100,
      },
      {
        accessorKey: "effectiveMH",
        header: "MH",
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.effectiveMH}{" "}
            <span className="text-muted-foreground">
              ({getMhSourceLabel(row.original.mhSource)})
            </span>
          </span>
        ),
        size: 130,
      },
      {
        accessorKey: "inferredType",
        header: "Type",
        size: 80,
      },
    ],
    [getColor],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is safe here
  const table = useReactTable({
    data: workPackages,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize: tablePageSize } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater({ pageIndex, pageSize: tablePageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

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
    <div className="rounded-lg border border-border overflow-hidden">
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-2 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} (
            {workPackages.length} total)
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
