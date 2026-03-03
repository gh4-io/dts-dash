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
import type { TimeBooking } from "@/types";

const TASK_TYPES = [
  { value: "routine", label: "Routine" },
  { value: "non_routine", label: "Non-Routine" },
  { value: "aog", label: "AOG" },
  { value: "training", label: "Training" },
  { value: "admin", label: "Admin" },
];

const SHIFTS = [
  { value: "DAY", label: "Day (07-15)" },
  { value: "SWING", label: "Swing (15-23)" },
  { value: "NIGHT", label: "Night (23-07)" },
];

const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "import", label: "Import" },
];

interface TimeBookingEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: TimeBooking | null; // null = create mode
  onSave: (data: Omit<TimeBooking, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

export function TimeBookingEditor({ open, onOpenChange, booking, onSave }: TimeBookingEditorProps) {
  const [aircraftReg, setAircraftReg] = useState("");
  const [customer, setCustomer] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [shiftCode, setShiftCode] = useState("DAY");
  const [taskName, setTaskName] = useState("");
  const [taskType, setTaskType] = useState("routine");
  const [workedMh, setWorkedMh] = useState("");
  const [technicianCount, setTechnicianCount] = useState("");
  const [workPackageId, setWorkPackageId] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("manual");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (booking) {
        setAircraftReg(booking.aircraftReg);
        setCustomer(booking.customer);
        setBookingDate(booking.bookingDate);
        setShiftCode(booking.shiftCode);
        setTaskName(booking.taskName ?? "");
        setTaskType(booking.taskType);
        setWorkedMh(String(booking.workedMh));
        setTechnicianCount(booking.technicianCount != null ? String(booking.technicianCount) : "");
        setWorkPackageId(booking.workPackageId != null ? String(booking.workPackageId) : "");
        setNotes(booking.notes ?? "");
        setSource(booking.source);
        setIsActive(booking.isActive);
      } else {
        setAircraftReg("");
        setCustomer("");
        setBookingDate(new Date().toISOString().slice(0, 10));
        setShiftCode("DAY");
        setTaskName("");
        setTaskType("routine");
        setWorkedMh("");
        setTechnicianCount("");
        setWorkPackageId("");
        setNotes("");
        setSource("manual");
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, booking]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSave({
        workPackageId: workPackageId ? Number(workPackageId) : null,
        aircraftReg: aircraftReg.trim(),
        customer: customer.trim(),
        bookingDate,
        shiftCode,
        taskName: taskName.trim() || null,
        taskType: taskType as TimeBooking["taskType"],
        workedMh: Number(workedMh),
        technicianCount: technicianCount ? Number(technicianCount) : null,
        notes: notes.trim() || null,
        source: source as TimeBooking["source"],
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
    bookingDate &&
    shiftCode &&
    workedMh &&
    Number(workedMh) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{booking ? "Edit Time Booking" : "Add Time Booking"}</DialogTitle>
          <DialogDescription>
            {booking ? "Update the time booking details." : "Record actual man-hours for a task."}
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
              <Label htmlFor="bookingDate">Date *</Label>
              <Input
                id="bookingDate"
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
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
              <Label htmlFor="workedMh">Worked MH *</Label>
              <Input
                id="workedMh"
                type="number"
                step="0.1"
                min="0.1"
                value={workedMh}
                onChange={(e) => setWorkedMh(e.target.value)}
                placeholder="2.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Task Type</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="taskName">Task Name</Label>
            <Input
              id="taskName"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Main gear strut inspection"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="technicianCount">Technicians</Label>
              <Input
                id="technicianCount"
                type="number"
                min="0"
                step="1"
                value={technicianCount}
                onChange={(e) => setTechnicianCount(e.target.value)}
                placeholder="Optional"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(v) => setIsActive(!!v)}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
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
            ) : booking ? (
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
