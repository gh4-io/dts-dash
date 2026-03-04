"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { CapacityShift } from "@/types";

// ─── Classification ────────────────────────────────────────────────────────

export type ShiftStatus = "active" | "expired" | "disabled";

/**
 * Classify a shift's status based on isActive and effectiveEndDate.
 * Exported for testing.
 */
export function classifyShift(shift: CapacityShift, today: string): ShiftStatus {
  if (!shift.isActive) return "disabled";
  if (shift.effectiveEndDate && shift.effectiveEndDate < today) return "expired";
  return "active";
}

export function classifyShifts(
  shifts: CapacityShift[],
  today: string,
): { active: CapacityShift[]; archived: CapacityShift[] } {
  const active: CapacityShift[] = [];
  const archived: CapacityShift[] = [];
  for (const s of shifts) {
    const status = classifyShift(s, today);
    if (status === "active") {
      active.push(s);
    } else {
      archived.push(s);
    }
  }
  return { active, archived };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface ShiftMatrixSectionProps {
  shifts: CapacityShift[];
  onUpdate: (shifts: CapacityShift[]) => void;
}

export function ShiftMatrixSection({ shifts, onUpdate }: ShiftMatrixSectionProps) {
  const today = new Date().toISOString().slice(0, 10);
  const { active, archived } = classifyShifts(shifts, today);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const patchEndDate = useCallback(
    async (shiftId: number, endDate: string | null) => {
      setSaving(shiftId);
      try {
        const res = await fetch(`/api/admin/capacity/shifts/${shiftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ effectiveEndDate: endDate }),
        });
        if (!res.ok) throw new Error("Failed to update");
        const updated: CapacityShift = await res.json();
        // Replace in the full shifts array
        onUpdate(shifts.map((s) => (s.id === updated.id ? updated : s)));
      } catch {
        // Silently fail — user sees no change
      } finally {
        setSaving(null);
      }
    },
    [shifts, onUpdate],
  );

  return (
    <section className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">
        <i className="fa-solid fa-clock mr-2 text-muted-foreground" />
        Shift Definitions
      </h2>
      <p className="text-xs text-muted-foreground">
        Active shift windows used by the capacity engine. Set an end date to retire a shift; it will
        move to the archive once expired.
      </p>

      {/* Active Shifts Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Code</th>
              <th className="pb-2 pr-3 font-medium">Name</th>
              <th className="pb-2 pr-3 font-medium">Hours</th>
              <th className="pb-2 pr-3 font-medium">Paid</th>
              <th className="pb-2 pr-3 font-medium">Min HC</th>
              <th className="pb-2 pr-3 font-medium">End Date</th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-muted-foreground text-xs">
                  No active shifts
                </td>
              </tr>
            ) : (
              active.map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-mono text-xs">{s.code}</td>
                  <td className="py-2 pr-3">{s.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {formatHour(s.startHour)}–{formatHour(s.endHour)}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{s.paidHours}h</td>
                  <td className="py-2 pr-3 text-muted-foreground">{s.minHeadcount}</td>
                  <td className="py-2 pr-3">
                    <EndDatePicker
                      shiftId={s.id}
                      value={s.effectiveEndDate}
                      saving={saving === s.id}
                      onChange={(d) => patchEndDate(s.id, d)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Archived Shifts (Collapsible) */}
      {archived.length > 0 && (
        <Collapsible open={archiveOpen} onOpenChange={setArchiveOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <i
                className={`fa-solid fa-chevron-right text-[10px] transition-transform ${archiveOpen ? "rotate-90" : ""}`}
              />
              Archive ({archived.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="overflow-x-auto opacity-70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Code</th>
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Hours</th>
                    <th className="pb-2 pr-3 font-medium">Paid</th>
                    <th className="pb-2 pr-3 font-medium">Min HC</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Ended</th>
                    <th className="pb-2 pr-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archived.map((s) => {
                    const status = classifyShift(s, today);
                    return (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-mono text-xs">{s.code}</td>
                        <td className="py-2 pr-3">{s.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {formatHour(s.startHour)}–{formatHour(s.endHour)}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{s.paidHours}h</td>
                        <td className="py-2 pr-3 text-muted-foreground">{s.minHeadcount}</td>
                        <td className="py-2 pr-3">
                          {status === "expired" ? (
                            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {s.effectiveEndDate ?? "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={saving === s.id}
                            onClick={() => patchEndDate(s.id, null)}
                          >
                            {saving === s.id ? (
                              <i className="fa-solid fa-spinner fa-spin mr-1" />
                            ) : (
                              <i className="fa-solid fa-rotate-left mr-1" />
                            )}
                            Reactivate
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}

// ─── End Date Picker ───────────────────────────────────────────────────────

interface EndDatePickerProps {
  shiftId: number;
  value: string | null;
  saving: boolean;
  onChange: (date: string | null) => void;
}

function EndDatePicker({ value, saving, onChange }: EndDatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs font-normal" disabled={saving}>
          {saving ? (
            <i className="fa-solid fa-spinner fa-spin mr-1" />
          ) : (
            <i className="fa-regular fa-calendar mr-1" />
          )}
          {value ?? "No end date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              const iso = day.toISOString().slice(0, 10);
              onChange(iso);
            }
            setOpen(false);
          }}
          initialFocus
        />
        {value && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <i className="fa-solid fa-xmark mr-1" />
              Clear end date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
