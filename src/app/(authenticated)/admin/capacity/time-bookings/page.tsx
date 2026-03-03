"use client";

import { useState, useEffect, useCallback } from "react";
import { TimeBookingsGrid } from "@/components/admin/capacity/time-bookings-grid";
import Link from "next/link";
import type { TimeBooking } from "@/types";

export default function AdminTimeBookingsPage() {
  const [bookings, setBookings] = useState<TimeBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/capacity/time-bookings");
      if (!res.ok) throw new Error("Failed to load data");
      setBookings(await res.json());
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
    async (data: Omit<TimeBooking, "id" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/admin/capacity/time-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to create booking");
        throw new Error(d.error);
      }
      showMessage("success", "Time booking created");
      fetchData();
    },
    [fetchData],
  );

  const handleUpdate = useCallback(
    async (id: number, updates: Partial<TimeBooking>) => {
      const res = await fetch(`/api/admin/capacity/time-bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to update booking");
        throw new Error(d.error);
      }
      showMessage("success", "Time booking updated");
      fetchData();
    },
    [fetchData],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/time-bookings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to delete booking");
        return;
      }
      showMessage("success", "Time booking deleted");
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
        <span className="text-foreground">Worked Hours</span>
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

      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-green-400">
          <i className="fa-solid fa-circle-info" />
          About Worked Hours
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Track actual man-hours spent per task. Multiple entries per work package are supported
          &mdash; e.g., routine check (2h) + non-routine repair (1.5h). Task types:{" "}
          <strong>Routine</strong>, <strong>Non-Routine</strong>, <strong>AOG</strong>,{" "}
          <strong>Training</strong>, <strong>Admin</strong>. Worked hours appear as an informational
          overlay on the capacity overview, showing planned vs actual variance.
        </p>
      </div>

      <TimeBookingsGrid
        bookings={bookings}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
