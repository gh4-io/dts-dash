"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ForecastGrid } from "@/components/admin/capacity/forecast-grid";
import type { ForecastModel, ForecastRate } from "@/types";

export default function AdminRateForecastsPage() {
  const [models, setModels] = useState<ForecastModel[]>([]);
  const [rates, setRates] = useState<ForecastRate[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/capacity/forecast-models");
      if (!res.ok) throw new Error("Failed to load forecast models");
      setModels(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRates = useCallback(async (modelId: number) => {
    try {
      const res = await fetch(`/api/admin/capacity/rate-forecasts?modelId=${modelId}`);
      if (!res.ok) throw new Error("Failed to load forecast rates");
      setRates(await res.json());
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Failed to load rates");
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (selectedModelId) {
      fetchRates(selectedModelId);
    } else {
      setRates([]);
    }
  }, [selectedModelId, fetchRates]);

  // ── Model CRUD ──

  const handleCreateModel = useCallback(
    async (data: Omit<ForecastModel, "id" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/admin/capacity/forecast-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to create model");
        throw new Error(d.error);
      }
      showMessage("success", "Forecast model created");
      fetchModels();
    },
    [fetchModels],
  );

  const handleUpdateModel = useCallback(
    async (id: number, data: Partial<ForecastModel>) => {
      const res = await fetch(`/api/admin/capacity/forecast-models/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to update model");
        throw new Error(d.error);
      }
      showMessage("success", "Forecast model updated");
      fetchModels();
    },
    [fetchModels],
  );

  const handleDeleteModel = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/forecast-models/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        showMessage("error", "Failed to delete model");
        return;
      }
      showMessage("success", "Forecast model deleted");
      if (selectedModelId === id) setSelectedModelId(null);
      fetchModels();
    },
    [fetchModels, selectedModelId],
  );

  const handleGenerateRates = useCallback(
    async (modelId: number) => {
      const res = await fetch(`/api/admin/capacity/forecast-models/${modelId}/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage("error", data.error ?? "Failed to generate rates");
        return;
      }
      if (data.generated === 0) {
        showMessage("error", data.message ?? "No rates generated");
      } else {
        showMessage(
          "success",
          `Generated ${data.generated} rates (${data.forecastStart} to ${data.forecastEnd})`,
        );
      }
      if (selectedModelId === modelId) fetchRates(modelId);
    },
    [selectedModelId, fetchRates],
  );

  // ── Rate CRUD ──

  const handleCreateRate = useCallback(
    async (data: Omit<ForecastRate, "id" | "modelName" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/admin/capacity/rate-forecasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to create rate");
        throw new Error(d.error);
      }
      showMessage("success", "Forecast rate added");
      if (selectedModelId) fetchRates(selectedModelId);
    },
    [selectedModelId, fetchRates],
  );

  const handleUpdateRate = useCallback(
    async (id: number, data: Partial<ForecastRate>) => {
      const res = await fetch(`/api/admin/capacity/rate-forecasts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        showMessage("error", d.error ?? "Failed to update rate");
        throw new Error(d.error);
      }
      showMessage("success", "Forecast rate updated");
      if (selectedModelId) fetchRates(selectedModelId);
    },
    [selectedModelId, fetchRates],
  );

  const handleDeleteRate = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/admin/capacity/rate-forecasts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        showMessage("error", "Failed to delete rate");
        return;
      }
      showMessage("success", "Forecast rate deleted");
      if (selectedModelId) fetchRates(selectedModelId);
    },
    [selectedModelId, fetchRates],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fa-solid fa-spinner fa-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/capacity" className="hover:text-foreground">
          Capacity
        </Link>
        <i className="fa-solid fa-chevron-right text-[8px]" />
        <span className="text-foreground">Rate Forecasts</span>
      </div>

      {/* Message */}
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

      {/* Info card */}
      <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-teal-400">
          <i className="fa-solid fa-circle-info" />
          About Rate Forecasts
        </div>
        <p className="text-xs text-muted-foreground">
          Rate forecasts project future demand based on historical patterns. Create a model to
          configure the algorithm (moving average, weighted average, or linear trend), then generate
          rates to see projected staffing needs. Manual rate overrides are preserved when
          regenerating.
        </p>
      </div>

      {/* Grid */}
      <ForecastGrid
        models={models}
        rates={rates}
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
        onCreateModel={handleCreateModel}
        onUpdateModel={handleUpdateModel}
        onDeleteModel={handleDeleteModel}
        onGenerateRates={handleGenerateRates}
        onCreateRate={handleCreateRate}
        onUpdateRate={handleUpdateRate}
        onDeleteRate={handleDeleteRate}
      />
    </div>
  );
}
