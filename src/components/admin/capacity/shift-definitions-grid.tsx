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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RotationDots } from "./rotation-dots";
import {
  alignRotationStartToSunday,
  canArchiveShift,
  findShiftOverlaps,
} from "@/lib/capacity/staffing-engine";
import type { StaffingShift, StaffingShiftCategory, RotationPattern } from "@/types";

const MAX_NAME_LEN = 32;

/**
 * Fields that change what a date *meant*, so editing one must open a new version
 * rather than rewrite the current row (OI-100). Mirrors the split OI-101 settled
 * for rotation patterns: the pattern string versions, its label does not.
 *
 * `category` is in here because it routes headcount into a capacity bucket —
 * moving a shift to OTHER drops it from capacity entirely.
 */
const VERSIONING_FIELDS = [
  "category",
  "rotationId",
  "startHour",
  "startMinute",
  "endHour",
  "endMinute",
  "breakMinutes",
  "lunchMinutes",
  "mhOverride",
  "headcount",
] as const;

/** Cosmetic fields — safe to edit in place, no history implications. */
const IN_PLACE_FIELDS = ["name", "description", "rotationStartDate", "rotationEndDate"] as const;

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

/** Archived rows revealed per "Show more" click. */
const ARCHIVE_PAGE = 10;

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
  rotationEndDate: string;
  startTime: Date | null;
  endTime: Date | null;
  breakMinutes: string;
  lunchMinutes: string;
  mhOverride: string;
  headcount: string;
}

const emptyForm: ShiftFormData = {
  name: "",
  description: "",
  category: "DAY",
  rotationId: "",
  rotationStartDate: new Date().toISOString().split("T")[0],
  rotationEndDate: "",
  startTime: toTimeDate(7, 0),
  endTime: toTimeDate(15, 0),
  breakMinutes: "0",
  lunchMinutes: "0",
  mhOverride: "",
  headcount: "0",
};

