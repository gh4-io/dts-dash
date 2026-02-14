"use client";

import { useState, useEffect, useCallback } from "react";
import { CustomerColorEditor } from "@/components/admin/customer-color-editor";
import { useCustomers } from "@/lib/hooks/use-customers";
import type { Customer } from "@/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/customers");
      if (res.ok) {
        setCustomers(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSave = async (updates: Array<{ id: string; color: string; displayName: string }>) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Customer colors saved" });
        await fetchCustomers();
        await useCustomers.getState().invalidate();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/customers/reset", { method: "POST" });
      if (res.ok) {
        setMessage({ type: "success", text: "Defaults restored" });
        await fetchCustomers();
        await useCustomers.getState().invalidate();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Failed to reset" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (data: { name: string; displayName: string; color: string }) => {
    const res = await fetch("/api/admin/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error ?? "Failed to create customer");
    }
    setMessage({ type: "success", text: "Customer added" });
    await fetchCustomers();
    await useCustomers.getState().invalidate();
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

      <CustomerColorEditor
        customers={customers}
        onSave={handleSave}
        onReset={handleReset}
        onAdd={handleAdd}
        saving={saving}
      />
    </div>
  );
}
