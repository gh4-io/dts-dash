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
import type { GroupByConfig } from "@/lib/hooks/use-actions";

/** Only string columns for group-by */
const GROUP_COLUMNS = ACTION_COLUMNS.filter((c) => c.type === "string");

interface GroupByDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupByDialog({ open, onOpenChange }: GroupByDialogProps) {
  const { groupBy, setGroupBy } = useActions();
  const [draft, setDraft] = useState<string[]>([]);

  // Hydrate draft when dialog opens
  useEffect(() => {
    if (!open) return;
    const existing = groupBy?.columns ?? [];
    setDraft(existing.length > 0 ? [...existing] : [GROUP_COLUMNS[0].key]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addGroup = () => {
    const used = new Set(draft);
    const available = GROUP_COLUMNS.find((c) => !used.has(c.key));
    if (!available) return;
    setDraft([...draft, available.key]);
  };

  const removeGroup = (index: number) => {
    setDraft(draft.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, key: string) => {
    setDraft(draft.map((k, i) => (i === index ? key : k)));
  };

  const handleApply = () => {
    if (draft.length === 0) {
      setGroupBy(null);
    } else {
      setGroupBy({ columns: draft } as GroupByConfig);
    }
    onOpenChange(false);
  };

  const allUsed = draft.length >= GROUP_COLUMNS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fa-solid fa-layer-group text-muted-foreground" />
            Group By
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 min-h-[80px]">
          {draft.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No groups. Click &quot;Add Group&quot; to begin.
            </p>
          )}

          {draft.map((colKey, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={colKey}
                onValueChange={(v) => updateColumn(idx, v)}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_COLUMNS.map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => removeGroup(idx)}
              >
                <i className="fa-solid fa-xmark text-xs" />
              </Button>
            </div>
          ))}

          {!allUsed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 mt-1"
              onClick={addGroup}
            >
              <i className="fa-solid fa-plus text-xs" />
              Add Group
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
