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
import type {
  DemandContract,
  DemandAllocationLine,
  CapacityShift,
  ProjectionStatus,
} from "@/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CustomerOption {
  id: number;
  name: string;
  displayName: string;
}

interface AllocationGridProps {
  contracts: DemandContract[];
  shifts: CapacityShift[];
  customers: CustomerOption[];
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: number, updates: Record<string, unknown>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function StatusBadge({ status }: { status: ProjectionStatus | null | undefined }) {
  if (!status) return null;
  const config: Record<ProjectionStatus, { label: string; className: string }> = {
    SHORTFALL: { label: "Under", className: "border-amber-500/50 text-amber-500" },
    OK: { label: "On Target", className: "border-emerald-500/50 text-emerald-500" },
    EXCESS: { label: "Over", className: "border-blue-500/50 text-blue-500" },
  };
  const c = config[status];
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  );
}

function PeriodLabel({ type }: { type: string | null | undefined }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const labels: Record<string, string> = {
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    ANNUAL: "Annual",
    TOTAL: "Total",
    PER_EVENT: "Per Event",
  };
  return <span className="text-xs">{labels[type] ?? type}</span>;
}

export function AllocationGrid({
  contracts,
  shifts,
  customers,
  onCreate,
  onUpdate,
  onDelete,
}: AllocationGridProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<DemandContract | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    setEditingContract(null);
    setEditorOpen(true);
  };

  const handleEdit = (contract: DemandContract) => {
    setEditingContract(contract);
    setEditorOpen(true);
  };

  const handleSave = async (data: Record<string, unknown>) => {
    if (editingContract) {
      await onUpdate(editingContract.id, data);
    } else {
      await onCreate(data);
    }
    setEditorOpen(false);
  };

  const handleRemoveLine = async (contract: DemandContract, lineId: number) => {
    const updatedLines = contract.lines
      .filter((l) => l.id !== lineId)
      .map((l) => ({
        shiftId: l.shiftId,
        dayOfWeek: l.dayOfWeek,
        allocatedMh: l.allocatedMh,
        label: l.label,
      }));
    await onUpdate(contract.id, { lines: updatedLines });
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
          <h2 className="text-sm font-semibold">Contracts</h2>
          <p className="text-xs text-muted-foreground">
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <i className="fa-solid fa-plus mr-1.5" />
          Add Contract
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <i className="fa-solid fa-handshake text-3xl text-muted-foreground/50 mb-3 block" />
          <p className="text-sm text-muted-foreground">No demand contracts configured.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add contracts to define named customer obligations with allocation lines.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Customer</TableHead>
                <TableHead>Contract Name</TableHead>
                <TableHead className="text-right w-16">Priority</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Contracted</TableHead>
                <TableHead className="text-right">Projected</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => {
                const isExpanded = expandedIds.has(contract.id);
                return (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpanded(contract.id)}
                    onEdit={() => handleEdit(contract)}
                    onDelete={() => onDelete(contract.id)}
                    onRemoveLine={(lineId) => handleRemoveLine(contract, lineId)}
                    getShiftName={getShiftName}
                    getDayLabel={getDayLabel}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AllocationEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        contract={editingContract}
        shifts={shifts}
        customers={customers}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Contract Row (Parent + Expandable Lines) ──────────────────────────────

function ContractRow({
  contract,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onRemoveLine,
  getShiftName,
  getDayLabel,
}: {
  contract: DemandContract;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveLine: (lineId: number) => void;
  getShiftName: (id: number | null) => string;
  getDayLabel: (dow: number | null) => string;
}) {
  return (
    <>
      <TableRow className={!contract.isActive ? "opacity-50" : ""}>
        <TableCell className="w-8 cursor-pointer" onClick={onToggle}>
          <i
            className={`fa-solid text-xs text-muted-foreground transition-transform ${
              isExpanded ? "fa-chevron-down" : "fa-chevron-right"
            }`}
          />
        </TableCell>
        <TableCell className="font-medium text-sm">
          {contract.customerName ?? `Customer #${contract.customerId}`}
        </TableCell>
        <TableCell className="text-sm">{contract.name}</TableCell>
        <TableCell className="text-right text-sm font-mono">{contract.priority}</TableCell>
        <TableCell>
          <PeriodLabel type={contract.periodType} />
        </TableCell>
        <TableCell className="text-right text-sm font-mono">
          {contract.contractedMh !== null ? contract.contractedMh.toFixed(1) : "—"}
        </TableCell>
        <TableCell className="text-right text-sm font-mono">
          {contract.projectedMh !== null && contract.projectedMh !== undefined
            ? contract.projectedMh.toFixed(1)
            : "—"}
        </TableCell>
        <TableCell>
          <StatusBadge status={contract.projectionStatus} />
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={
              contract.mode === "MINIMUM_FLOOR"
                ? "border-amber-500/50 text-amber-500"
                : "border-blue-500/50 text-blue-500"
            }
          >
            {contract.mode === "MINIMUM_FLOOR" ? "Floor" : "Additive"}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={contract.isActive ? "default" : "secondary"}>
            {contract.isActive ? "Active" : "Inactive"}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0">
              <i className="fa-solid fa-pen text-xs" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                  <i className="fa-solid fa-trash text-xs" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Contract</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete &quot;{contract.name}&quot; for{" "}
                    {contract.customerName ?? `Customer #${contract.customerId}`}? All lines will be
                    removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
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

      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={11} className="p-0">
            <LinesSubTable
              lines={contract.lines}
              getShiftName={getShiftName}
              getDayLabel={getDayLabel}
              onRemoveLine={onRemoveLine}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Lines Sub-Table ─────────────────────────────────────────────────────────

function LinesSubTable({
  lines,
  getShiftName,
  getDayLabel,
  onRemoveLine,
}: {
  lines: DemandAllocationLine[];
  getShiftName: (id: number | null) => string;
  getDayLabel: (dow: number | null) => string;
  onRemoveLine: (lineId: number) => void;
}) {
  return (
    <div className="px-10 py-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th className="text-left py-1 font-medium">Shift</th>
            <th className="text-left py-1 font-medium">Day</th>
            <th className="text-right py-1 font-medium">Allocated MH</th>
            <th className="text-left py-1 font-medium pl-4">Label</th>
            <th className="text-right py-1 font-medium w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-t border-border/40">
              <td className="py-1.5">{getShiftName(line.shiftId)}</td>
              <td className="py-1.5">{getDayLabel(line.dayOfWeek)}</td>
              <td className="py-1.5 text-right font-mono">{line.allocatedMh.toFixed(1)}</td>
              <td className="py-1.5 pl-4 text-muted-foreground">{line.label || "—"}</td>
              <td className="py-1.5 text-right">
                <button
                  onClick={() => onRemoveLine(line.id)}
                  className="text-destructive/70 hover:text-destructive transition-colors"
                  title="Remove line"
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={5} className="py-2 text-center text-muted-foreground text-xs">
                No lines defined
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
