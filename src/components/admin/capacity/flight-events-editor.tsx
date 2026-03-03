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
import { Autocomplete } from "@/components/ui/autocomplete";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { FlightEvent, FlightEventStatus, FlightEventSource } from "@/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// ─── Component ──────────────────────────────────────────────────────────────

interface FlightEventEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: FlightEvent | null; // null = create mode
  onSave: (data: Omit<FlightEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>;
}

export function FlightEventEditor({ open, onOpenChange, event, onSave }: FlightEventEditorProps) {
  // ── Core fields ──
  const [aircraftReg, setAircraftReg] = useState("");
  const [aircraftType, setAircraftType] = useState("");
  const [customer, setCustomer] = useState("");
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [aircraftTypes, setAircraftTypes] = useState<{ id: number; normalizedType: string }[]>([]);
  const [status, setStatus] = useState<FlightEventStatus>("planned");
  const [source, setSource] = useState<FlightEventSource>("manual");

  // ── One-off fields ──
  const [scheduledArrival, setScheduledArrival] = useState("");
  const [actualArrival, setActualArrival] = useState("");
  const [scheduledDeparture, setScheduledDeparture] = useState("");
  const [actualDeparture, setActualDeparture] = useState("");
  const [arrivalWindowMinutes, setArrivalWindowMinutes] = useState("30");
  const [departureWindowMinutes, setDepartureWindowMinutes] = useState("60");

  // ── Recurring fields ──
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayPattern, setDayPattern] = useState("12345..");
  const [recurrenceStart, setRecurrenceStart] = useState("");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [arrivalTimeUtc, setArrivalTimeUtc] = useState("");
  const [departureTimeUtc, setDepartureTimeUtc] = useState("");
  const [suppressedDates, setSuppressedDates] = useState<string[]>([]);
  const [newSuppressDate, setNewSuppressDate] = useState("");

  // ── Advanced fields ──
  const [workPackageId, setWorkPackageId] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const isAircraftRequired = !isRecurring && status !== "planned";

  // ── Autocomplete options ──
  const customerOptions = customers.map((c) => ({ value: c.name }));
  const aircraftTypeOptions = aircraftTypes.map((t) => ({ value: t.normalizedType }));

  // ── Load customers + aircraft types ──
  useEffect(() => {
    if (open && customers.length === 0) {
      fetch("/api/admin/customers")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setCustomers(data);
        })
        .catch(() => {});
    }
    if (open && aircraftTypes.length === 0) {
      fetch("/api/admin/aircraft-types")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setAircraftTypes(data);
        })
        .catch(() => {});
    }
  }, [open, customers.length, aircraftTypes.length]);

  // ── Load from event on open ──
  useEffect(() => {
    if (open) {
      if (event) {
        setAircraftReg(event.aircraftReg ?? "");
        setAircraftType(event.aircraftType ?? "");
        setCustomer(event.customer);
        setStatus(event.status);
        setSource(event.source);
        setScheduledArrival(toLocalValue(event.scheduledArrival));
        setActualArrival(toLocalValue(event.actualArrival));
        setScheduledDeparture(toLocalValue(event.scheduledDeparture));
        setActualDeparture(toLocalValue(event.actualDeparture));
        setArrivalWindowMinutes(String(event.arrivalWindowMinutes));
        setDepartureWindowMinutes(String(event.departureWindowMinutes));
        setIsRecurring(event.isRecurring ?? false);
        setDayPattern(event.dayPattern ?? "12345..");
        setRecurrenceStart(event.recurrenceStart ?? "");
        setRecurrenceEnd(event.recurrenceEnd ?? "");
        setArrivalTimeUtc(event.arrivalTimeUtc ?? "");
        setDepartureTimeUtc(event.departureTimeUtc ?? "");
        setSuppressedDates(event.suppressedDates ?? []);
        setWorkPackageId(event.workPackageId != null ? String(event.workPackageId) : "");
        setNotes(event.notes ?? "");
        setIsActive(event.isActive);
        // Expand "More options" if advanced fields have data
        setMoreOpen(
          !!(
            event.workPackageId ||
            event.notes ||
            !event.isActive ||
            (event.suppressedDates ?? []).length > 0
          ),
        );
      } else {
        setAircraftReg("");
        setAircraftType("");
        setCustomer("");
        setStatus("planned");
        setSource("manual");
        setScheduledArrival("");
        setActualArrival("");
        setScheduledDeparture("");
        setActualDeparture("");
        setArrivalWindowMinutes("30");
        setDepartureWindowMinutes("60");
        setIsRecurring(false);
        setDayPattern("12345..");
        setRecurrenceStart("");
        setRecurrenceEnd("");
        setArrivalTimeUtc("");
        setDepartureTimeUtc("");
        setSuppressedDates([]);
        setNewSuppressDate("");
        setWorkPackageId("");
        setNotes("");
        setIsActive(true);
        setMoreOpen(false);
      }
      setError(null);
    }
  }, [open, event]);

  // ── Validation + save ──
  const handleSave = async () => {
    setError(null);

    if (!customer.trim()) {
      setError("Customer is required");
      return;
    }

    if (isRecurring) {
      if (!recurrenceStart || !recurrenceEnd) {
        setError("Date range is required for recurring schedules");
        return;
      }
      if (recurrenceEnd < recurrenceStart) {
        setError("End date must be on or after start date");
        return;
      }
      if (dayPattern.replace(/\./g, "").length === 0) {
        setError("Select at least one operating day");
        return;
      }
      if (!arrivalTimeUtc && !departureTimeUtc) {
        setError("At least one time (arrival or departure) is required");
        return;
      }
    } else {
      if (isAircraftRequired && !aircraftReg.trim()) {
        setError("Aircraft Reg / Flight No. is required");
        return;
      }
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
        aircraftReg: aircraftReg.trim() || null,
        aircraftType: aircraftType.trim() || null,
        customer: customer.trim(),
        status,
        source,
        scheduledArrival: isRecurring ? null : fromLocalValue(scheduledArrival),
        actualArrival: isRecurring ? null : fromLocalValue(actualArrival),
        scheduledDeparture: isRecurring ? null : fromLocalValue(scheduledDeparture),
        actualDeparture: isRecurring ? null : fromLocalValue(actualDeparture),
        arrivalWindowMinutes: arrWin,
        departureWindowMinutes: depWin,
        notes: notes.trim() || null,
        isActive,
        isRecurring,
        dayPattern: isRecurring ? dayPattern : null,
        recurrenceStart: isRecurring ? recurrenceStart || null : null,
        recurrenceEnd: isRecurring ? recurrenceEnd || null : null,
        arrivalTimeUtc: isRecurring ? arrivalTimeUtc || null : null,
        departureTimeUtc: isRecurring ? departureTimeUtc || null : null,
        suppressedDates: isRecurring ? suppressedDates : [],
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {isEdit ? "Edit Flight Event" : "Add Flight Event"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Update the flight event details."
              : "Create a new flight event to track an aircraft arrival/departure."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <div className="rounded bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* ── Row 1: Aircraft + Customer ── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="aircraftReg" className="text-xs">
                Aircraft / Flight No.{isAircraftRequired ? " *" : ""}
              </Label>
              <Input
                id="aircraftReg"
                value={aircraftReg}
                onChange={(e) => setAircraftReg(e.target.value)}
                placeholder={isRecurring ? "e.g., 107" : "e.g., N12345"}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer *</Label>
              <Autocomplete
                value={customer}
                onChange={setCustomer}
                options={customerOptions}
                placeholder="Type or select customer…"
                inputClassName="font-normal"
              />
            </div>
          </div>

          {/* ── Row 2: Status + Source ── */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">
                Status
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as FlightEventStatus)}>
                <SelectTrigger id="status" className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned" className="text-xs">
                    Planned
                  </SelectItem>
                  <SelectItem value="scheduled" className="text-xs">
                    Scheduled
                  </SelectItem>
                  <SelectItem value="actual" className="text-xs">
                    Actual
                  </SelectItem>
                  <SelectItem value="cancelled" className="text-xs">
                    Cancelled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="source" className="text-xs">
                Source
              </Label>
              <Select value={source} onValueChange={(v) => setSource(v as FlightEventSource)}>
                <SelectTrigger id="source" className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual" className="text-xs">
                    Manual
                  </SelectItem>
                  <SelectItem value="work_package" className="text-xs">
                    Work Package
                  </SelectItem>
                  <SelectItem value="import" className="text-xs">
                    Import
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Row 3: Aircraft Type ── */}
          <div className="space-y-1">
            <Label className="text-xs">Aircraft Type</Label>
            <Autocomplete
              value={aircraftType}
              onChange={setAircraftType}
              options={aircraftTypeOptions}
              placeholder="e.g., B737, A320"
              inputClassName="font-mono"
            />
          </div>

          {/* ── Recurring toggle ── */}
          <div className="flex items-center gap-2 rounded border border-border/50 bg-muted/30 px-2.5 py-1.5">
            <Checkbox
              id="isRecurring"
              checked={isRecurring}
              onCheckedChange={(v) => setIsRecurring(!!v)}
            />
            <Label htmlFor="isRecurring" className="text-xs font-normal cursor-pointer">
              Recurring schedule
            </Label>
            {isRecurring && (
              <span className="ml-auto text-[10px] text-amber-500 font-medium">
                <i className="fa-solid fa-rotate mr-1" />
                TEMPLATE
              </span>
            )}
          </div>

          {/* ── Recurring fields ── */}
          {isRecurring ? (
            <div className="space-y-2.5 rounded border border-amber-500/20 bg-amber-500/[0.03] p-2.5">
              {/* Day pattern checkboxes */}
              <div className="space-y-1">
                <Label className="text-xs">Operating Days *</Label>
                <div className="flex gap-1">
                  {DAY_LABELS.map((day, i) => {
                    const active = dayPattern[i] !== ".";
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const chars = dayPattern.split("");
                          chars[i] = active ? "." : String(i + 1);
                          setDayPattern(chars.join(""));
                        }}
                        className={`
                          flex-1 rounded border py-1 text-[10px] font-medium transition-colors
                          ${
                            active
                              ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                              : "border-border/50 bg-background text-muted-foreground hover:border-border"
                          }
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="recurrenceStart" className="text-xs">
                    Effective From *
                  </Label>
                  <Input
                    id="recurrenceStart"
                    type="date"
                    value={recurrenceStart}
                    onChange={(e) => setRecurrenceStart(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="recurrenceEnd" className="text-xs">
                    Effective To *
                  </Label>
                  <Input
                    id="recurrenceEnd"
                    type="date"
                    value={recurrenceEnd}
                    onChange={(e) => setRecurrenceEnd(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              {/* UTC times */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="arrivalTimeUtc" className="text-xs">
                    Arrival Time (UTC)
                  </Label>
                  <Input
                    id="arrivalTimeUtc"
                    type="time"
                    value={arrivalTimeUtc}
                    onChange={(e) => setArrivalTimeUtc(e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="departureTimeUtc" className="text-xs">
                    Departure Time (UTC)
                  </Label>
                  <Input
                    id="departureTimeUtc"
                    type="time"
                    value={departureTimeUtc}
                    onChange={(e) => setDepartureTimeUtc(e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                If departure is earlier than arrival (UTC), it will be placed on the following day.
              </p>
            </div>
          ) : (
            /* ── One-off datetime fields ── */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="scheduledArrival" className="text-xs">
                    Scheduled Arrival
                  </Label>
                  <Input
                    id="scheduledArrival"
                    type="datetime-local"
                    value={scheduledArrival}
                    onChange={(e) => setScheduledArrival(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="scheduledDeparture" className="text-xs">
                    Scheduled Departure
                  </Label>
                  <Input
                    id="scheduledDeparture"
                    type="datetime-local"
                    value={scheduledDeparture}
                    onChange={(e) => setScheduledDeparture(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="actualArrival" className="text-xs">
                    Actual Arrival
                  </Label>
                  <Input
                    id="actualArrival"
                    type="datetime-local"
                    value={actualArrival}
                    onChange={(e) => setActualArrival(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="actualDeparture" className="text-xs">
                    Actual Departure
                  </Label>
                  <Input
                    id="actualDeparture"
                    type="datetime-local"
                    value={actualDeparture}
                    onChange={(e) => setActualDeparture(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── More options (collapsible) ── */}
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <i
                className={`fa-solid fa-chevron-right text-[9px] transition-transform ${moreOpen ? "rotate-90" : ""}`}
              />
              <span>More options</span>
              {(!isActive || workPackageId || notes || suppressedDates.length > 0) && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2.5">
              {/* Coverage windows — one-off only */}
              {!isRecurring && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="arrivalWindow" className="text-xs">
                      Arrival Window (min)
                    </Label>
                    <Input
                      id="arrivalWindow"
                      type="number"
                      min="0"
                      value={arrivalWindowMinutes}
                      onChange={(e) => setArrivalWindowMinutes(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Coverage after arrival</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="departureWindow" className="text-xs">
                      Departure Window (min)
                    </Label>
                    <Input
                      id="departureWindow"
                      type="number"
                      min="0"
                      value={departureWindowMinutes}
                      onChange={(e) => setDepartureWindowMinutes(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Coverage before departure</p>
                  </div>
                </div>
              )}

              {/* WP ID */}
              <div className="space-y-1">
                <Label htmlFor="workPackageId" className="text-xs">
                  Work Package ID
                </Label>
                <Input
                  id="workPackageId"
                  type="number"
                  min="0"
                  value={workPackageId}
                  onChange={(e) => setWorkPackageId(e.target.value)}
                  placeholder="Optional"
                  className="h-7 text-xs"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Heavy maintenance check — extended ground time"
                  rows={2}
                  className="text-xs min-h-[3rem]"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                />
                <Label htmlFor="isActive" className="text-xs font-normal">
                  Active
                </Label>
              </div>

              {/* Exception dates — recurring only */}
              {isRecurring && (
                <div className="space-y-1.5 rounded border border-border/50 bg-muted/20 p-2">
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-calendar-xmark text-[10px] text-muted-foreground" />
                    <span className="text-xs font-medium">Exception Dates</span>
                    {suppressedDates.length > 0 && (
                      <span className="bg-amber-500/20 text-amber-500 rounded px-1 text-[10px] font-medium">
                        {suppressedDates.length}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Dates when this schedule does not operate (holidays, cancellations).
                  </p>

                  {suppressedDates.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {suppressedDates.map((d) => (
                        <span
                          key={d}
                          className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5 text-[10px] font-mono"
                        >
                          {d}
                          <button
                            type="button"
                            onClick={() =>
                              setSuppressedDates((prev) => prev.filter((x) => x !== d))
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <i className="fa-solid fa-xmark text-[8px]" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    <Input
                      type="date"
                      value={newSuppressDate}
                      onChange={(e) => setNewSuppressDate(e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        if (newSuppressDate && !suppressedDates.includes(newSuppressDate)) {
                          setSuppressedDates((prev) => [...prev, newSuppressDate].sort());
                          setNewSuppressDate("");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
            {saving && <i className="fa-solid fa-spinner fa-spin mr-1" />}
            {isEdit ? "Save Changes" : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
