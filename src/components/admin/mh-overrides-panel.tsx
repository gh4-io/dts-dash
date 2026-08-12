"use client";

/**
 * MH Overrides admin panel (OI-104).
 *
 * Two views over the same feature: the overrides currently in force, and the
 * append-only history behind them. History is the only place a cleared
 * override's value survives — `mh_overrides` holds one row per work package and
 * a clear deletes it — so the before/after pair is shown there, not here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OverrideRow {
  workPackageId: number;
  spId: number | null;
  workpackageNo: string | null;
  aircraftReg: string;
  customer: string;
  arrival: string;
  importedMH: number | null;
  overrideMH: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

interface HistoryRow {
  id: number;
  workPackageId: number;
  spId: number | null;
  workpackageNo: string | null;
  aircraftReg: string | null;
  action: string;
  previousMH: number | null;
  newMH: number | null;
  importedMH: number | null;
  suppliedMH: number | null;
  minHours: number | null;
  source: string;
  note: string | null;
  changedByName: string | null;
  changedAt: string;
}

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  create: "default",
  update: "secondary",
  clear: "destructive",
};

/** Render an MH value, distinguishing "no value" from zero. */
function mh(value: number | null): string {
  return value === null || value === undefined ? "—" : `${value}`;
}

/**
 * Trigger a CSV download.
 *
 * These URLs are API routes that answer with `Content-Disposition: attachment`,
 * not pages — hence a synthesised anchor rather than `next/link`, which would
 * try to client-navigate to them.
 */
function download(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.click();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * How many rows to render at once.
 *
 * A production database can carry hundreds of overrides; the exports are the
 * route to the full set, so the table trades completeness for a page that stays
 * responsive and tells you what it is holding back.
 */
const ROW_CAP = 200;

export function MHOverridesPanel() {
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Free-text narrowing across the columns that actually identify a row. In
  // databases where workpackage_no was never populated, the SharePoint ID and
  // the registration are the only handles an operator has.
  const filteredOverrides = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return overrides;
    return overrides.filter((row) =>
      [row.workpackageNo, row.spId, row.aircraftReg, row.customer]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [overrides, query]);

  const refresh = useCallback(async () => {
    try {
      const [oRes, hRes] = await Promise.all([
        fetch("/api/admin/mh-overrides"),
        fetch("/api/admin/mh-overrides/history"),
      ]);
      if (oRes.ok) setOverrides((await oRes.json()).overrides);
      if (hRes.ok) setHistory((await hRes.json()).history);
    } catch {
      setMessage({ type: "error", text: "Failed to load MH overrides" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clearOne = async (row: OverrideRow) => {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/mh-overrides?workPackageId=${row.workPackageId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Failed to clear override" });
        return;
      }
      setMessage({
        type: "success",
        text: `${row.workpackageNo ?? row.aircraftReg}: ${body.decision.reason}`,
      });
      await refresh();
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-spinner fa-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <Tabs defaultValue="active">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="active">Active ({overrides.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => download("/api/admin/mh-overrides?format=csv")}
            >
              <i className="fa-solid fa-file-csv mr-2" />
              Export Overrides
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => download("/api/admin/mh-overrides/history?format=csv")}
            >
              <i className="fa-solid fa-file-csv mr-2" />
              Export History
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter by WP number, ID, aircraft or customer"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 max-w-sm text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {filteredOverrides.length > ROW_CAP
                ? `Showing ${ROW_CAP} of ${filteredOverrides.length} — narrow the filter or export for the full set`
                : `${filteredOverrides.length} of ${overrides.length}`}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WP Number</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Aircraft</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead className="text-right">Imported MH</TableHead>
                  <TableHead className="text-right">Override MH</TableHead>
                  <TableHead>Set By</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOverrides.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                      {overrides.length === 0
                        ? "No manual overrides — every work package is on the imported priority chain."
                        : "No override matches this filter."}
                    </TableCell>
                  </TableRow>
                )}
                {filteredOverrides.slice(0, ROW_CAP).map((row) => (
                  <TableRow key={row.workPackageId}>
                    <TableCell className="font-mono text-xs">{row.workpackageNo ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.spId ?? "—"}
                    </TableCell>
                    <TableCell>{row.aircraftReg}</TableCell>
                    <TableCell>{row.customer}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(row.arrival)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {mh(row.importedMH)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{mh(row.overrideMH)}</TableCell>
                    <TableCell className="text-xs">{row.updatedByName ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(row.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => clearOne(row)}>
                        Clear
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>WP Number</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead className="text-right">Supplied</TableHead>
                  <TableHead className="text-right">Imported</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                      No override changes recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {history.slice(0, ROW_CAP).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDate(row.changedAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.workpackageNo ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.spId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ACTION_VARIANT[row.action] ?? "secondary"}
                        className="text-[10px]"
                      >
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{mh(row.previousMH)}</TableCell>
                    <TableCell className="text-right font-semibold">{mh(row.newMH)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {mh(row.suppliedMH)}
                      {row.minHours !== null && (
                        <span className="ml-1 text-[10px]">(min {row.minHours})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {mh(row.importedMH)}
                    </TableCell>
                    <TableCell className="text-xs">{row.source}</TableCell>
                    <TableCell className="text-xs">{row.changedByName ?? "—"}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                      {row.note ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
