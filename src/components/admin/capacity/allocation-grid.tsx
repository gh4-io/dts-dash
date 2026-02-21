"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { AllocationEditor } from "./allocation-editor";
import type { DemandAllocation, CapacityShift } from "@/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CustomerOption {
  id: number;
  name: string;
  displayName: string;
}

interface AllocationGridProps {
  allocations: DemandAllocation[];
  shifts: CapacityShift[];
  customers: CustomerOption[];
  onCreate: (
    data: Omit<DemandAllocation, "id" | "customerName" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  onUpdate: (id: number, updates: Partial<DemandAllocation>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function AllocationGrid({
  allocations,
  shifts,
  customers,
  onCreate,
  onUpdate,
  onDelete,
}: AllocationGridProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<DemandAllocation | null>(null);

  const handleAdd = () => {
    setEditingAllocation(null);
    setEditorOpen(true);
  };

  const handleEdit = (alloc: DemandAllocation) => {
    setEditingAllocation(alloc);
    setEditorOpen(true);
  };

  const handleSave = async (
    data: Omit<DemandAllocation, "id" | "customerName" | "createdAt" | "updatedAt">,
  ) => {
    if (editingAllocation) {
      await onUpdate(editingAllocation.id, data);
    } else {
      await onCreate(data);
    }
    setEditorOpen(false);
  };

  const getShiftName = (shiftId: number | null) => {
    if (shiftId === null) return "All Shifts";
    const shift = shifts.find((s) => s.id === shiftId);
    return shift?.name ?? `Shift #${shiftId}`;
  };

  const getDayLabel = (dow: number | null) => {
    if (dow === null) return "All Days";
    return DAYS[dow] ?? `Day ${dow}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Allocations</h2>
          <p className="text-xs text-muted-foreground">
            {allocations.length} allocation{allocations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <i className="fa-solid fa-plus mr-1.5" />
          Add Allocation
        </Button>
      </div>

      {allocations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <i className="fa-solid fa-handshake text-3xl text-muted-foreground/50 mb-3 block" />
          <p className="text-sm text-muted-foreground">No demand allocations configured.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add allocations to define contractual minimum hours per customer.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Day(s)</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">MH</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((alloc) => (
                <TableRow key={alloc.id} className={!alloc.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-medium text-sm">
                    {alloc.customerName ?? `Customer #${alloc.customerId}`}
                  </TableCell>
                  <TableCell className="text-sm">{getShiftName(alloc.shiftId)}</TableCell>
                  <TableCell className="text-sm">{getDayLabel(alloc.dayOfWeek)}</TableCell>
                  <TableCell className="text-sm font-mono">{alloc.effectiveFrom}</TableCell>
                  <TableCell className="text-sm font-mono">
                    {alloc.effectiveTo ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono font-medium">
                    {alloc.allocatedMh.toFixed(1)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        alloc.mode === "MINIMUM_FLOOR"
                          ? "border-amber-500/50 text-amber-500"
                          : "border-blue-500/50 text-blue-500"
                      }
                    >
                      {alloc.mode === "MINIMUM_FLOOR" ? "Floor" : "Additive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={alloc.isActive ? "default" : "secondary"}>
                      {alloc.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(alloc)}
                        className="h-7 w-7 p-0"
                      >
                        <i className="fa-solid fa-pen text-xs" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Allocation</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete the {alloc.mode === "MINIMUM_FLOOR" ? "floor" : "additive"}{" "}
                              allocation of {alloc.allocatedMh} MH for{" "}
                              {alloc.customerName ?? `Customer #${alloc.customerId}`}? This cannot
                              be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(alloc.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AllocationEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        allocation={editingAllocation}
        shifts={shifts}
        customers={customers}
        onSave={handleSave}
      />
    </div>
  );
}
