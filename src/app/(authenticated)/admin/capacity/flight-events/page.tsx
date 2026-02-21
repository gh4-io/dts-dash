"use client";

import { useState, useEffect, useCallback } from "react";
import { FlightEventsGrid } from "@/components/admin/capacity/flight-events-grid";
import Link from "next/link";
import type { FlightEvent } from "@/types";

export default function AdminFlightEventsPage() {
  const [events, setEvents] = useState<FlightEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/capacity/flight-events");
      if (!res.ok) throw new Error("Failed to load flight events");
      setEvents(await res.json());
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
    async (data: Omit<FlightEvent, "id" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/admin/capacity/flight-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to create event");
        throw new Error(d.error);
      }
      showMessage("success", "Flight event created");
      fetchData();
    },
    [fetchData],
  );

  const handleUpdate = useCallback(
    async (id: number, updates: Partial<FlightEvent>) => {
      const res = await fetch(`/api/admin/capacity/flight-events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to update event");
        throw new Error(d.error);
      }
      showMessage("success", "Flight event updated");
      fetchData();
    },
    [fetchData],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/flight-events/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to delete event");
        return;
      }
      showMessage("success", "Flight event deleted");
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
        <span className="text-foreground">Flight Events</span>
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

      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-sky-400">
          <i className="fa-solid fa-circle-info" />
          About Flight Events
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Flight events track scheduled and actual aircraft arrivals and departures.{" "}
          <strong>Coverage windows</strong> define guaranteed capacity periods: arrival +30 min and
          departure -60 min (configurable per event). Cancelled events are excluded from coverage
          calculations.
        </p>
      </div>

      <FlightEventsGrid
        events={events}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
