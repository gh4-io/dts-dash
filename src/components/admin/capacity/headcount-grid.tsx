"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { CapacityShift, HeadcountPlan, HeadcountException } from "@/types";

interface HeadcountGridProps {
  shifts: CapacityShift[];
  plans: HeadcountPlan[];
  exceptions: HeadcountException[];
  onCreatePlan: (plan: Omit<HeadcountPlan, "id" | "station">) => Promise<void>;
  onUpdatePlan: (id: number, updates: Partial<HeadcountPlan>) => Promise<void>;
  onDeletePlan: (id: number) => Promise<void>;
  onCreateException: (exc: Omit<HeadcountException, "id" | "station">) => Promise<void>;
  onDeleteException: (id: number) => Promise<void>;
}

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

const SHIFT_ICONS: Record<string, string> = {
  DAY: "fa-sun",
  SWING: "fa-cloud-sun",
  NIGHT: "fa-moon",
};

export function HeadcountGrid({
  shifts,
  plans,
  exceptions,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
  onCreateException,
  onDeleteException,
}: HeadcountGridProps) {
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showAddException, setShowAddException] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editHeadcount, setEditHeadcount] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // New plan form state
  const [newPlan, setNewPlan] = useState({
    shiftId: shifts[0]?.id ?? 0,
    headcount: 8,
    effectiveFrom: new Date().toISOString().split("T")[0],
    effectiveTo: "",
    dayOfWeek: "null" as string,
    label: "",
    notes: "",
  });

  // New exception form state
  const [newException, setNewException] = useState({
    shiftId: shifts[0]?.id ?? 0,
    exceptionDate: new Date().toISOString().split("T")[0],
    headcountDelta: 0,
    reason: "",
  });

  const handleCreatePlan = useCallback(async () => {
    setSaving(true);
    try {
      await onCreatePlan({
        shiftId: newPlan.shiftId,
        headcount: newPlan.headcount,
        effectiveFrom: newPlan.effectiveFrom,
        effectiveTo: newPlan.effectiveTo || null,
        dayOfWeek: newPlan.dayOfWeek === "null" ? null : parseInt(newPlan.dayOfWeek, 10),
        label: newPlan.label || null,
        notes: newPlan.notes || null,
      });
      setShowAddPlan(false);
      setNewPlan({
        shiftId: shifts[0]?.id ?? 0,
        headcount: 8,
        effectiveFrom: new Date().toISOString().split("T")[0],
        effectiveTo: "",
        dayOfWeek: "null",
        label: "",
        notes: "",
      });
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }, [newPlan, shifts, onCreatePlan]);

  const handleCreateException = useCallback(async () => {
    setSaving(true);
    try {
      await onCreateException({
        shiftId: newException.shiftId,
        exceptionDate: newException.exceptionDate,
        headcountDelta: newException.headcountDelta,
        reason: newException.reason || null,
      });
      setShowAddException(false);
      setNewException({
        shiftId: shifts[0]?.id ?? 0,
        exceptionDate: new Date().toISOString().split("T")[0],
        headcountDelta: 0,
        reason: "",
      });
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }, [newException, shifts, onCreateException]);

  const handleInlineEdit = useCallback(
    async (planId: number) => {
      setSaving(true);
      try {
        await onUpdatePlan(planId, { headcount: editHeadcount });
        setEditingPlanId(null);
      } catch {
        // error handled by parent
      } finally {
        setSaving(false);
      }
    },
    [editHeadcount, onUpdatePlan],
  );

  const getShiftName = (shiftId: number) =>
    shifts.find((s) => s.id === shiftId)?.name ?? `Shift ${shiftId}`;

  const getShiftCode = (shiftId: number) => shifts.find((s) => s.id === shiftId)?.code ?? "";

  const getDowLabel = (dow: number | null) =>
    dow === null
      ? "All Days"
      : (DAYS_OF_WEEK.find((d) => d.value === String(dow))?.label ?? `Day ${dow}`);

  return (
    <div className="space-y-6">
      {/* Headcount Plans Section */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <i className="fa-solid fa-users text-muted-foreground" />
              Headcount Plans
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Base headcount per shift with effective dating and weekday overrides
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAddPlan(!showAddPlan)}>
            <i className={`fa-solid ${showAddPlan ? "fa-times" : "fa-plus"} mr-1.5`} />
            {showAddPlan ? "Cancel" : "Add Plan"}
          </Button>
        </div>

        {/* Add plan form */}
        {showAddPlan && (
          <div className="p-4 border-b border-border bg-muted/20 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Shift</Label>
                <Select
                  value={String(newPlan.shiftId)}
                  onValueChange={(v) => setNewPlan({ ...newPlan, shiftId: parseInt(v, 10) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Headcount</Label>
                <Input
                  type="number"
                  value={newPlan.headcount}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, headcount: parseInt(e.target.value, 10) || 0 })
                  }
                  min={0}
                  max={50}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Effective From</Label>
                <Input
                  type="date"
                  value={newPlan.effectiveFrom}
                  onChange={(e) => setNewPlan({ ...newPlan, effectiveFrom: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Effective To</Label>
                <Input
                  type="date"
                  value={newPlan.effectiveTo}
                  onChange={(e) => setNewPlan({ ...newPlan, effectiveTo: e.target.value })}
                  placeholder="Open-ended"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Day of Week</Label>
                <Select
                  value={newPlan.dayOfWeek}
                  onValueChange={(v) => setNewPlan({ ...newPlan, dayOfWeek: v })}
                >
                  <SelectTrigger>
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
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={newPlan.label}
                  onChange={(e) => setNewPlan({ ...newPlan, label: e.target.value })}
                  placeholder="e.g., Q1 2026 Plan"
                />
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={handleCreatePlan} disabled={saving}>
                  {saving ? (
                    <i className="fa-solid fa-spinner fa-spin mr-1" />
                  ) : (
                    <i className="fa-solid fa-check mr-1" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Plans table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Shift</TableHead>
                <TableHead className="text-xs">Headcount</TableHead>
                <TableHead className="text-xs">Effective From</TableHead>
                <TableHead className="text-xs">Effective To</TableHead>
                <TableHead className="text-xs">Day</TableHead>
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <i className="fa-solid fa-inbox text-lg mb-1 block" />
                    No headcount plans configured
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1.5">
                        <i
                          className={`fa-solid ${SHIFT_ICONS[getShiftCode(plan.shiftId)] ?? "fa-clock"} text-[10px] text-muted-foreground`}
                        />
                        {getShiftName(plan.shiftId)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {editingPlanId === plan.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editHeadcount}
                            onChange={(e) => setEditHeadcount(parseInt(e.target.value, 10) || 0)}
                            min={0}
                            max={50}
                            className="w-16 h-7 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleInlineEdit(plan.id)}
                            disabled={saving}
                          >
                            <i className="fa-solid fa-check text-xs text-emerald-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingPlanId(null)}
                          >
                            <i className="fa-solid fa-times text-xs text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="font-medium tabular-nums hover:text-primary cursor-pointer"
                          onClick={() => {
                            setEditingPlanId(plan.id);
                            setEditHeadcount(plan.headcount);
                          }}
                        >
                          {plan.headcount}
                          <i className="fa-solid fa-pen text-[8px] ml-1 opacity-50" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{plan.effectiveFrom}</TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {plan.effectiveTo ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getDowLabel(plan.dayOfWeek)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {plan.label ?? "—"}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Headcount Plan?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the {getShiftName(plan.shiftId)} plan for{" "}
                              {plan.effectiveFrom}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeletePlan(plan.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Headcount Exceptions Section */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <i className="fa-solid fa-asterisk text-muted-foreground" />
              Headcount Exceptions
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Date-specific delta overrides (e.g., +2 for a busy day, -1 for training)
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAddException(!showAddException)}>
            <i className={`fa-solid ${showAddException ? "fa-times" : "fa-plus"} mr-1.5`} />
            {showAddException ? "Cancel" : "Add Exception"}
          </Button>
        </div>

        {/* Add exception form */}
        {showAddException && (
          <div className="p-4 border-b border-border bg-muted/20 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Shift</Label>
                <Select
                  value={String(newException.shiftId)}
                  onValueChange={(v) =>
                    setNewException({ ...newException, shiftId: parseInt(v, 10) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={newException.exceptionDate}
                  onChange={(e) =>
                    setNewException({ ...newException, exceptionDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delta (+/-)</Label>
                <Input
                  type="number"
                  value={newException.headcountDelta}
                  onChange={(e) =>
                    setNewException({
                      ...newException,
                      headcountDelta: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason</Label>
                <div className="flex gap-1">
                  <Input
                    value={newException.reason}
                    onChange={(e) => setNewException({ ...newException, reason: e.target.value })}
                    placeholder="e.g., Training day"
                  />
                  <Button size="sm" onClick={handleCreateException} disabled={saving}>
                    {saving ? (
                      <i className="fa-solid fa-spinner fa-spin" />
                    ) : (
                      <i className="fa-solid fa-check" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exceptions table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Shift</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Delta</TableHead>
                <TableHead className="text-xs">Reason</TableHead>
                <TableHead className="text-xs w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <i className="fa-solid fa-inbox text-lg mb-1 block" />
                    No exceptions configured
                  </TableCell>
                </TableRow>
              ) : (
                exceptions.map((exc) => (
                  <TableRow key={exc.id}>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1.5">
                        <i
                          className={`fa-solid ${SHIFT_ICONS[getShiftCode(exc.shiftId)] ?? "fa-clock"} text-[10px] text-muted-foreground`}
                        />
                        {getShiftName(exc.shiftId)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{exc.exceptionDate}</TableCell>
                    <TableCell className="text-sm">
                      <span
                        className={`tabular-nums font-medium ${
                          exc.headcountDelta > 0
                            ? "text-emerald-400"
                            : exc.headcountDelta < 0
                              ? "text-red-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {exc.headcountDelta > 0 ? "+" : ""}
                        {exc.headcountDelta}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exc.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Exception?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the {getShiftName(exc.shiftId)} exception for{" "}
                              {exc.exceptionDate}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteException(exc.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
