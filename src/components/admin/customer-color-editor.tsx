"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Customer } from "@/types";
import { getContrastText, getWCAGLevel, isValidHex } from "@/lib/utils/contrast";

interface CustomerColorEditorProps {
  customers: Customer[];
  onSave: (updates: Array<{ id: string; color: string; displayName: string }>) => Promise<void>;
  onReset: () => Promise<void>;
  onAdd: (data: { name: string; displayName: string; color: string }) => Promise<void>;
  saving: boolean;
}

interface EditState {
  [id: string]: { color: string; displayName: string };
}

export function CustomerColorEditor({
  customers,
  onSave,
  onReset,
  onAdd,
  saving,
}: CustomerColorEditorProps) {
  const [edits, setEdits] = useState<EditState>({});
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", displayName: "", color: "#6b7280" });
  const [addError, setAddError] = useState<string | null>(null);

  const getEditedValue = (customer: Customer) => {
    return edits[customer.id] ?? { color: customer.color, displayName: customer.displayName };
  };

  const isDirty = Object.keys(edits).length > 0;

  const updateEdit = (customerId: string, customer: Customer, field: "color" | "displayName", value: string) => {
    const current = getEditedValue(customer);
    const updated = { ...current, [field]: value };

    // Check if we're back to original
    if (updated.color === customer.color && updated.displayName === customer.displayName) {
      const next = { ...edits };
      delete next[customerId];
      setEdits(next);
    } else {
      setEdits({ ...edits, [customerId]: updated });
    }
  };

  const handleSave = async () => {
    const updates = Object.entries(edits).map(([id, vals]) => ({
      id,
      color: vals.color,
      displayName: vals.displayName,
    }));
    await onSave(updates);
    setEdits({});
  };

  const handleReset = async () => {
    await onReset();
    setShowResetDialog(false);
    setEdits({});
  };

  const handleAdd = async () => {
    setAddError(null);
    if (!newCustomer.name.trim()) {
      setAddError("Name is required");
      return;
    }
    if (!newCustomer.displayName.trim()) {
      setAddError("Display name is required");
      return;
    }
    if (!isValidHex(newCustomer.color)) {
      setAddError("Invalid hex color");
      return;
    }
    try {
      await onAdd(newCustomer);
      setShowAddDialog(false);
      setNewCustomer({ name: "", displayName: "", color: "#6b7280" });
    } catch (err) {
      setAddError((err as Error).message);
    }
  };

  const activeCustomers = customers.filter((c) => c.isActive);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            <i className="fa-solid fa-plus mr-2" />
            Add Customer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResetDialog(true)}
          >
            <i className="fa-solid fa-rotate-left mr-2" />
            Reset Defaults
          </Button>
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          size="sm"
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Customer list */}
      <div className="space-y-2">
        {activeCustomers.map((customer) => {
          const edited = getEditedValue(customer);
          const contrastText = getContrastText(isValidHex(edited.color) ? edited.color : customer.color);
          const wcagLevel = getWCAGLevel(
            isValidHex(edited.color) ? edited.color : customer.color,
            contrastText
          );
          const isEdited = !!edits[customer.id];

          return (
            <div
              key={customer.id}
              className={`flex items-center gap-4 rounded-lg border p-3 ${
                isEdited ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              {/* Color swatch */}
              <div
                className="h-12 w-12 shrink-0 rounded-md border border-border"
                style={{
                  backgroundColor: isValidHex(edited.color) ? edited.color : customer.color,
                }}
              >
                <div
                  className="flex h-full items-center justify-center text-xs font-bold"
                  style={{ color: contrastText }}
                >
                  Aa
                </div>
              </div>

              {/* Name */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{customer.name}</div>
                <Input
                  value={edited.displayName}
                  onChange={(e) => updateEdit(customer.id, customer, "displayName", e.target.value)}
                  className="mt-1 h-7 text-xs"
                  placeholder="Display name"
                />
              </div>

              {/* Color inputs */}
              <div className="flex items-center gap-2">
                <Input
                  value={edited.color}
                  onChange={(e) => updateEdit(customer.id, customer, "color", e.target.value)}
                  className="h-8 w-24 font-mono text-xs"
                  placeholder="#rrggbb"
                />
                <input
                  type="color"
                  value={isValidHex(edited.color) ? edited.color : customer.color}
                  onChange={(e) => updateEdit(customer.id, customer, "color", e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
              </div>

              {/* WCAG badge */}
              <Badge
                variant={wcagLevel === "Fail" ? "destructive" : "outline"}
                className={`shrink-0 text-xs ${
                  wcagLevel === "AAA"
                    ? "border-emerald-500 text-emerald-500"
                    : wcagLevel === "AA"
                      ? "border-amber-500 text-amber-500"
                      : ""
                }`}
              >
                {wcagLevel}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Reset Defaults dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Defaults?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will restore the original 6 customers to their default colors and names.
            Custom-added customers will not be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reset Defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Customer dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {addError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="e.g. Atlas Air"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={newCustomer.displayName}
                onChange={(e) => setNewCustomer({ ...newCustomer, displayName: e.target.value })}
                placeholder="e.g. Atlas"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newCustomer.color}
                  onChange={(e) => setNewCustomer({ ...newCustomer, color: e.target.value })}
                  className="font-mono"
                  placeholder="#rrggbb"
                />
                <input
                  type="color"
                  value={isValidHex(newCustomer.color) ? newCustomer.color : "#6b7280"}
                  onChange={(e) => setNewCustomer({ ...newCustomer, color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>
              <i className="fa-solid fa-plus mr-2" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