interface ShiftDefinitionsGridProps {
  configId: number;
  shifts: StaffingShift[];
  patterns: RotationPattern[];
  onRefresh: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ShiftDefinitionsGrid({
  configId,
  shifts,
  patterns,
  onRefresh,
  collapsed,
  onToggleCollapse,
}: ShiftDefinitionsGridProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StaffingShift | null>(null);
  const [form, setForm] = useState<ShiftFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffingShift | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<StaffingShift | null>(null);
  const [archiveWarning, setArchiveWarning] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archiveLimit, setArchiveLimit] = useState(ARCHIVE_PAGE);
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
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "version", changes: { headcount } }),
          }),
        ),
      );
      setPendingHeadcounts(new Map());
      onRefresh();
    } finally {
      setSavingHeadcounts(false);
    }
  }, [onRefresh]);

  // Compute aligned start date for the form note
  const alignedFormStart = form.rotationStartDate
    ? alignRotationStartToSunday(form.rotationStartDate)
    : null;
  const showAlignmentNote =
    alignedFormStart !== null && alignedFormStart !== form.rotationStartDate;

  // Split into active/archived
  const today = new Date().toISOString().slice(0, 10);
  const activeShifts = shifts.filter(
    (s) => s.isActive && (s.rotationEndDate === null || s.rotationEndDate >= today),
  );
  // Most recently retired first — with a year of version history, sortOrder
  // buries the version you just replaced among the ones you replaced last spring.
  const archivedShifts = shifts
    .filter((s) => !s.isActive || (s.rotationEndDate !== null && s.rotationEndDate < today))
    .sort((a, b) => (b.rotationEndDate ?? "").localeCompare(a.rotationEndDate ?? ""));

  const archiveMatches = archiveQuery.trim()
    ? archivedShifts.filter((s) => {
        const q = archiveQuery.trim().toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.rotationStartDate.includes(q) ||
          (s.rotationEndDate ?? "").includes(q)
        );
      })
    : archivedShifts;

  const archiveVisible = archiveMatches.slice(0, archiveLimit);

  // Group shifts by category
  const grouped: Record<StaffingShiftCategory, StaffingShift[]> = {
    DAY: [],
    SWING: [],
    NIGHT: [],
    OTHER: [],
  };
  for (const s of activeShifts) {
    grouped[s.category]?.push(s);
  }

  const patternMap = new Map(patterns.map((p) => [p.id, p]));

  // Two versions of the same shift effective at once are summed by the engine, so
  // the roster silently doubles. Surface it rather than let it read as real capacity.
  const overlaps = findShiftOverlaps(shifts);
  const overlappingIds = new Set(overlaps.flatMap((o) => o.shiftIds));

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
      rotationEndDate: s.rotationEndDate ?? "",
      startTime: toTimeDate(s.startHour, s.startMinute),
      endTime: toTimeDate(s.endHour, s.endMinute),
      breakMinutes: s.breakMinutes.toString(),
      lunchMinutes: s.lunchMinutes.toString(),
      mhOverride: s.mhOverride?.toString() ?? "",
      headcount: getEffectiveHeadcount(s).toString(),
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
    const headcount = parseInt(form.headcount, 10);
    if (isNaN(headcount) || headcount < 0) {
      setError("Headcount must be 0 or greater");
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
        rotationEndDate: form.rotationEndDate || null,
        startHour: form.startTime.getHours(),
        startMinute: form.startTime.getMinutes(),
        endHour: form.endTime.getHours(),
        endMinute: form.endTime.getMinutes(),
        breakMinutes: parseInt(form.breakMinutes, 10) || 0,
        lunchMinutes: parseInt(form.lunchMinutes, 10) || 0,
        mhOverride: form.mhOverride ? parseFloat(form.mhOverride) : null,
        headcount,
      };

      if (!editingShift) {
        const res = await fetch("/api/admin/capacity/staffing-shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setEditDialogOpen(false);
        onRefresh();
        return;
      }

      // Split the edit: anything that changes what a past date meant opens a new
      // version; cosmetic fields are amended in place. Sending the whole payload
      // through PUT (the old behaviour) rewrote history silently — a shift-hours
      // change restated every day the current version had already covered.
      const changes: Record<string, unknown> = {};
      for (const f of VERSIONING_FIELDS) {
        if (payload[f] !== (editingShift as unknown as Record<string, unknown>)[f]) {
          changes[f] = payload[f];
        }
      }
      const inPlace: Record<string, unknown> = {};
      for (const f of IN_PLACE_FIELDS) {
        if (payload[f] !== (editingShift as unknown as Record<string, unknown>)[f]) {
          inPlace[f] = payload[f];
        }
      }

      if (Object.keys(inPlace).length > 0) {
        const res = await fetch(`/api/admin/capacity/staffing-shifts/${editingShift.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inPlace),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }

      if (Object.keys(changes).length > 0) {
        const res = await fetch(`/api/admin/capacity/staffing-shifts/${editingShift.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "version", changes }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }

      // A pending inline edit for this shift is now superseded by the dialog save.
      setPendingHeadcounts((prev) => {
        const next = new Map(prev);
        next.delete(editingShift.id);
        return next;
      });

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

  const handleArchiveClick = (s: StaffingShift) => {
    const result = canArchiveShift(s, shifts);
    setArchiveTarget(s);
    setArchiveWarning(result.safe ? null : (result.message ?? null));
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    await fetch(`/api/admin/capacity/staffing-shifts/${archiveTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    setArchiveTarget(null);
    setArchiveWarning(null);
    onRefresh();
  };

  const handleReactivate = async (s: StaffingShift) => {
    await fetch(`/api/admin/capacity/staffing-shifts/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotationEndDate: null, isActive: true }),
    });
    onRefresh();
  };

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
        <div
          className={`flex items-center gap-2 ${onToggleCollapse ? "lg:pointer-events-none cursor-pointer" : ""}`}
          onClick={onToggleCollapse}
        >
          {onToggleCollapse && (
            <span className="lg:hidden">
              <i
                className={`fa-solid fa-chevron-${collapsed ? "right" : "down"} text-[10px] text-muted-foreground`}
              />
            </span>
          )}
          <i className="fa-solid fa-layer-group text-xs text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shift Definitions
          </h3>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {shifts.length}
          </Badge>
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2">
            {hasPendingChanges && (
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Save changes</TooltipContent>
              </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={openCreate}>
                  <i className="fa-solid fa-plus mr-1" />
                  Add Shift
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">New shift</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Collapsible content — hidden on mobile when collapsed, always visible on lg+ */}
      <div className={collapsed ? "hidden lg:contents" : "contents"}>
        {overlaps.length > 0 && (
          <div className="mx-2 mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 shrink-0">
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-500 text-xs mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold text-amber-500">
                  Overlapping shift versions — headcount is double-counted
                </span>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {overlaps.map((o) => (
                    <li key={`${o.name}-${o.shiftIds.join("-")}`}>
                      <span className="font-medium text-foreground">{o.name}</span> — versions #
                      {o.shiftIds.join(" and #")} are both effective from {o.fromDate}, counting{" "}
                      <span className="font-medium text-foreground">
                        {o.combinedHeadcount} AMTs
                      </span>{" "}
                      instead of one version&apos;s. Archive the superseded version to correct it.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
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
                              // Clicking the row opens the editor. The icon buttons can be
                              // cramped or hover-gated depending on width and input device,
                              // so the row itself is the guaranteed route into editing —
                              // same affordance the rotations list already offers.
                              role="button"
                              tabIndex={0}
                              aria-label={`Edit ${s.name}`}
                              onClick={(e) => {
                                // Let the checkbox, headcount input and action buttons win.
                                if ((e.target as HTMLElement).closest("button, input, a")) return;
                                openEdit(s);
                              }}
                              onKeyDown={(e) => {
                                if (e.target !== e.currentTarget) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openEdit(s);
                                }
                              }}
                              className={`group cursor-pointer rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
                                    {overlappingIds.has(s.id) && (
                                      <TooltipProvider delayDuration={0}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <i className="fa-solid fa-clone text-[9px] text-amber-500 flex-shrink-0" />
                                          </TooltipTrigger>
                                          <TooltipContent className="text-[10px]">
                                            Duplicate version
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
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
                                    {s.rotationEndDate && ` → ${s.rotationEndDate}`}
                                  </span>
                                </div>

                                {/* Spacer */}
                                <div className="flex-1 min-w-0" />

                                {/* Headcount — quick-access extension of the shift form.
                                    Same field, same versioning; edits cache until saved. */}
                                <div className="flex-shrink-0">
                                  <HeadcountInput
                                    key={`${s.id}-${s.headcount}`}
                                    shiftId={s.id}
                                    shiftName={s.name}
                                    defaultValue={displayHC}
                                    isPending={isPending}
                                    onBlur={handleHeadcountBlur}
                                  />
                                </div>

                                {/* Action buttons — always visible on touch, hover-revealed on
                                    pointer devices (they were opacity-0 everywhere, which left
                                    them unreachable on iPad). */}
                                <TooltipProvider delayDuration={200}>
                                  <div className="flex items-center gap-0.5 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          aria-label={`Edit ${s.name}`}
                                          onClick={() => openEdit(s)}
                                        >
                                          <i className="fa-solid fa-pen-to-square text-[10px]" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[10px]">Edit</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          aria-label={
                                            s.isActive ? `Hide ${s.name}` : `Show ${s.name}`
                                          }
                                          onClick={() => handleToggleActive(s)}
                                        >
                                          <i
                                            className={`fa-solid ${s.isActive ? "fa-eye" : "fa-eye-slash"} text-[10px]`}
                                          />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[10px]">
                                        {s.isActive ? "Deactivate" : "Reactivate"}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive"
                                          aria-label={`Delete ${s.name}`}
                                          onClick={() => setDeleteTarget(s)}
                                        >
                                          <i className="fa-solid fa-trash text-[10px]" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[10px]">
                                        Delete
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
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
      </div>

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

            {/* Row 2: Rotation Pattern + Start Date + End Date */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Rotation</Label>
                <Select
                  value={form.rotationId}
                  onValueChange={(v) => setForm((f) => ({ ...f, rotationId: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select..." />
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
                <Label className="text-xs">Start</Label>
                <Input
                  type="date"
                  value={form.rotationStartDate}
                  onChange={(e) => setForm((f) => ({ ...f, rotationStartDate: e.target.value }))}
                  className="h-8 text-xs w-[130px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  End
                  {form.rotationEndDate && (
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setForm((f) => ({ ...f, rotationEndDate: "" }))}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </Label>
                <Input
                  type="date"
                  value={form.rotationEndDate}
                  onChange={(e) => setForm((f) => ({ ...f, rotationEndDate: e.target.value }))}
                  className="h-8 text-xs w-[130px]"
                  placeholder="Open-ended"
                />
              </div>
            </div>
            {showAlignmentNote && (
              <p className="text-[10px] text-muted-foreground -mt-2">
                <i className="fa-solid fa-info-circle mr-1" />
                Start will align to Sunday: {alignedFormStart}
              </p>
            )}

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

            {/* Row 4: Headcount/Break/Lunch/MH */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Headcount
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <i className="fa-solid fa-circle-info text-[9px] ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">
                        AMTs — also on the shift bar
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.headcount}
                  onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
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

            {editingShift && (
              <p className="text-[10px] text-muted-foreground">
                <i className="fa-solid fa-code-branch mr-1" />
                Headcount, hours, rotation, breaks, MH or category changes open a new version
                effective today. Name, description and dates amend in place.
              </p>
            )}

            {error && (
              <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex !justify-between">
            {editingShift ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setEditDialogOpen(false);
                  handleArchiveClick(editingShift);
                }}
              >
                <i className="fa-solid fa-box-archive mr-1.5" />
                Archive
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive section */}
      {archivedShifts.length > 0 && (
        <Collapsible open={archiveOpen} onOpenChange={setArchiveOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs border-t border-border hover:bg-accent/30 transition-colors"
            >
              <i
                className={`fa-solid ${archiveOpen ? "fa-chevron-down" : "fa-chevron-right"} text-[8px] text-muted-foreground w-3`}
              />
              <i className="fa-solid fa-box-archive text-[10px] text-muted-foreground" />
              <span className="text-muted-foreground font-semibold uppercase tracking-wider">
                Archive ({archivedShifts.length})
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pt-2 pb-1 space-y-2">
              <p className="text-[10px] text-muted-foreground leading-snug">
                Archived versions are retained permanently — historical capacity is calculated from
                them.
              </p>
              {archivedShifts.length > ARCHIVE_PAGE && (
                <Input
                  value={archiveQuery}
                  onChange={(e) => {
                    setArchiveQuery(e.target.value);
                    setArchiveLimit(ARCHIVE_PAGE);
                  }}
                  placeholder="Search archive by name, category or date…"
                  className="h-7 text-xs"
                />
              )}
            </div>
            <div className="px-2 py-1 space-y-1 opacity-70">
              {archiveVisible.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-muted/20"
                >
                  <div className="w-24 flex-shrink-0 min-w-0">
                    <span className="text-sm font-medium truncate block">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtTime(s.startHour, s.startMinute)}–{fmtTime(s.endHour, s.endMinute)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {s.category}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    <i className="fa-solid fa-users mr-0.5" />
                    {s.headcount}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.rotationStartDate}
                    {s.rotationEndDate && ` → ${s.rotationEndDate}`}
                  </span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                    Archived
                  </Badge>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => handleReactivate(s)}
                  >
                    <i className="fa-solid fa-rotate-left mr-1" />
                    Reactivate
                  </Button>
                </div>
              ))}
            </div>
            {archiveMatches.length === 0 && (
              <p className="px-3 py-3 text-[10px] text-muted-foreground">
                No archived shifts match &ldquo;{archiveQuery}&rdquo;.
              </p>
            )}
            {archiveVisible.length < archiveMatches.length && (
              <button
                type="button"
                className="w-full px-3 py-2 text-[10px] text-muted-foreground hover:bg-accent/30 transition-colors"
                onClick={() => setArchiveLimit((n) => n + ARCHIVE_PAGE)}
              >
                Show more ({archiveMatches.length - archiveVisible.length} remaining)
              </button>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Archive confirm */}
      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={() => {
          setArchiveTarget(null);
          setArchiveWarning(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Archive &ldquo;{archiveTarget?.name}&rdquo;? The shift will be deactivated and given
              an end date of today.
              {archiveWarning && (
                <span className="block mt-2 text-amber-500 font-medium">
                  <i className="fa-solid fa-triangle-exclamation mr-1" />
                  {archiveWarning}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleArchiveConfirm}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  shiftName,
  defaultValue,
  isPending,
  onBlur,
}: {
  shiftId: number;
  shiftName: string;
  defaultValue: number;
  isPending: boolean;
  onBlur: (shiftId: number, value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue.toString());

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <i className="fa-solid fa-users text-[9px] text-muted-foreground" />
            <Input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => onBlur(shiftId, value)}
              aria-label={`Headcount for ${shiftName}`}
              className={`h-7 w-16 text-center text-sm font-bold tabular-nums ${
                isPending ? "border-amber-500/50 bg-amber-500/5" : ""
              }`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">{isPending ? "Unsaved" : "AMTs"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
