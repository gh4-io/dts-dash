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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { RotationDots } from "./rotation-dots";
import { RotationPatternEditor } from "./rotation-pattern-editor";
import type { RotationPattern } from "@/types";

/** Archived rows revealed per "Show more" click. */
const ARCHIVE_PAGE = 10;

interface RotationPatternListProps {
  patterns: RotationPattern[];
  onRefresh: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function RotationPatternList({
  patterns,
  onRefresh,
  collapsed,
  onToggleCollapse,
}: RotationPatternListProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<RotationPattern | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RotationPattern | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archiveLimit, setArchiveLimit] = useState(ARCHIVE_PAGE);

  // Archived versions are the effective-dated history the capacity engine reads
  // for past dates, so they accumulate indefinitely and must never be deleted.
  // They live in their own collapsed section rather than diluting the live list.
  const activePatterns = patterns
    .filter((p) => p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const archivedPatterns = patterns
    .filter((p) => !p.isActive)
    .sort((a, b) => (b.effectiveTo ?? "").localeCompare(a.effectiveTo ?? ""));

  const archiveMatches = archiveQuery.trim()
    ? archivedPatterns.filter((p) => {
        const q = archiveQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.effectiveFrom ?? "").includes(q) ||
          (p.effectiveTo ?? "").includes(q)
        );
      })
    : archivedPatterns;

  const archiveVisible = archiveMatches.slice(0, archiveLimit);

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

  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  /** One pattern row. Shared by the live list and the archive section. */
  const renderRow = (p: RotationPattern) => {
    const isSelected = selectedIds.has(p.id);

    return (
      <div
        key={p.id}
        className={`group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/30 cursor-pointer ${
          isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
        }`}
        onClick={() => {
          if (!selectMode) {
            setEditingPattern(p);
            setEditorOpen(true);
          }
        }}
      >
        {/* Checkbox (select mode only) */}
        {selectMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`w-4 h-4 rounded-sm border-[1.5px] transition-colors flex-shrink-0 flex items-center justify-center ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/30 hover:border-muted-foreground/60"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelect(p.id);
                }}
              >
                {isSelected && (
                  <i className="fa-solid fa-check text-[9px] text-primary-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px]">
              {isSelected ? "Deselect" : "Select"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Name */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs font-medium truncate min-w-0 flex-1 cursor-pointer">
              {p.name}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-[10px] max-w-52">
            <div className="font-medium">{p.name}</div>
            {p.description && <div className="text-muted-foreground mt-0.5">{p.description}</div>}
          </TooltipContent>
        </Tooltip>

        {/* Effective window — the reason archived versions are kept */}
        {!p.isActive && (p.effectiveFrom || p.effectiveTo) && (
          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
            {p.effectiveFrom ?? "—"}
            {p.effectiveTo ? ` → ${p.effectiveTo}` : ""}
          </span>
        )}

        {/* Dots inline (all 21 in a row, 8px outlined) */}
        <Tooltip>
          <TooltipTrigger asChild>
            {/* The 21-dot strip is the widest element in the row.
                Below 2xl it goes; the pattern stays reachable via
                the tooltip and the editor. */}
            <span className="shrink-0 hidden 2xl:inline-block">
              <RotationDots pattern={p.pattern} size="inline" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px] font-mono tracking-wider">
            {p.pattern}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full">
        {/* Header */}
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
            <i className="fa-solid fa-calendar-days text-xs text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rotations
            </h3>
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {patterns.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  aria-label="New rotation pattern"
                  onClick={() => {
                    setEditingPattern(undefined);
                    setEditorOpen(true);
                  }}
                >
                  {/* Below 2xl the panel is narrow — drop to a bare "+" */}
                  <i className="fa-solid fa-plus 2xl:mr-1" />
                  <span className="hidden 2xl:inline">Add</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                New rotation pattern
              </TooltipContent>
            </Tooltip>
            {/* Bulk select needs the room to be useful — hidden on narrow widths.
                Kept mounted-when-active so an in-progress selection is never
                stranded by a resize. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={selectMode ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-6 px-2 text-xs ${selectMode ? "bg-accent" : "hidden 2xl:inline-flex"}`}
                  onClick={toggleSelectMode}
                >
                  Select
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                Toggle selection mode
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Collapsible content — hidden on mobile when collapsed, always visible on lg+ */}
        <div className={collapsed ? "hidden lg:contents" : "contents"}>
          {/* Bulk actions */}
          {selectMode && selectedIds.size > 0 && (
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
            {activePatterns.length === 0 && archivedPatterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <i className="fa-solid fa-calendar-xmark text-2xl mb-2" />
                <p className="text-xs">No rotation patterns</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activePatterns.map((p) => renderRow(p))}
              </div>
            )}

            {/* Archive section — never pruned, so it needs search and paging */}
            {archivedPatterns.length > 0 && (
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
                      Archive ({archivedPatterns.length})
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pt-2 pb-1 space-y-2">
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Archived versions are retained permanently — historical capacity is calculated
                      from them.
                    </p>
                    {archivedPatterns.length > ARCHIVE_PAGE && (
                      <Input
                        value={archiveQuery}
                        onChange={(e) => {
                          setArchiveQuery(e.target.value);
                          setArchiveLimit(ARCHIVE_PAGE);
                        }}
                        placeholder="Search archive by name or date…"
                        className="h-7 text-xs"
                      />
                    )}
                  </div>
                  <div className="divide-y divide-border opacity-70">
                    {archiveVisible.map((p) => renderRow(p))}
                  </div>
                  {archiveMatches.length === 0 && (
                    <p className="px-3 py-3 text-[10px] text-muted-foreground">
                      No archived patterns match &ldquo;{archiveQuery}&rdquo;.
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
          </div>
        </div>

        <RotationPatternEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          pattern={editingPattern}
          onSave={editingPattern ? handleUpdate : handleCreate}
          onToggleActive={
            editingPattern
              ? async () => {
                  await handleToggleActive(editingPattern);
                }
              : undefined
          }
          onDelete={
            editingPattern
              ? () => {
                  setDeleteTarget(editingPattern);
                }
              : undefined
          }
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
    </TooltipProvider>
  );
}
