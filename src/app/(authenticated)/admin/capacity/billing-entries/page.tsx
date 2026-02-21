"use client";

import { useState, useEffect, useCallback } from "react";
import { BillingGrid } from "@/components/admin/capacity/billing-grid";
import Link from "next/link";
import type { BillingEntry } from "@/types";

export default function AdminBillingEntriesPage() {
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/capacity/billing-entries");
      if (!res.ok) throw new Error("Failed to load data");
      setEntries(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreate = useCallback(
    async (data: Omit<BillingEntry, "id" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/admin/capacity/billing-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to create entry");
        throw new Error(d.error);
      }
      showMessage("success", "Billing entry created");
      fetchData();
    },
    [fetchData],
  );

  const handleUpdate = useCallback(
    async (id: number, updates: Partial<BillingEntry>) => {
      const res = await fetch(`/api/admin/capacity/billing-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to update entry");
        throw new Error(d.error);
      }
      showMessage("success", "Billing entry updated");
      fetchData();
    },
    [fetchData],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/billing-entries/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to delete entry");
        return;
      }
      showMessage("success", "Billing entry deleted");
      fetchData();
    },
    [fetchData],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <i className="fa-solid fa-spinner fa-spin text-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/capacity" className="hover:text-foreground transition-colors">
          Capacity
        </Link>
        <i className="fa-solid fa-chevron-right text-[8px]" />
        <span className="text-foreground">Billed Hours</span>
      </div>

      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm transition-opacity ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-indigo-400">
          <i className="fa-solid fa-circle-info" />
          About Billed Hours
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Track invoiced/billable man-hours per customer and aircraft. Use this to reconcile billed
          hours against worked hours and planned demand. Billed hours appear as an informational
          overlay on the capacity overview.
        </p>
      </div>

      <BillingGrid
        entries={entries}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
