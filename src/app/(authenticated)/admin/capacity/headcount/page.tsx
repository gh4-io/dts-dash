"use client";

import { useState, useEffect, useCallback } from "react";
import { HeadcountGrid } from "@/components/admin/capacity/headcount-grid";
import Link from "next/link";
import type { CapacityShift, HeadcountPlan, HeadcountException } from "@/types";

export default function AdminHeadcountPage() {
  const [shifts, setShifts] = useState<CapacityShift[]>([]);
  const [plans, setPlans] = useState<HeadcountPlan[]>([]);
  const [exceptions, setExceptions] = useState<HeadcountException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [shiftsRes, plansRes, exceptionsRes] = await Promise.all([
        fetch("/api/admin/capacity/shifts"),
        fetch("/api/admin/capacity/headcount-plans"),
        fetch("/api/admin/capacity/headcount-exceptions"),
      ]);

      if (!shiftsRes.ok || !plansRes.ok || !exceptionsRes.ok) {
        throw new Error("Failed to load capacity data");
      }

      setShifts(await shiftsRes.json());
      setPlans(await plansRes.json());
      setExceptions(await exceptionsRes.json());
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

  const handleCreatePlan = useCallback(
    async (plan: Omit<HeadcountPlan, "id" | "station">) => {
      const res = await fetch("/api/admin/capacity/headcount-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error ?? "Failed to create plan");
        throw new Error(data.error);
      }
      showMessage("success", "Plan created");
      fetchData();
    },
    [fetchData],
  );

  const handleUpdatePlan = useCallback(
    async (id: number, updates: Partial<HeadcountPlan>) => {
      const res = await fetch(`/api/admin/capacity/headcount-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error ?? "Failed to update plan");
        throw new Error(data.error);
      }
      showMessage("success", "Plan updated");
      fetchData();
    },
    [fetchData],
  );

  const handleDeletePlan = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/headcount-plans/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error ?? "Failed to delete plan");
        return;
      }
      showMessage("success", "Plan deleted");
      fetchData();
    },
    [fetchData],
  );

  const handleCreateException = useCallback(
    async (exc: Omit<HeadcountException, "id" | "station">) => {
      const res = await fetch("/api/admin/capacity/headcount-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exc),
      });
      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error ?? "Failed to create exception");
        throw new Error(data.error);
      }
      showMessage("success", "Exception created");
      fetchData();
    },
    [fetchData],
  );

  const handleDeleteException = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/headcount-exceptions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        showMessage("error", data.error ?? "Failed to delete exception");
        return;
      }
      showMessage("success", "Exception deleted");
      fetchData();
    },
    [fetchData],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <i className="fa-solid fa-spinner fa-spin text-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/capacity" className="hover:text-foreground transition-colors">
          Capacity
        </Link>
        <i className="fa-solid fa-chevron-right text-[8px]" />
        <span className="text-foreground">Headcount Plans</span>
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

      {/* Shift reference */}
      <div className="flex gap-3">
        {shifts
          .filter((s) => s.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((shift) => (
            <div
              key={shift.id}
              className="flex-1 rounded-md border border-border bg-card p-3 text-center"
            >
              <div className="text-xs text-muted-foreground">
                {String(shift.startHour).padStart(2, "0")}-{String(shift.endHour).padStart(2, "0")}
              </div>
              <div className="text-sm font-medium">{shift.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {shift.paidHours}h paid | min {shift.minHeadcount}
              </div>
            </div>
          ))}
      </div>

      <HeadcountGrid
        shifts={shifts}
        plans={plans}
        exceptions={exceptions}
        onCreatePlan={handleCreatePlan}
        onUpdatePlan={handleUpdatePlan}
        onDeletePlan={handleDeletePlan}
        onCreateException={handleCreateException}
        onDeleteException={handleDeleteException}
      />
    </div>
  );
}
