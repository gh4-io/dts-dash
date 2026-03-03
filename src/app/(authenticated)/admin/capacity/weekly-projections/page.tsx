"use client";

import { useState, useEffect, useCallback } from "react";
import { ProjectionGrid } from "@/components/admin/capacity/projection-grid";
import Link from "next/link";
import type { WeeklyProjection } from "@/types";

export default function AdminWeeklyProjectionsPage() {
  const [projections, setProjections] = useState<WeeklyProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/capacity/weekly-projections");
      if (!res.ok) throw new Error("Failed to load data");
      setProjections(await res.json());
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

  const handleSave = useCallback(
    async (
      rows: Array<{
        customer: string;
        dayOfWeek: number;
        shiftCode: string;
        projectedMh: number;
        notes?: string | null;
        isActive?: boolean;
      }>,
    ) => {
      const res = await fetch("/api/admin/capacity/weekly-projections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to save projections");
        return;
      }
      const data = await res.json();
      showMessage("success", `Saved ${data.saved} projection entries`);
      fetchData();
    },
    [fetchData],
  );

  const handleClearAll = useCallback(async () => {
    if (!confirm("Clear ALL projections? This cannot be undone.")) return;
    const res = await fetch("/api/admin/capacity/weekly-projections", {
      method: "DELETE",
    });
    if (!res.ok) {
      showMessage("error", "Failed to clear projections");
      return;
    }
    showMessage("success", "All projections cleared");
    fetchData();
  }, [fetchData]);

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
        <span className="text-foreground">Weekly Projections</span>
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

      <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-pink-400">
          <i className="fa-solid fa-circle-info" />
          About Weekly MH Projections
          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
            TEMP
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter assumed customer man-hour targets per day-of-week and shift. These appear as pink
          dashed overlay lines on the Typical Week Pattern chart. This is a temporary reference
          feature — no FK to customers, easy to remove.
        </p>
      </div>

      <ProjectionGrid projections={projections} onSave={handleSave} onClearAll={handleClearAll} />
    </div>
  );
}
