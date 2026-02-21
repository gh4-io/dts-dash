"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { RotationPatternEditor } from "./rotation-pattern-editor";
import type { RotationPattern } from "@/types";

interface RotationPatternListProps {
  patterns: RotationPattern[];
  onRefresh: () => void;
}

export function RotationPatternList({ patterns, onRefresh }: RotationPatternListProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<RotationPattern | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RotationPattern | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const sorted = [...patterns].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  const handleCreate = useCallback(
    async (data: { name: string; description: string | null; pattern: string }) => {
      const res = await fetch("/api/admin/capacity/rotation-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
      onRefresh();
    },
    [onRefresh],
  );

  const handleUpdate = useCallback(
    async (data: { name: string; description: string | null; pattern: string }) => {
      if (!editingPattern) return;
      const res = await fetch(`/api/admin/capacity/rotation-patterns/${editingPattern.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
      onRefresh();
    },
    [editingPattern, onRefresh],
  );

  const handleDelete = useCallback(
    async (p: RotationPattern) => {
      const res = await fetch(`/api/admin/capacity/rotation-patterns/${p.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert((await res.json()).error || "Failed to delete");
        return;
      }
      setDeleteTarget(null);
      onRefresh();
    },
    [onRefresh],
  );

  const handleToggleActive = useCallback(
    async (p: RotationPattern) => {
      await fetch(`/api/admin/capacity/rotation-patterns/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      onRefresh();
    },
    [onRefresh],
  );

  const handleBulkAction = useCallback(
    async (action: "activate" | "deactivate" | "delete") => {
      if (selectedIds.size === 0) return;
      setBulkLoading(true);
      try {
        await fetch("/api/admin/capacity/rotation-patterns/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids: [...selectedIds] }),
        });
        setSelectedIds(new Set());
        onRefresh();
      } finally {
        setBulkLoading(false);
      }
    },
    [selectedIds, onRefresh],
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-calendar-days text-xs text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rotations
          </h3>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {patterns.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => {
            setEditingPattern(undefined);
            setEditorOpen(true);
          }}
        >
          <i className="fa-solid fa-plus mr-1" />
          Add
        </Button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/50 border-b border-border text-xs shrink-0">
          <span className="text-muted-foreground">{selectedIds.size} selected</span>
          <div className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => handleBulkAction("activate")}
              disabled={bulkLoading}
            >
              Activate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => handleBulkAction("deactivate")}
              disabled={bulkLoading}
            >
              Hide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-destructive"
              onClick={() => handleBulkAction("delete")}
              disabled={bulkLoading}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Pattern list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <i className="fa-solid fa-calendar-xmark text-2xl mb-2" />
            <p className="text-xs">No rotation patterns</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((p) => {
              const isSelected = selectedIds.has(p.id);
              const workDays = p.pattern.split("").filter((c) => c === "x").length;

              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-accent/30 ${
                    !p.isActive ? "opacity-40" : ""
                  } ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    className={`w-3 h-3 rounded border transition-colors flex-shrink-0 ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30 hover:border-muted-foreground/60"
                    }`}
                    onClick={() => toggleSelect(p.id)}
                  >
                    {isSelected && (
                      <i className="fa-solid fa-check text-[6px] text-primary-foreground block text-center leading-[12px]" />
                    )}
                  </button>

                  {/* Inline dots + name */}
                  <RotationDots pattern={p.pattern} />
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs font-medium truncate min-w-0 flex-1 cursor-default">
                          {p.name}
                        </span>
                      </TooltipTrigger>
                      {p.description && (
                        <TooltipContent side="right" className="text-[10px] max-w-48">
                          {p.description}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>

                  <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                    {workDays}d
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => {
                        setEditingPattern(p);
                        setEditorOpen(true);
                      }}
                    >
                      <i className="fa-solid fa-pen-to-square text-[9px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => handleToggleActive(p)}
                    >
                      <i
                        className={`fa-solid ${p.isActive ? "fa-eye" : "fa-eye-slash"} text-[9px]`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-destructive/70 hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <i className="fa-solid fa-trash text-[9px]" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RotationPatternEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pattern={editingPattern}
        onSave={editingPattern ? handleUpdate : handleCreate}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rotation Pattern</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? Shifts using this pattern will show a
              missing-rotation warning.
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
