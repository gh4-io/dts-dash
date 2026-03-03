"use client";

import { useState, useEffect, useCallback } from "react";
import { AssumptionsForm } from "@/components/admin/capacity/assumptions-form";
import { ShiftTimezoneSelector } from "@/components/admin/capacity/shift-timezone-selector";
import Link from "next/link";
import type { CapacityAssumptions, CapacityShift } from "@/types";

export default function AdminAssumptionsPage() {
  const [assumptions, setAssumptions] = useState<CapacityAssumptions | null>(null);
  const [shifts, setShifts] = useState<CapacityShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch("/api/admin/capacity/assumptions"),
        fetch("/api/admin/capacity/shifts"),
      ]);
      if (!aRes.ok) throw new Error("Failed to load assumptions");
      if (!sRes.ok) throw new Error("Failed to load shifts");
      setAssumptions(await aRes.json());
      setShifts(await sRes.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = useCallback(async (updates: Partial<CapacityAssumptions>) => {
    const res = await fetch("/api/admin/capacity/assumptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to save");
    }
    const updated = await res.json();
    setAssumptions(updated);
  }, []);

  const handleTimezoneChange = useCallback(async (tz: string) => {
    const res = await fetch("/api/admin/capacity/shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
    if (!res.ok) throw new Error("Failed to update timezone");
    setShifts(await res.json());
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <i className="fa-solid fa-spinner fa-spin text-2xl" />
        </div>
      </div>
    );
  }

  if (error || !assumptions) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error ?? "No assumptions configured"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/capacity" className="hover:text-foreground transition-colors">
          Capacity
        </Link>
        <i className="fa-solid fa-chevron-right text-[8px]" />
        <span className="text-foreground">Model Assumptions</span>
      </div>

      <ShiftTimezoneSelector
        currentTimezone={shifts[0]?.timezone ?? "UTC"}
        onSave={handleTimezoneChange}
      />

      <AssumptionsForm initial={assumptions} onSave={handleSave} />
    </div>
  );
}
