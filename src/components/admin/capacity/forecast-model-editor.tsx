"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ForecastModel } from "@/types";

interface ForecastModelEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model?: ForecastModel;
  onSave: (data: Omit<ForecastModel, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

export function ForecastModelEditor({
  open,
  onOpenChange,
  model,
  onSave,
}: ForecastModelEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<string>("moving_average");
  const [lookbackDays, setLookbackDays] = useState("30");
  const [forecastHorizonDays, setForecastHorizonDays] = useState("14");
  const [granularity, setGranularity] = useState<string>("shift");
  const [customerFilter, setCustomerFilter] = useState("");
  const [weightRecent, setWeightRecent] = useState("0.7");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (model) {
        setName(model.name);
        setDescription(model.description ?? "");
        setMethod(model.method);
        setLookbackDays(String(model.lookbackDays));
        setForecastHorizonDays(String(model.forecastHorizonDays));
        setGranularity(model.granularity);
        setCustomerFilter(model.customerFilter ?? "");
        setWeightRecent(String(model.weightRecent));
        setIsActive(model.isActive);
      } else {
        setName("");
        setDescription("");
        setMethod("moving_average");
        setLookbackDays("30");
        setForecastHorizonDays("14");
        setGranularity("shift");
        setCustomerFilter("");
        setWeightRecent("0.7");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, model]);

  async function handleSubmit() {
    setError(null);
    const errors: string[] = [];

    if (!name.trim()) errors.push("Name is required");
    const lb = parseInt(lookbackDays, 10);
    if (isNaN(lb) || lb < 7 || lb > 365) errors.push("Lookback days must be 7-365");
    const fh = parseInt(forecastHorizonDays, 10);
    if (isNaN(fh) || fh < 1 || fh > 90) errors.push("Forecast horizon must be 1-90 days");
    const wr = parseFloat(weightRecent);
    if (isNaN(wr) || wr < 0 || wr > 1) errors.push("Weight recent must be 0.0-1.0");

    if (errors.length > 0) {
      setError(errors.join("; "));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        method: method as ForecastModel["method"],
        lookbackDays: lb,
        forecastHorizonDays: fh,
        granularity: granularity as ForecastModel["granularity"],
        customerFilter: customerFilter.trim() || null,
        weightRecent: wr,
        isActive,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!model;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Forecast Model" : "New Forecast Model"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the forecast model configuration."
              : "Define a new forecasting model for demand projection."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fm-name">Name *</Label>
              <Input
                id="fm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q1 Forecast"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fm-method">Method *</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="fm-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moving_average">Moving Average</SelectItem>
                  <SelectItem value="weighted_average">Weighted Average</SelectItem>
                  <SelectItem value="linear_trend">Linear Trend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fm-lookback">Lookback (days)</Label>
              <Input
                id="fm-lookback"
                type="number"
                min={7}
                max={365}
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fm-horizon">Horizon (days)</Label>
              <Input
                id="fm-horizon"
                type="number"
                min={1}
                max={90}
                value={forecastHorizonDays}
                onChange={(e) => setForecastHorizonDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fm-granularity">Granularity</Label>
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger id="fm-granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shift">Per Shift</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {method === "weighted_average" && (
            <div className="space-y-2">
              <Label htmlFor="fm-weight">Weight Recent (0.0-1.0)</Label>
              <Input
                id="fm-weight"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={weightRecent}
                onChange={(e) => setWeightRecent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Higher values weight recent data more heavily.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fm-filter">Customer Filter (optional)</Label>
            <Input
              id="fm-filter"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              placeholder="Acme, Beta (comma-separated)"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to forecast aggregate demand across all customers.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fm-desc">Description</Label>
            <Textarea
              id="fm-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes about this model..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="fm-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="fm-active" className="font-normal">
              Active
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <i className="fa-solid fa-spinner fa-spin mr-2" />}
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
