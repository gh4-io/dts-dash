"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
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
import { useCustomers } from "@/lib/hooks/use-customers";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface FlightBoardListTableProps {
  workPackages: SerializedWorkPackage[];
  onRowClick: (wp: SerializedWorkPackage) => void;
  isExpanded: boolean;
}

const INITIAL_BATCH = 50;
const BATCH_SIZE = 50;

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

export function FlightBoardListTable({
  workPackages,
  onRowClick,
  isExpanded,
}: FlightBoardListTableProps) {
  const { getColor } = useCustomers();
  const [sorting, setSorting] = useState<SortingState>([{ id: "arrival", desc: false }]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const sentinelRef = useRef<HTMLTableRowElement>(null);

  // Reset visible count when data changes (e.g. new filters applied)
  const wpRef = useRef(workPackages);
  useEffect(() => {
    if (wpRef.current !== workPackages) {
      wpRef.current = workPackages;
      setVisibleCount(INITIAL_BATCH);
    }
  }, [workPackages]);

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
        accessorKey: "title",
        header: "WP",
        cell: ({ row }) => (
          <span className="text-xs truncate max-w-[120px] block">{row.original.title ?? "—"}</span>
        ),
        size: 120,
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();
  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const hasMore = visibleCount < rows.length;

  // Lazy loading via IntersectionObserver
  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + BATCH_SIZE, rows.length));
  }, [rows.length]);

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
      {/* Scrollable area with sticky header */}
      <div className={cn("overflow-x-auto", !isExpanded && "flex-1 min-h-0 overflow-y-auto")}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
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
            {visibleRows.map((row) => (
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
            {/* Sentinel row for lazy loading */}
            {hasMore && (
              <tr ref={sentinelRef}>
                <td colSpan={columns.length} className="h-1" />
              </tr>
            )}
          </TableBody>
        </Table>
      </div>
      {/* Status bar */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
        {Math.min(visibleCount, rows.length)} of {rows.length} work packages
      </div>
    </div>
  );
}
