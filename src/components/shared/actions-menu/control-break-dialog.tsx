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
import type { ControlBreak } from "@/lib/hooks/use-actions";

/** Only string columns make sense for control breaks */
const BREAK_COLUMNS = ACTION_COLUMNS.filter((c) => c.type === "string");

interface ControlBreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ControlBreakDialog({
  open,
  onOpenChange,
}: ControlBreakDialogProps) {
  const { controlBreaks, setControlBreaks } = useActions();
  const [draft, setDraft] = useState<ControlBreak[]>([]);

  // Hydrate draft when dialog opens
  useEffect(() => {
    if (!open) return;
    if (controlBreaks.length === 0) {
      setDraft([{ column: BREAK_COLUMNS[0].key, enabled: true }]);
    } else {
      setDraft(controlBreaks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addBreak = () => {
    const usedCols = new Set(draft.map((b) => b.column));
    const available = BREAK_COLUMNS.find((c) => !usedCols.has(c.key));
    if (!available) return;
    setDraft([...draft, { column: available.key, enabled: true }]);
  };

  const removeBreak = (index: number) => {
    setDraft(draft.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, column: string) => {
    setDraft(draft.map((b, i) => (i === index ? { ...b, column } : b)));
  };

  const toggleEnabled = (index: number) => {
    setDraft(
      draft.map((b, i) => (i === index ? { ...b, enabled: !b.enabled } : b))
    );
  };

  const handleApply = () => {
    setControlBreaks(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fa-solid fa-grip-lines text-muted-foreground" />
            Control Break
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 min-h-[80px]">
          {draft.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No breaks defined. Click &quot;Add Break&quot; to create visual
              group separators.
            </p>
          )}

          {draft.map((brk, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={brk.column}
                onValueChange={(v) => updateColumn(idx, v)}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREAK_COLUMNS.map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={brk.enabled ? "default" : "outline"}
                size="sm"
                className="h-8 px-2 text-xs shrink-0"
                onClick={() => toggleEnabled(idx)}
              >
                {brk.enabled ? "On" : "Off"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => removeBreak(idx)}
              >
                <i className="fa-solid fa-xmark text-xs" />
              </Button>
            </div>
          ))}

          {draft.length < BREAK_COLUMNS.length && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 mt-1"
              onClick={addBreak}
            >
              <i className="fa-solid fa-plus text-xs" />
              Add Break
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
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
