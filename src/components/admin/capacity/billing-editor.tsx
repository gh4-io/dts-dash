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
import type { BillingEntry } from "@/types";

const SHIFTS = [
  { value: "DAY", label: "Day (07-15)" },
  { value: "SWING", label: "Swing (15-23)" },
  { value: "NIGHT", label: "Night (23-07)" },
];

const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "import", label: "Import" },
];

interface BillingEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: BillingEntry | null; // null = create mode
  onSave: (data: Omit<BillingEntry, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

export function BillingEditor({ open, onOpenChange, entry, onSave }: BillingEditorProps) {
  const [aircraftReg, setAircraftReg] = useState("");
  const [customer, setCustomer] = useState("");
  const [billingDate, setBillingDate] = useState("");
  const [shiftCode, setShiftCode] = useState("DAY");
  const [description, setDescription] = useState("");
  const [billedMh, setBilledMh] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [workPackageId, setWorkPackageId] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("manual");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (entry) {
        setAircraftReg(entry.aircraftReg);
        setCustomer(entry.customer);
        setBillingDate(entry.billingDate);
        setShiftCode(entry.shiftCode);
        setDescription(entry.description ?? "");
        setBilledMh(String(entry.billedMh));
        setInvoiceRef(entry.invoiceRef ?? "");
        setWorkPackageId(entry.workPackageId != null ? String(entry.workPackageId) : "");
        setNotes(entry.notes ?? "");
        setSource(entry.source);
        setIsActive(entry.isActive);
      } else {
        setAircraftReg("");
        setCustomer("");
        setBillingDate(new Date().toISOString().slice(0, 10));
        setShiftCode("DAY");
        setDescription("");
        setBilledMh("");
        setInvoiceRef("");
        setWorkPackageId("");
        setNotes("");
        setSource("manual");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, entry]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        workPackageId: workPackageId ? Number(workPackageId) : null,
        aircraftReg: aircraftReg.trim(),
        customer: customer.trim(),
        billingDate,
        shiftCode,
        description: description.trim() || null,
        billedMh: Number(billedMh),
        invoiceRef: invoiceRef.trim() || null,
        notes: notes.trim() || null,
        source: source as BillingEntry["source"],
        isActive,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isValid =
    aircraftReg.trim() &&
    customer.trim() &&
    billingDate &&
    shiftCode &&
    billedMh &&
    Number(billedMh) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Billing Entry" : "Add Billing Entry"}</DialogTitle>
          <DialogDescription>
            {entry
              ? "Update the billing entry details."
              : "Record billed man-hours for a customer."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="aircraftReg">Aircraft Reg *</Label>
              <Input
                id="aircraftReg"
                value={aircraftReg}
                onChange={(e) => setAircraftReg(e.target.value)}
                placeholder="N12345"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer">Customer *</Label>
              <Input
                id="customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="DHL Air UK"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="billingDate">Date *</Label>
              <Input
                id="billingDate"
                type="date"
                value={billingDate}
                onChange={(e) => setBillingDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Shift *</Label>
              <Select value={shiftCode} onValueChange={setShiftCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="billedMh">Billed MH *</Label>
              <Input
                id="billedMh"
                type="number"
                step="0.1"
                min="0.1"
                value={billedMh}
                onChange={(e) => setBilledMh(e.target.value)}
                placeholder="2.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceRef">Invoice Ref</Label>
              <Input
                id="invoiceRef"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="INV-2026-001"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Routine check billing"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="workPackageId">WP ID</Label>
              <Input
                id="workPackageId"
                type="number"
                value={workPackageId}
                onChange={(e) => setWorkPackageId(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="isActive" checked={isActive} onCheckedChange={(v) => setIsActive(!!v)} />
            <Label htmlFor="isActive" className="cursor-pointer">
              Active
            </Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-1.5" />
                Saving...
              </>
            ) : entry ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
