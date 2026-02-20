"use client";

import { useMemo, useState } from "react";
import { useCustomers } from "@/lib/hooks/use-customers";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface OperatorPerformanceProps {
  workPackages: SerializedWorkPackage[];
  focusedOperator: string | null;
  onOperatorClick: (operator: string | null) => void;
  className?: string;
}

interface OperatorRow {
  name: string;
  visits: number;
  aircraftCount: number;
  totalMH: number;
  avgMHPerVisit: number;
  avgGroundHours: number;
  sharePct: number;
}

type SortKey = keyof Omit<OperatorRow, "name">;

function formatHM(hours: number): string {
  if (!isFinite(hours) || hours === 0) return "0:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function SortHeader({
  label,
  field,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase cursor-pointer hover:text-foreground select-none"
      onClick={() => onSort(field)}
    >
      {label}
      {sortKey === field && (
        <i className={`fa-solid fa-caret-${sortAsc ? "up" : "down"} ml-1 text-[10px]`} />
      )}
    </th>
  );
}

export function OperatorPerformance({
  workPackages,
  focusedOperator,
  onOperatorClick,
  className,
}: OperatorPerformanceProps) {
  const { getColor } = useCustomers();
  const [sortKey, setSortKey] = useState<SortKey>("totalMH");
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    const grouped = new Map<string, SerializedWorkPackage[]>();
    workPackages.forEach((wp) => {
      if (!grouped.has(wp.customer)) grouped.set(wp.customer, []);
      grouped.get(wp.customer)!.push(wp);
    });

    const totalVisits = workPackages.length;

    return Array.from(grouped.entries()).map(([name, wps]): OperatorRow => {
      const uniqueRegs = new Set(wps.map((wp) => wp.aircraftReg));
      const totalMH = wps.reduce((sum, wp) => sum + wp.effectiveMH, 0);
      const avgGround = wps.reduce((sum, wp) => sum + wp.groundHours, 0) / wps.length;

      return {
        name,
        visits: wps.length,
        aircraftCount: uniqueRegs.size,
        totalMH,
        avgMHPerVisit: wps.length > 0 ? totalMH / wps.length : 0,
        avgGroundHours: avgGround,
        sharePct: totalVisits > 0 ? (wps.length / totalVisits) * 100 : 0,
      };
    });
  }, [workPackages]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [rows, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        <i className="fa-solid fa-table text-2xl mb-2 block" />
        <p className="text-sm">No operator data</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border bg-card overflow-hidden flex flex-col ${className ?? ""}`}
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
          <i className="fa-solid fa-users" />
          Operator Performance
        </h3>
        {focusedOperator && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => onOperatorClick(null)}
          >
            Clear focus
          </button>
        )}
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                Operator
              </th>
              <SortHeader
                label="Turns"
                field="visits"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
              <SortHeader
                label="Aircraft"
                field="aircraftCount"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
              <SortHeader
                label="Total MH"
                field="totalMH"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
              <SortHeader
                label="Avg MH"
                field="avgMHPerVisit"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
              <SortHeader
                label="Avg Ground"
                field="avgGroundHours"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
              <SortHeader
                label="Share"
                field="sharePct"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const isFocused = focusedOperator === row.name;
              const isDimmed = focusedOperator && !isFocused;

              return (
                <tr
                  key={row.name}
                  className={`border-b border-border last:border-0 transition-opacity cursor-pointer ${
                    isDimmed ? "opacity-30" : ""
                  } ${isFocused ? "bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => onOperatorClick(isFocused ? null : row.name)}
                >
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: getColor(row.name) }}
                      />
                      <span className="font-medium truncate max-w-[160px]">{row.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.visits}</td>
                  <td className="px-3 py-2 tabular-nums">{row.aircraftCount}</td>
                  <td className="px-3 py-2 tabular-nums">{row.totalMH.toFixed(1)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.avgMHPerVisit.toFixed(1)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatHM(row.avgGroundHours)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.sharePct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
