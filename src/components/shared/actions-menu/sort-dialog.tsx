"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActions, ACTION_COLUMNS } from "@/lib/hooks/use-actions";
import type { SortLevel } from "@/lib/hooks/use-actions";

const MAX_LEVELS = 4;

function makeBlankLevel(): SortLevel {
  return { column: ACTION_COLUMNS[0].key, direction: "asc" };
}

interface SortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SortDialog({ open, onOpenChange }: SortDialogProps) {
  const { sorts, setSorts } = useActions();
  const [draft, setDraft] = useState<SortLevel[]>([]);

  // Hydrate draft when dialog opens — always show at least 1 row
  useEffect(() => {
    if (!open) return;
    setDraft(sorts.length > 0 ? sorts : [makeBlankLevel()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addLevel = () => {
    if (draft.length >= MAX_LEVELS) return;
    // Pick first unused column
    const usedCols = new Set(draft.map((s) => s.column));
    const available = ACTION_COLUMNS.find((c) => !usedCols.has(c.key));
    if (!available) return;
    setDraft([...draft, { column: available.key, direction: "asc" }]);
  };

  const removeLevel = (index: number) => {
    const next = draft.filter((_, i) => i !== index);
    setDraft(next.length > 0 ? next : [makeBlankLevel()]);
  };

  const updateColumn = (index: number, column: string) => {
    setDraft(draft.map((s, i) => (i === index ? { ...s, column } : s)));
  };

  const toggleDirection = (index: number) => {
    setDraft(
      draft.map((s, i) =>
        i === index ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" } : s,
      ),
    );
  };

  const handleApply = () => {
    setSorts(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fa-solid fa-arrow-down-short-wide text-muted-foreground" />
            Sort
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 min-h-[100px]">
          {draft.map((level, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 shrink-0 text-right">
                {idx + 1}.
              </span>
              <Select value={level.column} onValueChange={(v) => updateColumn(idx, v)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_COLUMNS.map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs w-16 shrink-0"
                onClick={() => toggleDirection(idx)}
              >
                <i
                  className={`fa-solid ${
                    level.direction === "asc"
                      ? "fa-arrow-up-short-wide"
                      : "fa-arrow-down-wide-short"
                  } mr-1`}
                />
                {level.direction === "asc" ? "ASC" : "DESC"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => removeLevel(idx)}
              >
                <i className="fa-solid fa-xmark text-xs" />
              </Button>
            </div>
          ))}

          {draft.length < MAX_LEVELS && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 mt-1"
              onClick={addLevel}
            >
              <i className="fa-solid fa-plus text-xs" />
              Add Level
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
