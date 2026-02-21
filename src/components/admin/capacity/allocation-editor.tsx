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
import type { DemandAllocation, CapacityShift } from "@/types";

const DAYS_OF_WEEK = [
  { value: "null", label: "All Days" },
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface CustomerOption {
  id: number;
  name: string;
  displayName: string;
}

interface AllocationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: DemandAllocation | null; // null = create mode
  shifts: CapacityShift[];
  customers: CustomerOption[];
  onSave: (
    data: Omit<DemandAllocation, "id" | "customerName" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
}

export function AllocationEditor({
  open,
  onOpenChange,
  allocation,
  shifts,
  customers,
  onSave,
}: AllocationEditorProps) {
  const [customerId, setCustomerId] = useState<string>("");
  const [shiftId, setShiftId] = useState<string>("null");
  const [dayOfWeek, setDayOfWeek] = useState<string>("null");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [allocatedMh, setAllocatedMh] = useState("");
  const [mode, setMode] = useState<"ADDITIVE" | "MINIMUM_FLOOR">("MINIMUM_FLOOR");
  const [reason, setReason] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (allocation) {
        setCustomerId(String(allocation.customerId));
        setShiftId(allocation.shiftId !== null ? String(allocation.shiftId) : "null");
        setDayOfWeek(allocation.dayOfWeek !== null ? String(allocation.dayOfWeek) : "null");
        setEffectiveFrom(allocation.effectiveFrom);
        setEffectiveTo(allocation.effectiveTo ?? "");
        setAllocatedMh(String(allocation.allocatedMh));
        setMode(allocation.mode);
        setReason(allocation.reason ?? "");
        setIsActive(allocation.isActive);
      } else {
        setCustomerId("");
        setShiftId("null");
        setDayOfWeek("null");
        setEffectiveFrom(new Date().toISOString().split("T")[0]);
        setEffectiveTo("");
        setAllocatedMh("");
        setMode("MINIMUM_FLOOR");
        setReason("");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, allocation]);

  const handleSave = async () => {
    setError(null);

    if (!customerId) {
      setError("Please select a customer");
      return;
    }
    if (!effectiveFrom) {
      setError("Effective From date is required");
      return;
    }
    const mhNum = parseFloat(allocatedMh);
    if (isNaN(mhNum) || mhNum <= 0) {
      setError("Allocated MH must be a positive number");
      return;
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      setError("Effective To must be after Effective From");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        customerId: parseInt(customerId, 10),
        shiftId: shiftId === "null" ? null : parseInt(shiftId, 10),
        dayOfWeek: dayOfWeek === "null" ? null : parseInt(dayOfWeek, 10),
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        allocatedMh: mhNum,
        mode,
        reason: reason || null,
        isActive,
      });
    } catch {
      // Error displayed by parent showMessage
    } finally {
      setSaving(false);
    }
  };

  const isEdit = allocation !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Allocation" : "Add Allocation"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the demand allocation parameters."
              : "Create a new contractual demand allocation for a customer."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.displayName || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shift">Shift</Label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger id="shift">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">All Shifts</SelectItem>
                  {shifts
                    .filter((s) => s.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dow">Day of Week</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger id="dow">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Effective From *</Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveTo">Effective To</Label>
              <Input
                id="effectiveTo"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Leave empty for indefinite</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allocatedMh">Allocated MH *</Label>
            <Input
              id="allocatedMh"
              type="number"
              min="0.1"
              step="0.1"
              value={allocatedMh}
              onChange={(e) => setAllocatedMh(e.target.value)}
              placeholder="e.g., 120"
            />
          </div>

          <div className="space-y-2">
            <Label>Mode *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("MINIMUM_FLOOR")}
                className={`rounded-md border p-3 text-left transition-all ${
                  mode === "MINIMUM_FLOOR"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className="text-sm font-medium">Minimum Floor</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  max(actual, allocated)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("ADDITIVE")}
                className={`rounded-md border p-3 text-left transition-all ${
                  mode === "ADDITIVE"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className="text-sm font-medium">Additive</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">actual + allocated</div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Contract clause 4.2 — guaranteed maintenance window"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="isActive" className="text-sm font-normal">
              Active
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
            {isEdit ? "Save Changes" : "Create Allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
