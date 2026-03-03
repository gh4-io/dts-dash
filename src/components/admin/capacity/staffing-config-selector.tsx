"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { StaffingConfigSummary } from "@/types";

interface StaffingConfigSelectorProps {
  configs: StaffingConfigSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRefresh: () => void;
}

type DialogMode = "create" | "rename" | "duplicate" | null;

export function StaffingConfigSelector({
  configs,
  selectedId,
  onSelect,
  onRefresh,
}: StaffingConfigSelectorProps) {
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activateConfirm, setActivateConfirm] = useState(false);

  const selected = configs.find((c) => c.id === selectedId);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/capacity/staffing-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      onRefresh();
      onSelect(created.id);
      setDialogMode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!selectedId || !formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/capacity/staffing-configs/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onRefresh();
      setDialogMode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedId || !formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/capacity/staffing-configs/${selectedId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const dup = await res.json();
      onRefresh();
      onSelect(dup.id);
      setDialogMode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/capacity/staffing-configs/${selectedId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert((await res.json()).error || "Cannot delete");
      return;
    }
    setDeleteConfirm(false);
    const remaining = configs.filter((c) => c.id !== selectedId);
    onRefresh();
    if (remaining.length > 0) onSelect(remaining[0].id);
  };

  const handleActivate = async () => {
    if (!selectedId) return;
    await fetch(`/api/admin/capacity/staffing-configs/${selectedId}/activate`, {
      method: "POST",
    });
    setActivateConfirm(false);
    onRefresh();
  };

  const openDialog = (mode: DialogMode) => {
    setError(null);
    if (mode === "rename" && selected) {
      setFormName(selected.name);
      setFormDesc(selected.description ?? "");
    } else if (mode === "duplicate" && selected) {
      setFormName(`${selected.name} (Copy)`);
      setFormDesc("");
    } else {
      setFormName("");
      setFormDesc("");
    }
    setDialogMode(mode);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Config dropdown */}
      <Select value={selectedId?.toString() ?? ""} onValueChange={(v) => onSelect(parseInt(v, 10))}>
        <SelectTrigger className="h-8 w-52 text-xs">
          <SelectValue placeholder="Select config..." />
        </SelectTrigger>
        <SelectContent>
          {configs.map((c) => (
            <SelectItem key={c.id} value={c.id.toString()} className="text-xs">
              <span className="flex items-center gap-1.5">
                {c.name}
                {c.isActive && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active badge */}
      {selected?.isActive && (
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] px-1.5">
          Active
        </Badge>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 ml-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => openDialog("create")}
              >
                <i className="fa-solid fa-plus text-[10px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">New Config</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {selectedId && (
          <>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => openDialog("duplicate")}
                  >
                    <i className="fa-solid fa-copy text-[10px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Duplicate</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => openDialog("rename")}
                  >
                    <i className="fa-solid fa-pen text-[10px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Rename</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {!selected?.isActive && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-emerald-500"
                      onClick={() => setActivateConfirm(true)}
                    >
                      <i className="fa-solid fa-circle-check text-[10px]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Set as Active</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive/70 hover:text-destructive"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <i className="fa-solid fa-trash text-[10px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Delete Config</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>

      {/* Stats */}
      {selected && (
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            <i className="fa-solid fa-layer-group mr-1" />
            {selected.shiftCount} shifts
          </span>
          <span>
            <i className="fa-solid fa-users mr-1" />
            {selected.totalHeadcount} AMTs
          </span>
        </div>
      )}

      {/* Create / Rename / Duplicate Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dialogMode === "create" && "New Staffing Config"}
              {dialogMode === "rename" && "Rename Config"}
              {dialogMode === "duplicate" && "Duplicate Config"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. Summer 2026"
              />
            </div>
            {dialogMode !== "duplicate" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Description (optional)</Label>
                <Input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Notes about this config"
                />
              </div>
            )}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogMode(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving || !formName.trim()}
              onClick={
                dialogMode === "create"
                  ? handleCreate
                  : dialogMode === "rename"
                    ? handleRename
                    : handleDuplicate
              }
            >
              {saving && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
              {dialogMode === "create" && "Create"}
              {dialogMode === "rename" && "Save"}
              {dialogMode === "duplicate" && "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Config</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{selected?.name}&rdquo; and all its shifts? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate confirm */}
      <AlertDialog open={activateConfirm} onOpenChange={setActivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Config</AlertDialogTitle>
            <AlertDialogDescription>
              Set &ldquo;{selected?.name}&rdquo; as the active staffing config? Any previously
              active config will be deactivated. The capacity page will use this config in Advanced
              mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate}>Activate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
