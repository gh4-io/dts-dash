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
import type { ForecastRate } from "@/types";

interface ForecastRateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate?: ForecastRate;
  modelId: number;
  onSave: (
    data: Omit<ForecastRate, "id" | "modelName" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
}

export function ForecastRateEditor({
  open,
  onOpenChange,
  rate,
  modelId,
  onSave,
}: ForecastRateEditorProps) {
  const [forecastDate, setForecastDate] = useState("");
  const [shiftCode, setShiftCode] = useState<string>("_none");
  const [customer, setCustomer] = useState("");
  const [forecastedMh, setForecastedMh] = useState("");
  const [confidence, setConfidence] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (rate) {
        setForecastDate(rate.forecastDate);
        setShiftCode(rate.shiftCode ?? "_none");
        setCustomer(rate.customer ?? "");
        setForecastedMh(String(rate.forecastedMh));
        setConfidence(rate.confidence != null ? String(rate.confidence) : "");
        setNotes(rate.notes ?? "");
        setIsActive(rate.isActive);
      } else {
        setForecastDate("");
        setShiftCode("_none");
        setCustomer("");
        setForecastedMh("");
        setConfidence("");
        setNotes("");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, rate]);

  async function handleSubmit() {
    setError(null);
    const errors: string[] = [];

    if (!forecastDate) errors.push("Forecast date is required");
    const mh = parseFloat(forecastedMh);
    if (isNaN(mh) || mh < 0) errors.push("Forecasted MH must be a non-negative number");

    if (confidence) {
      const c = parseFloat(confidence);
      if (isNaN(c) || c < 0 || c > 1) errors.push("Confidence must be 0.0-1.0");
    }

    if (errors.length > 0) {
      setError(errors.join("; "));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        modelId,
        forecastDate,
        shiftCode: shiftCode === "_none" ? null : shiftCode,
        customer: customer.trim() || null,
        forecastedMh: mh,
        confidence: confidence ? parseFloat(confidence) : null,
        isManualOverride: true,
        notes: notes.trim() || null,
        isActive,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!rate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Forecast Rate" : "Add Manual Rate"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this forecast rate entry." : "Manually add a forecast rate override."}
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
              <Label htmlFor="fr-date">Date *</Label>
              <Input
                id="fr-date"
                type="date"
                value={forecastDate}
                onChange={(e) => setForecastDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fr-shift">Shift</Label>
              <Select value={shiftCode} onValueChange={setShiftCode}>
                <SelectTrigger id="fr-shift">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">All (daily)</SelectItem>
                  <SelectItem value="DAY">Day</SelectItem>
                  <SelectItem value="SWING">Swing</SelectItem>
                  <SelectItem value="NIGHT">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fr-mh">Forecasted MH *</Label>
              <Input
                id="fr-mh"
                type="number"
                min={0}
                step={0.5}
                value={forecastedMh}
                onChange={(e) => setForecastedMh(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fr-confidence">Confidence (0-1)</Label>
              <Input
                id="fr-confidence"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fr-customer">Customer (optional)</Label>
            <Input
              id="fr-customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Leave blank for aggregate"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fr-notes">Notes</Label>
            <Textarea
              id="fr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="fr-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="fr-active" className="font-normal">
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
            {isEdit ? "Update" : "Add Rate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
