"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { computeContractProjection, getProjectionStatus } from "@/lib/capacity/allocation-engine";
import type { DemandContract, CapacityShift, ProjectionStatus, ContractPeriodType } from "@/types";

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

const PERIOD_TYPES = [
  { value: "NONE", label: "None (no check)" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "TOTAL", label: "Total (contract period)" },
  { value: "PER_EVENT", label: "Per Event" },
];

interface CustomerOption {
  id: number;
  name: string;
  displayName: string;
}

interface LineFormRow {
  key: string; // temp ID for React keys
  shiftId: string;
  dayOfWeek: string;
  allocatedMh: string;
  label: string;
}

interface AllocationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: DemandContract | null; // null = create mode
  shifts: CapacityShift[];
  customers: CustomerOption[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

let lineKeyCounter = 0;
function nextKey() {
  return `line-${++lineKeyCounter}`;
}

export function AllocationEditor({
  open,
  onOpenChange,
  contract,
  shifts,
  customers,
  onSave,
}: AllocationEditorProps) {
  // Contract fields
  const [customerId, setCustomerId] = useState<string>("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"ADDITIVE" | "MINIMUM_FLOOR">("MINIMUM_FLOOR");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [contractedMh, setContractedMh] = useState("");
  const [periodType, setPeriodType] = useState("NONE");
  const [reason, setReason] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Lines
  const [lines, setLines] = useState<LineFormRow[]>([]);
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (contract) {
        setCustomerId(String(contract.customerId));
        setName(contract.name);
        setMode(contract.mode);
        setEffectiveFrom(contract.effectiveFrom);
        setEffectiveTo(contract.effectiveTo ?? "");
        setContractedMh(contract.contractedMh !== null ? String(contract.contractedMh) : "");
        setPeriodType(contract.periodType ?? "NONE");
        setReason(contract.reason ?? "");
        setIsActive(contract.isActive);
        setLines(
          contract.lines.map((l) => ({
            key: nextKey(),
            shiftId: l.shiftId !== null ? String(l.shiftId) : "null",
            dayOfWeek: l.dayOfWeek !== null ? String(l.dayOfWeek) : "null",
            allocatedMh: String(l.allocatedMh),
            label: l.label ?? "",
          })),
        );
      } else {
        setCustomerId("");
        setName("");
        setMode("MINIMUM_FLOOR");
        setEffectiveFrom(new Date().toISOString().split("T")[0]);
        setEffectiveTo("");
        setContractedMh("");
        setPeriodType("NONE");
        setReason("");
        setIsActive(true);
        setLines([
          { key: nextKey(), shiftId: "null", dayOfWeek: "null", allocatedMh: "", label: "" },
        ]);
      }
      setError(null);
    }
  }, [open, contract]);

  // Live projection
  const projection = useMemo(() => {
    const mh = contractedMh ? parseFloat(contractedMh) : null;
    const pt = periodType !== "NONE" ? periodType : null;
    if (mh === null || pt === null || isNaN(mh))
      return { projected: null, status: null as ProjectionStatus | null };

    const parsedLines = lines
      .filter((l) => l.allocatedMh && parseFloat(l.allocatedMh) > 0)
      .map((l) => ({
        dayOfWeek: l.dayOfWeek === "null" ? null : parseInt(l.dayOfWeek, 10),
        allocatedMh: parseFloat(l.allocatedMh),
      }));

    const projected = computeContractProjection(
      {
        contractedMh: mh,
        periodType: pt as ContractPeriodType,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      },
      parsedLines,
    );

    return {
      projected,
      status: getProjectionStatus(projected, mh),
    };
  }, [contractedMh, periodType, effectiveFrom, effectiveTo, lines]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { key: nextKey(), shiftId: "null", dayOfWeek: "null", allocatedMh: "", label: "" },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const updateLine = (key: string, field: keyof LineFormRow, value: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const handleSave = async () => {
    setError(null);

    if (!customerId) {
      setError("Please select a customer");
      return;
    }
    if (!name.trim()) {
      setError("Contract name is required");
      return;
    }
    if (!effectiveFrom) {
      setError("Effective From date is required");
      return;
    }
    if (effectiveTo && effectiveTo < effectiveFrom) {
      setError("Effective To must be after Effective From");
      return;
    }

    // Validate contracted MH / period type pairing
    const mhVal = contractedMh ? parseFloat(contractedMh) : null;
    const ptVal = periodType !== "NONE" ? periodType : null;
    if ((mhVal !== null && !isNaN(mhVal)) !== (ptVal !== null)) {
      setError("Contracted MH and Period Type must both be set or both empty");
      return;
    }
    if (mhVal !== null && !isNaN(mhVal) && mhVal <= 0) {
      setError("Contracted MH must be positive");
      return;
    }

    // Validate lines (PER_EVENT contracts can skip lines — uses contractedMh directly)
    const isPEREvent = ptVal === "PER_EVENT";
    const validLines = lines.filter((l) => l.allocatedMh && parseFloat(l.allocatedMh) > 0);
    if (!isPEREvent && validLines.length === 0) {
      setError("At least one allocation line with positive MH is required");
      return;
    }
    for (const l of validLines) {
      if (isNaN(parseFloat(l.allocatedMh)) || parseFloat(l.allocatedMh) <= 0) {
        setError("All lines must have positive Allocated MH");
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        customerId: parseInt(customerId, 10),
        name: name.trim(),
        mode,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        contractedMh: mhVal !== null && !isNaN(mhVal) ? mhVal : null,
        periodType: ptVal,
        reason: reason || null,
        isActive,
        lines: validLines.map((l) => ({
          shiftId: l.shiftId === "null" ? null : parseInt(l.shiftId, 10),
          dayOfWeek: l.dayOfWeek === "null" ? null : parseInt(l.dayOfWeek, 10),
          allocatedMh: parseFloat(l.allocatedMh),
          label: l.label || null,
        })),
      });
    } catch {
      // Error displayed by parent showMessage
    } finally {
      setSaving(false);
    }
  };

  const isEdit = contract !== null;

  const statusColor: Record<string, string> = {
    SHORTFALL: "text-amber-500",
    OK: "text-emerald-500",
    EXCESS: "text-blue-500",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contract" : "Add Contract"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the demand contract and its allocation lines."
              : "Create a new demand contract with scheduled allocation lines."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ─── Contract Section ─── */}
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

          <div className="space-y-2">
            <Label htmlFor="contractName">Contract Name *</Label>
            <Input
              id="contractName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Base Contract Q1 2026"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractedMh">Contracted MH</Label>
              <Input
                id="contractedMh"
                type="number"
                min="0.1"
                step="0.1"
                value={contractedMh}
                onChange={(e) => setContractedMh(e.target.value)}
                placeholder="e.g., 500"
              />
              <p className="text-[10px] text-muted-foreground">Total obligation for sanity check</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodType">Period Type</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger id="periodType">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Live Projection Indicator */}
          {projection.projected !== null && (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Projected: </span>
              <span
                className={`font-mono font-medium ${projection.status ? statusColor[projection.status] : ""}`}
              >
                {projection.projected.toFixed(1)} MH
              </span>
              <span className="text-muted-foreground"> / Contracted: </span>
              <span className="font-mono">{parseFloat(contractedMh).toFixed(1)} MH</span>
              {projection.status && (
                <Badge
                  variant="outline"
                  className={`ml-2 text-xs ${
                    projection.status === "SHORTFALL"
                      ? "border-amber-500/50 text-amber-500"
                      : projection.status === "OK"
                        ? "border-emerald-500/50 text-emerald-500"
                        : "border-blue-500/50 text-blue-500"
                  }`}
                >
                  {projection.status === "SHORTFALL"
                    ? "Under"
                    : projection.status === "OK"
                      ? "On Target"
                      : "Over"}
                </Badge>
              )}
            </div>
          )}

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

          {/* ─── Lines Section (hidden for PER_EVENT — uses contractedMh directly) ─── */}
          {periodType !== "PER_EVENT" && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Allocation Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <i className="fa-solid fa-plus mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-2">
                {lines.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-end gap-2 rounded-md border border-border/50 bg-muted/20 p-2"
                  >
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Shift</span>
                      <Select
                        value={line.shiftId}
                        onValueChange={(v) => updateLine(line.key, "shiftId", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
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
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Day</span>
                      <Select
                        value={line.dayOfWeek}
                        onValueChange={(v) => updateLine(line.key, "dayOfWeek", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
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
                    <div className="w-20 space-y-1">
                      <span className="text-[10px] text-muted-foreground">MH *</span>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={line.allocatedMh}
                        onChange={(e) => updateLine(line.key, "allocatedMh", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="MH"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] text-muted-foreground">Label</span>
                      <Input
                        value={line.label}
                        onChange={(e) => updateLine(line.key, "label", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Optional"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.key)}
                      className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive"
                      disabled={lines.length <= 1}
                    >
                      <i className="fa-solid fa-xmark text-xs" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
            {isEdit ? "Save Changes" : "Create Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
