"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RotationDots } from "./rotation-dots";
import type { StaffingShift, StaffingShiftCategory, RotationPattern } from "@/types";

const MAX_NAME_LEN = 32;

const CATEGORY_META: Record<
  StaffingShiftCategory,
  { label: string; icon: string; color: string; border: string; bg: string }
> = {
  DAY: {
    label: "Day Shifts",
    icon: "fa-sun",
    color: "text-amber-500",
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
  },
  SWING: {
    label: "Swing Shifts",
    icon: "fa-cloud-sun",
    color: "text-orange-500",
    border: "border-l-orange-500",
    bg: "bg-orange-500/5",
  },
  NIGHT: {
    label: "Night Shifts",
    icon: "fa-moon",
    color: "text-indigo-400",
    border: "border-l-indigo-400",
    bg: "bg-indigo-400/5",
  },
  OTHER: {
    label: "Other",
    icon: "fa-asterisk",
    color: "text-muted-foreground",
    border: "border-l-muted-foreground",
    bg: "bg-muted/30",
  },
};

const CATEGORY_DOT_COLOR: Record<StaffingShiftCategory, string> = {
  DAY: "bg-amber-500",
  SWING: "bg-orange-500",
  NIGHT: "bg-indigo-400",
  OTHER: "bg-muted-foreground",
};

const CATEGORY_ORDER: StaffingShiftCategory[] = ["DAY", "SWING", "NIGHT", "OTHER"];

