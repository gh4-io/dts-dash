"use client";

import { Badge } from "@/components/ui/badge";

export interface ActiveChip {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  onRemove?: () => void;
}

interface ActiveChipsProps {
  chips: ActiveChip[];
  onClearAll?: () => void;
}

export function ActiveChips({ chips, onClearAll }: ActiveChipsProps) {
  if (chips.length === 0) return null;

  const hasRemovable = chips.some((c) => c.onRemove);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {chips.map((chip) => (
        <Badge
          key={chip.id}
          variant="secondary"
          className="shrink-0 gap-1.5 text-xs font-normal h-6 px-2"
        >
          {chip.color && (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: chip.color }}
            />
          )}
          {chip.icon && (
            <i className={`${chip.icon} text-[9px] text-muted-foreground`} />
          )}
          <span>{chip.label}</span>
          {chip.onRemove && (
            <button
              onClick={chip.onRemove}
              className="ml-0.5 hover:text-destructive"
            >
              <i className="fa-solid fa-xmark text-[9px]" />
            </button>
          )}
        </Badge>
      ))}
      {hasRemovable && onClearAll && (
        <button
          onClick={onClearAll}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground ml-1"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
