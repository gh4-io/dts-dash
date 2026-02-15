"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActions, ACTION_COLUMNS } from "@/lib/hooks/use-actions";
import { useWorkPackagesStore } from "@/lib/hooks/use-work-packages";
import { getUniqueValues } from "@/lib/utils/data-transforms";
import type { HighlightRule, ActionColumnKey } from "@/lib/hooks/use-actions";

const OPERATORS = ["=", "!=", ">", "<", ">=", "<="] as const;

const PRESET_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
];

let ruleIdCounter = 0;
function nextRuleId(): string {
  return `rule_${Date.now()}_${ruleIdCounter++}`;
}

interface HighlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HighlightDialog({ open, onOpenChange }: HighlightDialogProps) {
  const { highlights, setHighlights } = useActions();
  const { workPackages } = useWorkPackagesStore();
  const [draft, setDraft] = useState<HighlightRule[]>([]);

  // Hydrate draft when dialog opens
  useEffect(() => {
    if (!open) return;
    setDraft(highlights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Memoize unique values for string columns used in draft
  const uniqueValuesCache = useMemo(() => {
    const cache = new Map<string, string[]>();
    const cols = new Set(
      draft
        .map((r) => r.column)
        .filter((c) => {
          const col = ACTION_COLUMNS.find((ac) => ac.key === c);
          return col?.type === "string";
        })
    );
    for (const col of cols) {
      cache.set(col, getUniqueValues(workPackages, col as ActionColumnKey));
    }
    return cache;
  }, [workPackages, draft]);

  const addRule = () => {
    setDraft([
      ...draft,
      {
        id: nextRuleId(),
        column: "status",
        operator: "=",
        value: "",
        color: PRESET_COLORS[0].value,
        enabled: true,
      },
    ]);
  };

  const removeRule = (id: string) => {
    setDraft(draft.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<HighlightRule>) => {
    setDraft(draft.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleColumnChange = (id: string, newColumn: string) => {
    updateRule(id, { column: newColumn, value: "" });
  };

  const handleApply = () => {
    setHighlights(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fa-solid fa-highlighter text-muted-foreground" />
            Highlight Rules
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 min-h-[80px] max-h-[360px] overflow-y-auto">
          {draft.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No highlight rules. Click &quot;Add Rule&quot; to apply
              conditional colors.
            </p>
          )}

          {draft.map((rule) => {
            const colDef = ACTION_COLUMNS.find((c) => c.key === rule.column);
            const colType = colDef?.type ?? "string";
            const isString = colType === "string";
            const uniqueVals = isString
              ? uniqueValuesCache.get(rule.column) ?? []
              : [];

            return (
              <div key={rule.id} className="flex items-center gap-1.5 flex-wrap">
                {/* Column */}
                <Select
                  value={rule.column}
                  onValueChange={(v) => handleColumnChange(rule.id, v)}
                >
                  <SelectTrigger className="h-8 text-xs w-[100px]">
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

                {/* Operator */}
                <Select
                  value={rule.operator}
                  onValueChange={(v) =>
                    updateRule(rule.id, {
                      operator: v as HighlightRule["operator"],
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs w-[60px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value — dropdown for strings, input for number/date */}
                {isString ? (
                  <Select
                    value={rule.value}
                    onValueChange={(v) => updateRule(rule.id, { value: v })}
                  >
                    <SelectTrigger className="h-8 text-xs w-[100px]">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueVals.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={colType === "number" ? "number" : "datetime-local"}
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(rule.id, { value: e.target.value })
                    }
                    placeholder="Value"
                    className="h-8 text-xs w-[100px]"
                  />
                )}

                {/* Color swatches */}
                <div className="flex items-center gap-0.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => updateRule(rule.id, { color: c.value })}
                      className={`h-6 w-6 rounded border-2 shrink-0 ${
                        rule.color === c.value
                          ? "border-foreground"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={rule.color}
                    onChange={(e) =>
                      updateRule(rule.id, { color: e.target.value })
                    }
                    className="h-6 w-6 rounded border border-border cursor-pointer shrink-0"
                    title="Custom color"
                  />
                </div>

                {/* Enable/disable */}
                <Button
                  variant={rule.enabled ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 text-xs shrink-0"
                  onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                >
                  {rule.enabled ? "On" : "Off"}
                </Button>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => removeRule(rule.id)}
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </Button>
              </div>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 mt-1"
            onClick={addRule}
          >
            <i className="fa-solid fa-plus text-xs" />
            Add Rule
          </Button>
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
