"use client";

import { useState, useEffect, useCallback } from "react";
import { AllocationGrid } from "@/components/admin/capacity/allocation-grid";
import Link from "next/link";
import type { DemandAllocation, CapacityShift } from "@/types";

interface CustomerOption {
  id: number;
  name: string;
  displayName: string;
}

export default function AdminAllocationsPage() {
  const [allocations, setAllocations] = useState<DemandAllocation[]>([]);
  const [shifts, setShifts] = useState<CapacityShift[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [allocRes, shiftsRes, custRes] = await Promise.all([
        fetch("/api/admin/capacity/demand-allocations"),
        fetch("/api/admin/capacity/shifts"),
        fetch("/api/admin/customers"),
      ]);

      if (!allocRes.ok || !shiftsRes.ok || !custRes.ok) {
        throw new Error("Failed to load data");
      }

      setAllocations(await allocRes.json());
      setShifts(await shiftsRes.json());
      setCustomers(await custRes.json());
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
    async (data: Omit<DemandAllocation, "id" | "customerName" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/admin/capacity/demand-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to create allocation");
        throw new Error(d.error);
      }
      showMessage("success", "Allocation created");
      fetchData();
    },
    [fetchData],
  );

  const handleUpdate = useCallback(
    async (id: number, updates: Partial<DemandAllocation>) => {
      const res = await fetch(`/api/admin/capacity/demand-allocations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to update allocation");
        throw new Error(d.error);
      }
      showMessage("success", "Allocation updated");
      fetchData();
    },
    [fetchData],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/demand-allocations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to delete allocation");
        return;
      }
      showMessage("success", "Allocation deleted");
      fetchData();
    },
    [fetchData],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <i className="fa-solid fa-spinner fa-spin text-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-destructive mb-2 block" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/capacity" className="hover:text-foreground transition-colors">
          Capacity
        </Link>
        <i className="fa-solid fa-chevron-right text-[8px]" />
        <span className="text-foreground">Demand Allocations</span>
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

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
          <i className="fa-solid fa-circle-info" />
          About Demand Allocations
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Allocations define contractual minimum hours per customer. <strong>Minimum Floor</strong>{" "}
          guarantees a minimum MH demand regardless of actual work packages.{" "}
          <strong>Additive</strong> adds MH on top of actual demand. Allocations can be scoped to
          specific shifts and days of the week.
        </p>
      </div>

      <AllocationGrid
        allocations={allocations}
        shifts={shifts}
        customers={customers}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
