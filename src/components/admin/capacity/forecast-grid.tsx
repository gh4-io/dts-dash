"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ForecastModelEditor } from "./forecast-model-editor";
import { ForecastRateEditor } from "./forecast-rate-editor";
import type { ForecastModel, ForecastRate } from "@/types";

const METHOD_STYLES: Record<string, string> = {
  moving_average: "border-blue-500/50 text-blue-500",
  weighted_average: "border-violet-500/50 text-violet-500",
  linear_trend: "border-emerald-500/50 text-emerald-500",
};

const METHOD_LABELS: Record<string, string> = {
  moving_average: "Moving Avg",
  weighted_average: "Weighted Avg",
  linear_trend: "Linear Trend",
};

interface ForecastGridProps {
  models: ForecastModel[];
  rates: ForecastRate[];
  selectedModelId: number | null;
  onSelectModel: (id: number | null) => void;
  onCreateModel: (data: Omit<ForecastModel, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdateModel: (id: number, data: Partial<ForecastModel>) => Promise<void>;
  onDeleteModel: (id: number) => Promise<void>;
  onGenerateRates: (modelId: number) => Promise<void>;
  onCreateRate: (
    data: Omit<ForecastRate, "id" | "modelName" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdateRate: (id: number, data: Partial<ForecastRate>) => Promise<void>;
  onDeleteRate: (id: number) => Promise<void>;
}

export function ForecastGrid({
  models,
  rates,
  selectedModelId,
  onSelectModel,
  onCreateModel,
  onUpdateModel,
  onDeleteModel,
  onGenerateRates,
  onCreateRate,
  onUpdateRate,
  onDeleteRate,
}: ForecastGridProps) {
  const [modelEditorOpen, setModelEditorOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ForecastModel | undefined>();
  const [rateEditorOpen, setRateEditorOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ForecastRate | undefined>();
  const [deleteModelId, setDeleteModelId] = useState<number | null>(null);
  const [deleteRateId, setDeleteRateId] = useState<number | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);

  function handleNewModel() {
    setEditingModel(undefined);
    setModelEditorOpen(true);
  }

  function handleEditModel(model: ForecastModel) {
    setEditingModel(model);
    setModelEditorOpen(true);
  }

  async function handleSaveModel(data: Omit<ForecastModel, "id" | "createdAt" | "updatedAt">) {
    if (editingModel) {
      await onUpdateModel(editingModel.id, data);
    } else {
      await onCreateModel(data);
    }
  }

  async function handleGenerate(modelId: number) {
    setGenerating(modelId);
    try {
      await onGenerateRates(modelId);
    } finally {
      setGenerating(null);
    }
  }

  function handleNewRate() {
    setEditingRate(undefined);
    setRateEditorOpen(true);
  }

  function handleEditRate(rate: ForecastRate) {
    setEditingRate(rate);
    setRateEditorOpen(true);
  }

  async function handleSaveRate(
    data: Omit<ForecastRate, "id" | "modelName" | "createdAt" | "updatedAt">,
  ) {
    if (editingRate) {
      await onUpdateRate(editingRate.id, data);
    } else {
      await onCreateRate(data);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Models Section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Forecast Models</h3>
          <Button size="sm" onClick={handleNewModel}>
            <i className="fa-solid fa-plus mr-2" />
            Add Model
          </Button>
        </div>

        {models.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-muted-foreground">
            <i className="fa-solid fa-chart-line text-2xl" />
            <p className="text-sm">No forecast models defined yet.</p>
            <p className="text-xs">Create a model to start projecting future demand.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-center">Lookback</TableHead>
                  <TableHead className="text-center">Horizon</TableHead>
                  <TableHead>Granularity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((m) => (
                  <TableRow
                    key={m.id}
                    className={`cursor-pointer ${selectedModelId === m.id ? "bg-muted/50" : ""}`}
                    onClick={() => onSelectModel(selectedModelId === m.id ? null : m.id)}
                  >
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${METHOD_STYLES[m.method] ?? ""}`}
                      >
                        {METHOD_LABELS[m.method] ?? m.method}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{m.lookbackDays}d</TableCell>
                    <TableCell className="text-center">{m.forecastHorizonDays}d</TableCell>
                    <TableCell className="capitalize">{m.granularity}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                          m.isActive
                            ? "border-emerald-500/50 text-emerald-500"
                            : "border-muted-foreground/50 text-muted-foreground"
                        }`}
                      >
                        {m.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerate(m.id)}
                          disabled={generating === m.id}
                          title="Generate forecast rates"
                        >
                          {generating === m.id ? (
                            <i className="fa-solid fa-spinner fa-spin" />
                          ) : (
                            <i className="fa-solid fa-bolt" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditModel(m)}>
                          <i className="fa-solid fa-pen-to-square" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteModelId(m.id)}>
                          <i className="fa-solid fa-trash text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Rates Section (when model selected) ── */}
      {selectedModelId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Forecast Rates
              <span className="ml-2 text-muted-foreground">
                ({rates.length} {rates.length === 1 ? "rate" : "rates"})
              </span>
            </h3>
            <Button size="sm" variant="outline" onClick={handleNewRate}>
              <i className="fa-solid fa-plus mr-2" />
              Add Manual Rate
            </Button>
          </div>

          {rates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
              <i className="fa-solid fa-table text-xl" />
              <p className="text-sm">No rates for this model.</p>
              <p className="text-xs">
                Click the <i className="fa-solid fa-bolt" /> generate button above to create
                forecast rates.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">MH</TableHead>
                    <TableHead className="text-center">Confidence</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.forecastDate}</TableCell>
                      <TableCell>{r.shiftCode ?? "All"}</TableCell>
                      <TableCell>{r.customer ?? "Aggregate"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {r.forecastedMh.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        {r.isManualOverride ? (
                          <span className="inline-flex items-center rounded-full border border-amber-500/50 px-2 py-0.5 text-xs text-amber-500">
                            Manual
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Generated</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditRate(r)}>
                            <i className="fa-solid fa-pen-to-square" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteRateId(r.id)}>
                            <i className="fa-solid fa-trash text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Editors ── */}
      <ForecastModelEditor
        open={modelEditorOpen}
        onOpenChange={setModelEditorOpen}
        model={editingModel}
        onSave={handleSaveModel}
      />

      {selectedModelId && (
        <ForecastRateEditor
          open={rateEditorOpen}
          onOpenChange={setRateEditorOpen}
          rate={editingRate}
          modelId={selectedModelId}
          onSave={handleSaveRate}
        />
      )}

      {/* ── Delete Model Confirmation ── */}
      <AlertDialog open={deleteModelId !== null} onOpenChange={() => setDeleteModelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Forecast Model?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the model and all its forecast rates. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteModelId) onDeleteModel(deleteModelId);
                setDeleteModelId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Rate Confirmation ── */}
      <AlertDialog open={deleteRateId !== null} onOpenChange={() => setDeleteRateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Forecast Rate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this forecast rate entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteRateId) onDeleteRate(deleteRateId);
                setDeleteRateId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
