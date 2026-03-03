"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataPreviewTableProps {
  rows: Record<string, unknown>[];
  maxRows?: number;
  className?: string;
}

function formatCell(value: unknown): { text: string; isMuted: boolean } {
  if (value === null || value === undefined) {
    return { text: "\u2014", isMuted: true };
  }

  const str = String(value);

  if (str.length === 0) {
    return { text: "\u2014", isMuted: true };
  }

  if (str.length > 50) {
    return { text: `${str.slice(0, 50)}\u2026`, isMuted: false };
  }

  return { text: str, isMuted: false };
}

export function DataPreviewTable({ rows, maxRows = 5, className }: DataPreviewTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-border p-8 text-sm text-muted-foreground",
          className,
        )}
      >
        No preview data
      </div>
    );
  }

  const columns = Object.keys(rows[0]);
  const displayRows = rows.slice(0, maxRows);

  return (
    <div
      className={cn(
        "max-h-[300px] overflow-y-auto overflow-x-auto rounded-lg border border-border",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="whitespace-nowrap text-sm">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col) => {
                const { text, isMuted } = formatCell(row[col]);
                return (
                  <TableCell
                    key={col}
                    className={cn("whitespace-nowrap text-sm", isMuted && "text-muted-foreground")}
                  >
                    {text}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
