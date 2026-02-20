"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryRow {
  id: number;
  importedAt: string;
  dataType: string;
  source: string;
  format: string;
  fileName: string | null;
  importedBy: number;
  status: string;
  recordsTotal: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  warnings: string | null;
  errors: string | null;
  userDisplayName: string;
}

interface HistoryResponse {
  data: HistoryRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface ImportHistoryProps {
  refreshTrigger?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

const DATA_TYPES = [
  { value: "all", label: "All Types" },
  { value: "work-packages", label: "Work Packages" },
  { value: "customers", label: "Customers" },
  { value: "aircraft", label: "Aircraft" },
  { value: "aircraft-type-mappings", label: "Aircraft Type Mappings" },
  { value: "aircraft-models", label: "Aircraft Models" },
  { value: "manufacturers", label: "Manufacturers" },
  { value: "engine-types", label: "Engine Types" },
  { value: "users", label: "Users" },
  { value: "app-config", label: "App Config" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Success</Badge>;
    case "partial":
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Partial</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSourceBadge(source: string) {
  switch (source) {
    case "file":
      return <Badge variant="default">File</Badge>;
    case "paste":
      return <Badge variant="secondary">Paste</Badge>;
    case "api":
      return <Badge variant="outline">API</Badge>;
    default:
      return <Badge variant="outline">{source}</Badge>;
  }
}

function getDataTypeLabel(dataType: string): string {
  const found = DATA_TYPES.find((dt) => dt.value === dataType);
  return found ? found.label : dataType;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportHistory({ refreshTrigger }: ImportHistoryProps) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }

      const res = await fetch(`/api/admin/import/history?${params.toString()}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Failed to fetch history (${res.status})`,
        );
      }

      const json = (await res.json()) as HistoryResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  // Re-fetch when page, filter, or refreshTrigger changes
  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / PAGE_SIZE)) : 1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">Import History</h3>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPES.map((dt) => (
              <SelectItem key={dt.value} value={dt.value}>
                {dt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !data && <LoadingSkeleton variant="table" count={5} />}

      {/* Table */}
      {data && (
        <>
          {data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border py-12">
              <p className="text-sm text-muted-foreground">No import history yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm">Timestamp</TableHead>
                    <TableHead className="text-sm">Type</TableHead>
                    <TableHead className="text-sm">Source</TableHead>
                    <TableHead className="text-sm">Format</TableHead>
                    <TableHead className="text-sm">Records</TableHead>
                    <TableHead className="text-sm">Status</TableHead>
                    <TableHead className="text-sm">User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatTimestamp(row.importedAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline">{getDataTypeLabel(row.dataType)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{getSourceBadge(row.source)}</TableCell>
                      <TableCell className="text-sm font-mono">{row.format}</TableCell>
                      <TableCell className="text-sm">
                        <span title="Total / Inserted / Updated / Skipped">
                          <span className="font-medium">{row.recordsTotal}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            ({row.recordsInserted}
                            <span className="text-emerald-500">i</span>
                            {" / "}
                            {row.recordsUpdated}
                            <span className="text-blue-500">u</span>
                            {" / "}
                            {row.recordsSkipped}
                            <span className="text-amber-500">s</span>)
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.userDisplayName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {data.pagination.total > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}
                &ndash;
                {Math.min(page * PAGE_SIZE, data.pagination.total)} of {data.pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <i className="fa-solid fa-chevron-left mr-1 text-xs" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <i className="fa-solid fa-chevron-right ml-1 text-xs" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
