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
import { BillingEditor } from "./billing-editor";
import type { BillingEntry } from "@/types";

const SHIFT_STYLES: Record<string, string> = {
  DAY: "border-amber-500/50 text-amber-500",
  SWING: "border-violet-500/50 text-violet-500",
  NIGHT: "border-slate-500/50 text-slate-400",
};

interface BillingGridProps {
  entries: BillingEntry[];
  onCreate: (data: Omit<BillingEntry, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate: (id: number, updates: Partial<BillingEntry>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function BillingGrid({ entries, onCreate, onUpdate, onDelete }: BillingGridProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BillingEntry | null>(null);

  const handleAdd = () => {
    setEditingEntry(null);
    setEditorOpen(true);
  };

  const handleEdit = (entry: BillingEntry) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  };

  const handleSave = async (data: Omit<BillingEntry, "id" | "createdAt" | "updatedAt">) => {
    if (editingEntry) {
      await onUpdate(editingEntry.id, data);
    } else {
      await onCreate(data);
    }
    setEditorOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Billing Entries</h2>
          <p className="text-xs text-muted-foreground">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <i className="fa-solid fa-plus mr-1.5" />
          Add Entry
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <i className="fa-solid fa-file-invoice-dollar text-3xl text-muted-foreground/50 mb-3 block" />
          <p className="text-sm text-muted-foreground">No billing entries recorded.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add entries to track billed man-hours per customer.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Aircraft</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Billed MH</TableHead>
                <TableHead>Invoice Ref</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className={!entry.isActive ? "opacity-50" : ""}>
                  <TableCell className="text-sm font-mono">{entry.billingDate}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={SHIFT_STYLES[entry.shiftCode] ?? ""}>
                      {entry.shiftCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{entry.aircraftReg}</TableCell>
                  <TableCell className="text-sm">{entry.customer}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">
                    {entry.description || <span className="text-muted-foreground">&mdash;</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono font-medium">
                    {entry.billedMh.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-sm max-w-[120px] truncate">
                    {entry.invoiceRef || <span className="text-muted-foreground">&mdash;</span>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        entry.source === "import"
                          ? "border-amber-500/50 text-amber-500"
                          : "border-slate-500/50 text-slate-400"
                      }
                    >
                      {entry.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(entry)}
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
                            <AlertDialogTitle>Delete Billing Entry</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete the {entry.billedMh} MH billing entry for {entry.aircraftReg}{" "}
                              on {entry.billingDate}? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(entry.id)}
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

      <BillingEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        entry={editingEntry}
        onSave={handleSave}
      />
    </div>
  );
}