function fmtTime(h: number, m: number) {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Create a Date set to the given hour:minute (today). */
function toTimeDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

interface ShiftFormData {
  name: string;
  description: string;
  category: StaffingShiftCategory;
  rotationId: string;
  rotationStartDate: string;
  startTime: Date | null;
  endTime: Date | null;
  breakMinutes: string;
  lunchMinutes: string;
  mhOverride: string;
}

const emptyForm: ShiftFormData = {
  name: "",
  description: "",
  category: "DAY",
  rotationId: "",
  rotationStartDate: new Date().toISOString().split("T")[0],
  startTime: toTimeDate(7, 0),
  endTime: toTimeDate(15, 0),
  breakMinutes: "0",
  lunchMinutes: "0",
  mhOverride: "",
};

interface ShiftDefinitionsGridProps {
  configId: number;
  shifts: StaffingShift[];
  patterns: RotationPattern[];
  onRefresh: () => void;
}

export function ShiftDefinitionsGrid({
  configId,
  shifts,
  patterns,
  onRefresh,
}: ShiftDefinitionsGridProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StaffingShift | null>(null);
  const [form, setForm] = useState<ShiftFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffingShift | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<StaffingShiftCategory>>(
    new Set(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // --- Pending headcount cache (auto-save on blur, warn on leave) ---
  const [pendingHeadcounts, setPendingHeadcounts] = useState<Map<number, number>>(new Map());
  const [savingHeadcounts, setSavingHeadcounts] = useState(false);
  const pendingRef = useRef(pendingHeadcounts);
  pendingRef.current = pendingHeadcounts;

  const hasPendingChanges = pendingHeadcounts.size > 0;

  // beforeunload warning
  useEffect(() => {
    if (!hasPendingChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasPendingChanges]);

  const handleHeadcountBlur = useCallback(
    (shiftId: number, value: string) => {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 0) return;
      const original = shifts.find((s) => s.id === shiftId);
      if (original && original.headcount === n) {
        // Value unchanged — remove from pending if present
        setPendingHeadcounts((prev) => {
          const next = new Map(prev);
          next.delete(shiftId);
          return next;
        });
        return;
      }
      setPendingHeadcounts((prev) => {
        const next = new Map(prev);
        next.set(shiftId, n);
        return next;
      });
    },
    [shifts],
  );

  const saveAllPendingHeadcounts = useCallback(async () => {
    if (pendingRef.current.size === 0) return;
    setSavingHeadcounts(true);
    try {
      const entries = [...pendingRef.current.entries()];
      await Promise.all(
        entries.map(([id, headcount]) =>
          fetch(`/api/admin/capacity/staffing-shifts/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headcount }),
          }),
        ),
      );
      setPendingHeadcounts(new Map());
      onRefresh();
    } finally {
      setSavingHeadcounts(false);
    }
  }, [onRefresh]);

  // Group shifts by category
  const grouped: Record<StaffingShiftCategory, StaffingShift[]> = {
    DAY: [],
    SWING: [],
    NIGHT: [],
    OTHER: [],
  };
  for (const s of shifts) {
    grouped[s.category]?.push(s);
  }

  const patternMap = new Map(patterns.map((p) => [p.id, p]));

  const openCreate = () => {
    setEditingShift(null);
    setForm(emptyForm);
    setError(null);
    setEditDialogOpen(true);
  };

  const openEdit = (s: StaffingShift) => {
    setEditingShift(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      category: s.category,
      rotationId: s.rotationId.toString(),
      rotationStartDate: s.rotationStartDate,
      startTime: toTimeDate(s.startHour, s.startMinute),
      endTime: toTimeDate(s.endHour, s.endMinute),
      breakMinutes: s.breakMinutes.toString(),
      lunchMinutes: s.lunchMinutes.toString(),
      mhOverride: s.mhOverride?.toString() ?? "",
    });
    setError(null);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmed = form.name.trim();
    if (!trimmed) {
      setError("Name required");
      return;
    }
    if (trimmed.length > MAX_NAME_LEN) {
      setError(`Name must be ${MAX_NAME_LEN} characters or less`);
      return;
    }
    if (!form.startTime || !form.endTime) {
      setError("Start and end times are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        configId,
        name: trimmed,
        description: form.description.trim() || null,
        category: form.category,
        rotationId: parseInt(form.rotationId, 10),
        rotationStartDate: form.rotationStartDate,
        startHour: form.startTime.getHours(),
        startMinute: form.startTime.getMinutes(),
        endHour: form.endTime.getHours(),
        endMinute: form.endTime.getMinutes(),
        breakMinutes: parseInt(form.breakMinutes, 10) || 0,
        lunchMinutes: parseInt(form.lunchMinutes, 10) || 0,
        mhOverride: form.mhOverride ? parseFloat(form.mhOverride) : null,
      };

      // When creating, default headcount to 0 (user adjusts on the bar after creation)
      if (!editingShift) {
        payload.headcount = 0;
      }

      if (editingShift) {
        const res = await fetch(`/api/admin/capacity/staffing-shifts/${editingShift.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch("/api/admin/capacity/staffing-shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      setEditDialogOpen(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: StaffingShift) => {
    await fetch(`/api/admin/capacity/staffing-shifts/${s.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    onRefresh();
  };

  const handleToggleActive = useCallback(
    async (s: StaffingShift) => {
      await fetch(`/api/admin/capacity/staffing-shifts/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      onRefresh();
    },
    [onRefresh],
  );

  const handleBulkAction = async (action: "activate" | "deactivate" | "delete") => {
    if (selectedIds.size === 0) return;
    await fetch("/api/admin/capacity/staffing-shifts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: [...selectedIds] }),
    });
    setSelectedIds(new Set());
    onRefresh();
  };

  const toggleCollapse = (cat: StaffingShiftCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const getEffectiveHeadcount = (s: StaffingShift) =>
    pendingHeadcounts.has(s.id) ? pendingHeadcounts.get(s.id)! : s.headcount;

  const totalHeadcount = shifts
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + getEffectiveHeadcount(s), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-layer-group text-xs text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shift Definitions
          </h3>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {shifts.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {hasPendingChanges && (
            <Button
              variant="default"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={saveAllPendingHeadcounts}
              disabled={savingHeadcounts}
            >
              {savingHeadcounts && <i className="fa-solid fa-spinner fa-spin mr-1" />}
              <i className="fa-solid fa-floppy-disk mr-1" />
              Save ({pendingHeadcounts.size})
            </Button>
          )}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1 mr-1">
              <span className="text-[10px] text-muted-foreground">{selectedIds.size} sel.</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => handleBulkAction("activate")}
              >
                Activate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => handleBulkAction("deactivate")}
              >
                Hide
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-destructive"
                onClick={() => handleBulkAction("delete")}
              >
                Del
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => setSelectedIds(new Set())}
              >
                <i className="fa-solid fa-xmark" />
              </Button>
            </div>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={openCreate}>
            <i className="fa-solid fa-plus mr-1" />
            Add Shift
          </Button>
        </div>
      </div>

      {/* Shift categories */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <i className="fa-solid fa-layer-group text-3xl mb-3 opacity-30" />
            <p className="text-sm">No shifts defined</p>
            <p className="text-xs mt-1">Add shifts to build your staffing matrix</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              <i className="fa-solid fa-plus mr-1.5" />
              Add First Shift
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {CATEGORY_ORDER.map((cat) => {
              const catShifts = grouped[cat];
              if (catShifts.length === 0) return null;

              const meta = CATEGORY_META[cat];
              const isCollapsed = collapsedCategories.has(cat);
              const catHeadcount = catShifts
                .filter((s) => s.isActive)
                .reduce((sum, s) => sum + getEffectiveHeadcount(s), 0);

              return (
                <div key={cat}>
                  {/* Category header */}
                  <button
                    type="button"
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent/30 ${meta.bg}`}
                    onClick={() => toggleCollapse(cat)}
                  >
                    <i
                      className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-down"} text-[8px] text-muted-foreground w-3`}
                    />
                    <i className={`fa-solid ${meta.icon} ${meta.color}`} />
                    <span className={meta.color}>{meta.label}</span>
                    <span className="text-muted-foreground font-normal">
                      {catShifts.length} shift{catShifts.length !== 1 ? "s" : ""}
                    </span>
                    <span className="ml-auto text-muted-foreground font-normal">
                      {catHeadcount} AMTs
                    </span>
                  </button>

                  {/* Shift bars */}
                  {!isCollapsed && (
                    <div className="px-2 py-1 space-y-1">
                      {catShifts.map((s) => {
                        const rotation = patternMap.get(s.rotationId);
                        const isOrphaned = s.rotationId === 0 || (!rotation && s.rotationId > 0);
                        const isSelected = selectedIds.has(s.id);
                        const displayHC = getEffectiveHeadcount(s);
                        const isPending = pendingHeadcounts.has(s.id);

                        return (
                          <div
                            key={s.id}
                            className={`group rounded-lg border transition-all ${
                              s.isActive
                                ? `border-border hover:border-primary/40 ${meta.bg}`
                                : "border-border/50 opacity-40"
                            } ${isSelected ? "border-primary bg-primary/5" : ""} ${
                              isOrphaned ? "border-destructive/40" : ""
                            } border-l-[3px] ${meta.border}`}
                          >
                            <div className="flex items-center gap-3 px-3 py-2">
                              {/* Select checkbox */}
                              <button
                                type="button"
                                className={`w-3.5 h-3.5 rounded border transition-colors flex-shrink-0 ${
                                  isSelected
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground/30 hover:border-muted-foreground/60"
                                }`}
                                onClick={() => toggleSelect(s.id)}
                              >
                                {isSelected && (
                                  <i className="fa-solid fa-check text-[7px] text-primary-foreground block text-center leading-[14px]" />
                                )}
                              </button>

                              {/* Name + time */}
                              <div className="w-28 flex-shrink-0 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-semibold truncate block">
                                    {s.name}
                                  </span>
                                  {isOrphaned && (
                                    <TooltipProvider delayDuration={0}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <i className="fa-solid fa-triangle-exclamation text-[9px] text-destructive flex-shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent className="text-[10px] max-w-48 text-destructive">
                                          Rotation pattern was deleted. Assign a new rotation.
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {fmtTime(s.startHour, s.startMinute)}–
                                  {fmtTime(s.endHour, s.endMinute)}
                                </span>
                              </div>

                              {/* Rotation dots */}
                              <div className="flex-shrink-0">
                                {rotation ? (
                                  <RotationDots
                                    pattern={rotation.pattern}
                                    categoryColor={CATEGORY_DOT_COLOR[s.category]}
                                  />
                                ) : (
                                  <span className="text-[10px] text-destructive/70 italic">
                                    No rotation
                                  </span>
                                )}
                              </div>

                              {/* Rotation name + start */}
                              <div className="hidden lg:block flex-shrink-0 w-24 min-w-0">
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-[10px] text-muted-foreground truncate block cursor-default">
                                        {rotation?.name ?? "—"}
                                      </span>
                                    </TooltipTrigger>
                                    {s.description && (
                                      <TooltipContent
                                        side="bottom"
                                        className="text-[10px] max-w-48"
                                      >
                                        {s.description}
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                <span className="text-[9px] text-muted-foreground/60">
                                  from {s.rotationStartDate}
                                </span>
                              </div>

                              {/* Spacer */}
                              <div className="flex-1 min-w-0" />

                              {/* Headcount — always-visible normal input, auto-saves on blur */}
                              <div className="flex-shrink-0">
                                <HeadcountInput
                                  key={`${s.id}-${s.headcount}`}
                                  shiftId={s.id}
                                  defaultValue={displayHC}
                                  isPending={isPending}
                                  onBlur={handleHeadcountBlur}
                                />
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => openEdit(s)}
                                >
                                  <i className="fa-solid fa-pen-to-square text-[10px]" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleToggleActive(s)}
                                >
                                  <i
                                    className={`fa-solid ${s.isActive ? "fa-eye" : "fa-eye-slash"} text-[10px]`}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive"
                                  onClick={() => setDeleteTarget(s)}
                                >
                                  <i className="fa-solid fa-trash text-[10px]" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {shifts.length > 0 && (
        <div className="px-3 py-2 border-t border-border shrink-0 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Active: {shifts.filter((s) => s.isActive).length}/{shifts.length} shifts
          </span>
          <span className="font-semibold text-foreground">
            <i className="fa-solid fa-users mr-1" />
            {totalHeadcount} AMTs
            {hasPendingChanges && (
              <span className="text-[9px] text-amber-500 ml-1.5 font-normal">(unsaved)</span>
            )}
          </span>
        </div>
      )}

      {/* Edit / Create Dialog — NO headcount field */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <i className="fa-solid fa-layer-group text-muted-foreground" />
              {editingShift ? `Edit: ${editingShift.name}` : "New Shift"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Row 1: Name + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Shift Name <span className="text-muted-foreground">({MAX_NAME_LEN} max)</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value.slice(0, MAX_NAME_LEN) }))
                  }
                  className="h-8 text-sm"
                  placeholder="e.g. Day 10FSS"
                  maxLength={MAX_NAME_LEN}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as StaffingShiftCategory }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ORDER.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        <i
                          className={`fa-solid ${CATEGORY_META[cat].icon} mr-1.5 ${CATEGORY_META[cat].color}`}
                        />
                        {CATEGORY_META[cat].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="h-8 text-sm"
                placeholder="e.g. Fri-Sat-Sun 10hr rotation"
              />
            </div>

            {/* Row 2: Rotation + Start Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Rotation Pattern</Label>
                <Select
                  value={form.rotationId}
                  onValueChange={(v) => setForm((f) => ({ ...f, rotationId: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select rotation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patterns
                      .filter((p) => p.isActive)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rotation Start Date</Label>
                <Input
                  type="date"
                  value={form.rotationStartDate}
                  onChange={(e) => setForm((f) => ({ ...f, rotationStartDate: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Selected rotation preview */}
            {form.rotationId && patternMap.get(parseInt(form.rotationId, 10)) && (
              <div className="rounded border border-border bg-muted/30 px-3 py-2 flex items-center gap-3">
                <RotationDots
                  pattern={patternMap.get(parseInt(form.rotationId, 10))!.pattern}
                  size="md"
                  categoryColor={CATEGORY_DOT_COLOR[form.category]}
                  showWeekLabels
                />
                <div className="text-[10px] text-muted-foreground">
                  <div className="font-medium text-foreground">
                    {patternMap.get(parseInt(form.rotationId, 10))!.name}
                  </div>
                  <div className="font-mono tracking-wider mt-0.5">
                    {patternMap.get(parseInt(form.rotationId, 10))!.pattern}
                  </div>
                </div>
              </div>
            )}

            {/* Row 3: Shift Times — TimePicker */}
            <div>
              <Label className="text-xs mb-1.5 block">Shift Hours</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Start Time</span>
                  <TimePicker
                    value={form.startTime}
                    onChange={(d) => setForm((f) => ({ ...f, startTime: d }))}
                    format="HH:mm"
                    size="sm"
                    placeholder="07:00"
                    cleanable={false}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">End Time</span>
                  <TimePicker
                    value={form.endTime}
                    onChange={(d) => setForm((f) => ({ ...f, endTime: d }))}
                    format="HH:mm"
                    size="sm"
                    placeholder="15:00"
                    cleanable={false}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Break/Lunch/MH */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Break (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.breakMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lunch (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.lunchMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, lunchMinutes: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  MH Override
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <i className="fa-solid fa-circle-info text-[9px] ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px] max-w-48">
                        Override paid hours per person (pre-productivity). If blank, computed from
                        shift duration minus breaks/lunch.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.mhOverride}
                  onChange={(e) => setForm((f) => ({ ...f, mhOverride: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="Auto"
                />
              </div>
            </div>

            {error && (
              <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
              {editingShift ? "Save Changes" : "Create Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? This removes {deleteTarget?.headcount} AMTs
              from the staffing matrix.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Headcount Input sub-component ---
// Always-visible number input; caches value on blur. No click-to-edit pattern.
function HeadcountInput({
  shiftId,
  defaultValue,
  isPending,
  onBlur,
}: {
  shiftId: number;
  defaultValue: number;
  isPending: boolean;
  onBlur: (shiftId: number, value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue.toString());

  return (
    <div className="flex items-center gap-1.5">
      <i className="fa-solid fa-users text-[9px] text-muted-foreground" />
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onBlur(shiftId, value)}
        className={`h-7 w-16 text-center text-sm font-bold tabular-nums ${
          isPending ? "border-amber-500/50 bg-amber-500/5" : ""
        }`}
      />
    </div>
  );
}
