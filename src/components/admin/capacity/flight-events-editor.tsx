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
import type { FlightEvent, FlightEventStatus, FlightEventSource } from "@/types";

/** Strip seconds from ISO datetime for datetime-local input: "2026-02-20T14:00" */
function toLocalValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

/** Append seconds + Z for storage: "2026-02-20T14:00" → "2026-02-20T14:00:00.000Z" */
function fromLocalValue(val: string): string | null {
  if (!val) return null;
  return val + ":00.000Z";
}

interface FlightEventEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: FlightEvent | null; // null = create mode
  onSave: (data: Omit<FlightEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

export function FlightEventEditor({ open, onOpenChange, event, onSave }: FlightEventEditorProps) {
  const [aircraftReg, setAircraftReg] = useState("");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState<FlightEventStatus>("scheduled");
  const [source, setSource] = useState<FlightEventSource>("manual");
  const [scheduledArrival, setScheduledArrival] = useState("");
  const [actualArrival, setActualArrival] = useState("");
  const [scheduledDeparture, setScheduledDeparture] = useState("");
  const [actualDeparture, setActualDeparture] = useState("");
  const [arrivalWindowMinutes, setArrivalWindowMinutes] = useState("30");
  const [departureWindowMinutes, setDepartureWindowMinutes] = useState("60");
  const [workPackageId, setWorkPackageId] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (event) {
        setAircraftReg(event.aircraftReg);
        setCustomer(event.customer);
        setStatus(event.status);
        setSource(event.source);
        setScheduledArrival(toLocalValue(event.scheduledArrival));
        setActualArrival(toLocalValue(event.actualArrival));
        setScheduledDeparture(toLocalValue(event.scheduledDeparture));
        setActualDeparture(toLocalValue(event.actualDeparture));
        setArrivalWindowMinutes(String(event.arrivalWindowMinutes));
        setDepartureWindowMinutes(String(event.departureWindowMinutes));
        setWorkPackageId(event.workPackageId != null ? String(event.workPackageId) : "");
        setNotes(event.notes ?? "");
        setIsActive(event.isActive);
      } else {
        setAircraftReg("");
        setCustomer("");
        setStatus("scheduled");
        setSource("manual");
        setScheduledArrival("");
        setActualArrival("");
        setScheduledDeparture("");
        setActualDeparture("");
        setArrivalWindowMinutes("30");
        setDepartureWindowMinutes("60");
        setWorkPackageId("");
        setNotes("");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, event]);

  const handleSave = async () => {
    setError(null);

    if (!aircraftReg.trim()) {
      setError("Aircraft registration is required");
      return;
    }
    if (!customer.trim()) {
      setError("Customer is required");
      return;
    }

    const arrWin = parseInt(arrivalWindowMinutes, 10);
    const depWin = parseInt(departureWindowMinutes, 10);
    if (isNaN(arrWin) || arrWin < 0) {
      setError("Arrival window must be a non-negative number");
      return;
    }
    if (isNaN(depWin) || depWin < 0) {
      setError("Departure window must be a non-negative number");
      return;
    }

    const wpId = workPackageId.trim() ? parseInt(workPackageId, 10) : null;
    if (workPackageId.trim() && (isNaN(wpId!) || wpId! < 0)) {
      setError("Work Package ID must be a positive number");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        workPackageId: wpId,
        aircraftReg: aircraftReg.trim(),
        customer: customer.trim(),
        status,
        source,
        scheduledArrival: fromLocalValue(scheduledArrival),
        actualArrival: fromLocalValue(actualArrival),
        scheduledDeparture: fromLocalValue(scheduledDeparture),
        actualDeparture: fromLocalValue(actualDeparture),
        arrivalWindowMinutes: arrWin,
        departureWindowMinutes: depWin,
        notes: notes.trim() || null,
        isActive,
      });
    } catch {
      // Error displayed by parent showMessage
    } finally {
      setSaving(false);
    }
  };

  const isEdit = event !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Flight Event" : "Add Flight Event"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the flight event details."
              : "Create a new flight event to track an aircraft arrival/departure."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aircraftReg">Aircraft Reg *</Label>
              <Input
                id="aircraftReg"
                value={aircraftReg}
                onChange={(e) => setAircraftReg(e.target.value)}
                placeholder="e.g., N12345"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Input
                id="customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g., DHL"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as FlightEventStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="actual">Actual</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as FlightEventSource)}>
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="work_package">Work Package</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledArrival">Scheduled Arrival</Label>
              <Input
                id="scheduledArrival"
                type="datetime-local"
                value={scheduledArrival}
                onChange={(e) => setScheduledArrival(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualArrival">Actual Arrival</Label>
              <Input
                id="actualArrival"
                type="datetime-local"
                value={actualArrival}
                onChange={(e) => setActualArrival(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDeparture">Scheduled Departure</Label>
              <Input
                id="scheduledDeparture"
                type="datetime-local"
                value={scheduledDeparture}
                onChange={(e) => setScheduledDeparture(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualDeparture">Actual Departure</Label>
              <Input
                id="actualDeparture"
                type="datetime-local"
                value={actualDeparture}
                onChange={(e) => setActualDeparture(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="arrivalWindow">Arrival Window (min)</Label>
              <Input
                id="arrivalWindow"
                type="number"
                min="0"
                value={arrivalWindowMinutes}
                onChange={(e) => setArrivalWindowMinutes(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Coverage after arrival</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="departureWindow">Departure Window (min)</Label>
              <Input
                id="departureWindow"
                type="number"
                min="0"
                value={departureWindowMinutes}
                onChange={(e) => setDepartureWindowMinutes(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Coverage before departure</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workPackageId">Work Package ID</Label>
            <Input
              id="workPackageId"
              type="number"
              min="0"
              value={workPackageId}
              onChange={(e) => setWorkPackageId(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Heavy maintenance check — extended ground time"
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
            {isEdit ? "Save Changes" : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
