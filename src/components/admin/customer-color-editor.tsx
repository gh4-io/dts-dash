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
  onEdit: (id: string, data: { name?: string; displayName?: string; color?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
}

interface EditState {
  [id: string]: { color: string; displayName: string };
}

interface EditFormData {
  name: string;
  displayName: string;
  color: string;
}

export function CustomerColorEditor({
  customers,
  onSave,
  onReset,
  onAdd,
  onEdit,
  onDelete,
  saving,
}: CustomerColorEditorProps) {
  const [edits, setEdits] = useState<EditState>({});
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", displayName: "", color: "#6b7280" });
  const [addError, setAddError] = useState<string | null>(null);

  // Edit dialog state
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({ name: "", displayName: "", color: "#6b7280" });
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);

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

  const openEditDialog = (customer: Customer) => {
    setEditFormData({
      name: customer.name,
      displayName: customer.displayName,
      color: customer.color,
    });
    setEditError(null);
    setEditCustomer(customer);
  };

  const handleEditSubmit = async () => {
    if (!editCustomer) return;
    setEditError(null);

    if (!editFormData.name.trim()) {
      setEditError("Name is required");
      return;
    }
    if (!editFormData.displayName.trim()) {
      setEditError("Display name is required");
      return;
    }
    if (!isValidHex(editFormData.color)) {
      setEditError("Invalid hex color");
      return;
    }

    // Build partial update with only changed fields
    const updates: { name?: string; displayName?: string; color?: string } = {};
    if (editFormData.name !== editCustomer.name) updates.name = editFormData.name;
    if (editFormData.displayName !== editCustomer.displayName) updates.displayName = editFormData.displayName;
    if (editFormData.color !== editCustomer.color) updates.color = editFormData.color;

    if (Object.keys(updates).length === 0) {
      setEditCustomer(null);
      return;
    }

    try {
      await onEdit(editCustomer.id, updates);
      setEditCustomer(null);
      // Clear any inline edits for this customer since we just saved via dialog
      const next = { ...edits };
      delete next[editCustomer.id];
      setEdits(next);
    } catch (err) {
      setEditError((err as Error).message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCustomer) return;
    try {
      await onDelete(deleteCustomer.id);
      setDeleteCustomer(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const activeCustomers = customers.filter((c) => c.isActive);

  // Preview for edit dialog
  const editPreviewColor = isValidHex(editFormData.color) ? editFormData.color : "#6b7280";
  const editContrastText = getContrastText(editPreviewColor);
  const editWcagLevel = getWCAGLevel(editPreviewColor, editContrastText);

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

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => openEditDialog(customer)}
                >
                  <i className="fa-solid fa-pen-to-square text-xs" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteCustomer(customer)}
                >
                  <i className="fa-solid fa-trash text-xs" />
                </Button>
              </div>
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

      {/* Edit Customer dialog */}
      <Dialog open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {editError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="e.g. Atlas Air"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={editFormData.displayName}
                onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                placeholder="e.g. Atlas"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={editFormData.color}
                  onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                  className="font-mono"
                  placeholder="#rrggbb"
                />
                <input
                  type="color"
                  value={editPreviewColor}
                  onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
              </div>
            </div>
            {/* WCAG preview */}
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-md border border-border"
                style={{ backgroundColor: editPreviewColor }}
              >
                <div
                  className="flex h-full items-center justify-center text-xs font-bold"
                  style={{ color: editContrastText }}
                >
                  Aa
                </div>
              </div>
              <Badge
                variant={editWcagLevel === "Fail" ? "destructive" : "outline"}
                className={`text-xs ${
                  editWcagLevel === "AAA"
                    ? "border-emerald-500 text-emerald-500"
                    : editWcagLevel === "AA"
                      ? "border-amber-500 text-amber-500"
                      : ""
                }`}
              >
                {editWcagLevel}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomer(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={saving}>
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation dialog */}
      <Dialog open={!!deleteCustomer} onOpenChange={(open) => !open && setDeleteCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will deactivate <span className="font-medium text-foreground">{deleteCustomer?.name}</span>.
            The customer will be hidden from all views but can be restored later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCustomer(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={saving}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
