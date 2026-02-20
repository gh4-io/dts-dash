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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFilters } from "@/lib/hooks/use-filters";
import {
  useActions,
  ACTION_COLUMNS,
  type ColumnFilterRule,
  type ActionColumnKey,
} from "@/lib/hooks/use-actions";
import { useWorkPackagesStore } from "@/lib/hooks/use-work-packages";
import { getUniqueValues } from "@/lib/utils/data-transforms";
import type { AircraftType } from "@/types";

// ─── Operator sets by column type ───

const STRING_OPERATORS = ["=", "!=", "in", "not in"] as const;
const NUMBER_OPERATORS = ["=", "!=", ">", "<", ">=", "<="] as const;
const DATE_OPERATORS = [">", "<", ">=", "<="] as const;

type FilterOperator = ColumnFilterRule["operator"];

function getOperatorsForType(
  type: "string" | "number" | "date"
): readonly FilterOperator[] {
  switch (type) {
    case "string":
      return STRING_OPERATORS;
    case "number":
      return NUMBER_OPERATORS;
    case "date":
      return DATE_OPERATORS;
  }
}

function getColumnType(key: ActionColumnKey): "string" | "number" | "date" {
  return ACTION_COLUMNS.find((c) => c.key === key)?.type ?? "string";
}

/** API-level filter columns that bridge to useFilters */
const API_COLUMNS = new Set<ActionColumnKey>([
  "customer",
  "aircraftReg",
  "inferredType",
]);

let ruleIdCounter = 0;
function nextRuleId(): string {
  return `cfr_${Date.now()}_${ruleIdCounter++}`;
}

function makeBlankRule(): ColumnFilterRule {
  return {
    id: nextRuleId(),
    column: "customer",
    operator: "=",
    value: "",
    values: [],
  };
}

// ─── Component ───

