"use client";

import { useState, useEffect, useCallback } from "react";
import { AllocationGrid } from "@/components/admin/capacity/allocation-grid";
import Link from "next/link";
import type { DemandContract, CapacityShift } from "@/types";

interface CustomerOption {
  id: number;
  name: string;
  displayName: string;
}

export default function AdminAllocationsPage() {
  const [contracts, setContracts] = useState<DemandContract[]>([]);
  const [shifts, setShifts] = useState<CapacityShift[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [contractsRes, shiftsRes, custRes] = await Promise.all([
        fetch("/api/admin/capacity/demand-contracts"),
        fetch("/api/admin/capacity/shifts"),
        fetch("/api/admin/customers"),
      ]);

      if (!contractsRes.ok || !shiftsRes.ok || !custRes.ok) {
        throw new Error("Failed to load data");
      }

      setContracts(await contractsRes.json());
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
    async (data: Record<string, unknown>) => {
      const res = await fetch("/api/admin/capacity/demand-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to create contract");
        throw new Error(d.error);
      }
      showMessage("success", "Contract created");
      fetchData();
    },
    [fetchData],
  );

  const handleUpdate = useCallback(
    async (id: number, updates: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/capacity/demand-contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to update contract");
        throw new Error(d.error);
      }
      showMessage("success", "Contract updated");
      fetchData();
    },
    [fetchData],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/demand-contracts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to delete contract");
        return;
      }
      showMessage("success", "Contract deleted");
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
        <span className="text-foreground">Demand Contracts</span>
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
          About Demand Contracts
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Contracts define named customer obligations with scheduled allocation lines.{" "}
          <strong>Minimum Floor</strong> guarantees a minimum MH demand regardless of actual work
          packages. <strong>Additive</strong> adds MH on top of actual demand. Each contract can
          have multiple lines scoped to specific shifts and days of the week. Set contracted MH for
          sanity-check projections.
        </p>
      </div>

      <AllocationGrid
        contracts={contracts}
        shifts={shifts}
        customers={customers}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