interface ColumnsFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ColumnsFilterDialog({
  open,
  onOpenChange,
}: ColumnsFilterDialogProps) {
  const {
    operators,
    aircraft,
    types,
    setOperators,
    setAircraft,
    setTypes,
  } = useFilters();
  const { columnFilters, setColumnFilters } = useActions();
  const { workPackages } = useWorkPackagesStore();
  const [draft, setDraft] = useState<ColumnFilterRule[]>([]);

  // ─── Hydrate draft when dialog opens ───
  useEffect(() => {
    if (!open) return;
    const rules: ColumnFilterRule[] = [];

    // Hydrate from useFilters API columns
    if (operators.length > 0) {
      rules.push({
        id: nextRuleId(),
        column: "customer",
        operator: "in",
        value: "",
        values: [...operators],
      });
    }
    if (aircraft.length > 0) {
      rules.push({
        id: nextRuleId(),
        column: "aircraftReg",
        operator: "in",
        value: "",
        values: [...aircraft],
      });
    }
    if (types.length > 0) {
      rules.push({
        id: nextRuleId(),
        column: "inferredType",
        operator: "in",
        value: "",
        values: [...types],
      });
    }

    // Hydrate from columnFilters (non-API rules)
    rules.push(...columnFilters.map((r) => ({ ...r })));

    // Always at least 1 row
    if (rules.length === 0) {
      rules.push(makeBlankRule());
    }

    setDraft(rules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Memoize unique values per column used in draft
  const uniqueValuesCache = useMemo(() => {
    const cache = new Map<ActionColumnKey, string[]>();
    const columnsInUse = new Set(draft.map((r) => r.column));
    for (const col of columnsInUse) {
      cache.set(col, getUniqueValues(workPackages, col));
    }
    return cache;
  }, [workPackages, draft]);

  const getValues = (col: ActionColumnKey): string[] =>
    uniqueValuesCache.get(col) ?? getUniqueValues(workPackages, col);

  const addRule = () => {
    setDraft([...draft, makeBlankRule()]);
  };

  const removeRule = (id: string) => {
    const next = draft.filter((r) => r.id !== id);
    // Always keep at least 1 row visible
    setDraft(next.length > 0 ? next : [makeBlankRule()]);
  };

  const updateRule = (id: string, updates: Partial<ColumnFilterRule>) => {
    setDraft(
      draft.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const handleColumnChange = (id: string, newColumn: ActionColumnKey) => {
    const newType = getColumnType(newColumn);
    const ops = getOperatorsForType(newType);
    updateRule(id, {
      column: newColumn,
      operator: ops[0],
      value: "",
      values: [],
    });
  };

  const handleOperatorChange = (id: string, newOp: FilterOperator) => {
    updateRule(id, {
      operator: newOp,
      value: "",
      values: [],
    });
  };

  // ─── Apply: split rules into API columns → useFilters, rest → columnFilters ───
  const handleApply = () => {
    const apiOps: string[] = [];
    const apiAircraft: string[] = [];
    const apiTypes: string[] = [];
    const remaining: ColumnFilterRule[] = [];

    for (const rule of draft) {
      // Skip blank rules
      if (
        (rule.operator === "in" || rule.operator === "not in") &&
        rule.values.length === 0
      )
        continue;
      if (
        rule.operator !== "in" &&
        rule.operator !== "not in" &&
        !rule.value
      )
        continue;

      if (
        API_COLUMNS.has(rule.column) &&
        (rule.operator === "=" || rule.operator === "in")
      ) {
        // Bridge to useFilters
        const vals =
          rule.operator === "in" ? rule.values : [rule.value];
        switch (rule.column) {
          case "customer":
            apiOps.push(...vals);
            break;
          case "aircraftReg":
            apiAircraft.push(...vals);
            break;
          case "inferredType":
            apiTypes.push(...vals);
            break;
        }
      } else {
        remaining.push(rule);
      }
    }

    setOperators(apiOps);
    setAircraft(apiAircraft);
    setTypes(apiTypes as AircraftType[]);
    setColumnFilters(remaining);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fa-solid fa-filter text-muted-foreground" />
            Column Filters
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 min-h-[80px] max-h-[360px] overflow-y-auto px-0.5">
          {draft.map((rule) => {
            const colType = getColumnType(rule.column);
            const ops = getOperatorsForType(colType);
            const isSet =
              rule.operator === "in" || rule.operator === "not in";

            return (
              <div
                key={rule.id}
                className="flex items-center gap-1.5"
              >
                {/* Column — ~33% */}
                <Select
                  value={rule.column}
                  onValueChange={(v) =>
                    handleColumnChange(rule.id, v as ActionColumnKey)
                  }
                >
                  <SelectTrigger className="h-8 text-xs flex-[1_1_33%] min-w-0">
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

                {/* Operator — fixed max width */}
                <Select
                  value={rule.operator}
                  onValueChange={(v) =>
                    handleOperatorChange(rule.id, v as FilterOperator)
                  }
                >
                  <SelectTrigger className="h-8 text-xs w-[80px] max-w-[80px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ops.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value input — ~33%, adapts to column type + operator */}
                {isSet ? (
                  <div className="flex-[1_1_33%] min-w-0">
                    <SetValuePicker
                      values={rule.values}
                      options={getValues(rule.column)}
                      onChange={(vals) =>
                        updateRule(rule.id, { values: vals })
                      }
                    />
                  </div>
                ) : colType === "string" ? (
                  <Select
                    value={rule.value}
                    onValueChange={(v) =>
                      updateRule(rule.id, { value: v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs flex-[1_1_33%] min-w-0">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getValues(rule.column).map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : colType === "number" ? (
                  <Input
                    type="number"
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(rule.id, { value: e.target.value })
                    }
                    placeholder="Value"
                    className="h-8 text-xs flex-[1_1_33%] min-w-0"
                  />
                ) : (
                  <Input
                    type="datetime-local"
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(rule.id, { value: e.target.value })
                    }
                    className="h-8 text-xs flex-[1_1_33%] min-w-0"
                  />
                )}

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
            Add Filter
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

// ─── Set Value Picker (Popover with checkboxes) ───

function SetValuePicker({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(
      values.includes(val)
        ? values.filter((v) => v !== val)
        : [...values, val]
    );
  };

  const label =
    values.length === 0
      ? "Select..."
      : values.length === 1
        ? values[0]
        : `${values.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <i className="fa-solid fa-chevron-down text-[10px] ml-1 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={values.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-border"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No values
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
