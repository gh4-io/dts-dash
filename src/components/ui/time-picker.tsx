"use client";

import * as React from "react";
import { Clock, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimePickerProps {
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  onSelect?: (date: Date) => void;
  /** Display format. Controls which columns appear.
   *  - "HH:mm"      → 24h hours + minutes (default)
   *  - "HH:mm:ss"   → 24h hours + minutes + seconds
   *  - "hh:mm a"    → 12h hours + minutes + AM/PM
   *  - "hh:mm:ss a" → 12h hours + minutes + seconds + AM/PM
   */
  format?: string;
  /** Show AM/PM column. Auto-detected from `format` when not set. */
  showMeridiem?: boolean;
  /** Show seconds column. Auto-detected from `format` when not set. */
  showSeconds?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Show clear button when a value is present. Default `true`. */
  cleanable?: boolean;
  /** Allow typing directly in the input. Default `true`. */
  editable?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Hide specific hours from the column. */
  hideHours?: (hour: number) => boolean;
  /** Hide specific minutes from the column. */
  hideMinutes?: (minute: number) => boolean;
  /** Hide specific seconds from the column. */
  hideSeconds?: (second: number) => boolean;
  /** Disable (but still show) specific hours. */
  disabledHours?: (hour: number) => boolean;
  /** Disable (but still show) specific minutes. */
  disabledMinutes?: (minute: number) => boolean;
  /** Disable (but still show) specific seconds. */
  disabledSeconds?: (second: number) => boolean;
  /** Range shortcuts displayed in the footer. */
  ranges?: Array<{ label: string; value: Date }>;
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

interface FormatConfig {
  is12h: boolean;
  showSeconds: boolean;
  showMeridiem: boolean;
}

function parseFormat(
  format: string,
  showSecondsProp?: boolean,
  showMeridiemProp?: boolean,
): FormatConfig {
  const is12h = /h/.test(format) && !/H/.test(format);
  const hasSeconds =
    showSecondsProp !== undefined ? showSecondsProp : /s/.test(format);
  const hasMeridiem =
    showMeridiemProp !== undefined ? showMeridiemProp : is12h || /a/i.test(format);
  return { is12h, showSeconds: hasSeconds, showMeridiem: hasMeridiem };
}

/** Format a Date for display in the trigger input. */
function formatTime(date: Date | null | undefined, cfg: FormatConfig): string {
  if (!date) return "";
  let h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();

  if (cfg.is12h) {
    const period = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const hStr = h.toString().padStart(2, "0");
    const mStr = m.toString().padStart(2, "0");
    if (cfg.showSeconds) {
      const sStr = s.toString().padStart(2, "0");
      return `${hStr}:${mStr}:${sStr} ${period}`;
    }
    return `${hStr}:${mStr} ${period}`;
  }

  const hStr = h.toString().padStart(2, "0");
  const mStr = m.toString().padStart(2, "0");
  if (cfg.showSeconds) {
    const sStr = s.toString().padStart(2, "0");
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${hStr}:${mStr}`;
}

/** Attempt to parse a user-typed string back to a Date. Returns null on failure. */
function parseTimeString(text: string, cfg: FormatConfig): Date | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Try 12h pattern: HH:MM[:SS] AM/PM
  if (cfg.is12h || cfg.showMeridiem) {
    const match12 = trimmed.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
    );
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const s = match12[3] ? parseInt(match12[3], 10) : 0;
      const period = match12[4].toUpperCase() as "AM" | "PM";
      if (h < 1 || h > 12 || m > 59 || s > 59) return null;
      if (period === "AM" && h === 12) h = 0;
      else if (period === "PM" && h !== 12) h += 12;
      const d = new Date();
      d.setHours(h, m, s, 0);
      return d;
    }
  }

  // Try 24h pattern: HH:MM[:SS]
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    const s = match24[3] ? parseInt(match24[3], 10) : 0;
    if (h > 23 || m > 59 || s > 59) return null;
    const d = new Date();
    d.setHours(h, m, s, 0);
    return d;
  }

  return null;
}

// ---------------------------------------------------------------------------
// TimeColumn (internal)
// ---------------------------------------------------------------------------

interface TimeColumnItem {
  value: number | string;
  label: string;
  disabled?: boolean;
}

interface TimeColumnProps {
  title: string;
  items: TimeColumnItem[];
  selectedValue: number | string;
  onSelect: (value: number | string) => void;
  isLast?: boolean;
}

function TimeColumn({
  title,
  items,
  selectedValue,
  onSelect,
  isLast = false,
}: TimeColumnProps) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const selectedRef = React.useRef<HTMLLIElement>(null);

  // Scroll selected item into center whenever the value changes or list mounts.
  React.useEffect(() => {
    // Small delay so the DOM has settled (especially on popover open).
    const frame = requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedValue]);

  return (
    <div
      className={cn("flex flex-col min-w-0 flex-1", !isLast && "border-r")}
    >
      {/* Column header */}
      <div className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground border-b select-none">
        {title}
      </div>

      {/* Scrollable list */}
      <ul
        ref={listRef}
        role="listbox"
        aria-label={title}
        className="h-[230px] overflow-y-auto overscroll-contain py-1 scroll-smooth [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {items.map((item) => {
          const isSelected = item.value === selectedValue;
          const isDisabled = !!item.disabled;
          return (
            <li
              key={item.value}
              ref={isSelected ? selectedRef : undefined}
              role="option"
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              aria-label={`${item.label} ${title.toLowerCase()}`}
              tabIndex={-1}
              onClick={() => {
                if (!isDisabled) onSelect(item.value);
              }}
              className={cn(
                "mx-1 cursor-pointer select-none rounded-md px-3 py-1.5 text-center text-sm font-mono tabular-nums transition-colors",
                isSelected &&
                  "bg-primary text-primary-foreground",
                !isSelected &&
                  !isDisabled &&
                  "hover:bg-accent hover:text-accent-foreground",
                isDisabled &&
                  "opacity-30 cursor-not-allowed line-through",
              )}
            >
              {item.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimePicker
// ---------------------------------------------------------------------------

function TimePicker({
  value: valueProp,
  defaultValue,
  onChange,
  onSelect,
  format = "HH:mm",
  showMeridiem: showMeridiemProp,
  showSeconds: showSecondsProp,
  placeholder,
  disabled = false,
  cleanable = true,
  editable = true,
  size = "md",
  className,
  hideHours,
  hideMinutes,
  hideSeconds,
  disabledHours,
  disabledMinutes,
  disabledSeconds,
  ranges,
}: TimePickerProps) {
  // ------- format config -------
  const cfg = React.useMemo(
    () => parseFormat(format, showSecondsProp, showMeridiemProp),
    [format, showSecondsProp, showMeridiemProp],
  );

  // ------- controlled / uncontrolled -------
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = React.useState<Date | null>(
    defaultValue ?? null,
  );
  const currentValue = isControlled ? (valueProp ?? null) : internalValue;

  const commitValue = React.useCallback(
    (next: Date | null) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  // ------- popover state -------
  const [open, setOpen] = React.useState(false);

  // Pending state while popover is open — committed on OK.
  const [pendingHour, setPendingHour] = React.useState(0);
  const [pendingMinute, setPendingMinute] = React.useState(0);
  const [pendingSecond, setPendingSecond] = React.useState(0);
  const [pendingMeridiem, setPendingMeridiem] = React.useState<"AM" | "PM">(
    "AM",
  );

  // Initialise pending from current value when popover opens.
  React.useEffect(() => {
    if (open) {
      const src = currentValue ?? new Date();
      const h = src.getHours();
      if (cfg.is12h) {
        setPendingMeridiem(h >= 12 ? "PM" : "AM");
        setPendingHour(h % 12 || 12);
      } else {
        setPendingHour(h);
      }
      setPendingMinute(src.getMinutes());
      setPendingSecond(src.getSeconds());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Build a Date from pending values.
  const buildPendingDate = React.useCallback((): Date => {
    const d = new Date(currentValue ?? new Date());
    let h = pendingHour;
    if (cfg.is12h) {
      if (pendingMeridiem === "AM" && h === 12) h = 0;
      else if (pendingMeridiem === "PM" && h !== 12) h += 12;
    }
    d.setHours(h, pendingMinute, pendingSecond, 0);
    return d;
  }, [currentValue, pendingHour, pendingMinute, pendingSecond, pendingMeridiem, cfg.is12h]);

  // Fire onSelect whenever pending changes (for live preview consumers).
  React.useEffect(() => {
    if (open) {
      onSelect?.(buildPendingDate());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHour, pendingMinute, pendingSecond, pendingMeridiem]);

  // ------- OK / Confirm -------
  const handleConfirm = () => {
    commitValue(buildPendingDate());
    setOpen(false);
  };

  // ------- Now shortcut -------
  const handleNow = () => {
    const now = new Date();
    const h = now.getHours();
    if (cfg.is12h) {
      setPendingMeridiem(h >= 12 ? "PM" : "AM");
      setPendingHour(h % 12 || 12);
    } else {
      setPendingHour(h);
    }
    setPendingMinute(now.getMinutes());
    setPendingSecond(now.getSeconds());
  };

  // ------- Clear -------
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    commitValue(null);
    setInputText("");
  };

  // ------- Editable input -------
  const [inputText, setInputText] = React.useState("");
  const [isEditing, setIsEditing] = React.useState(false);

  const displayText = React.useMemo(
    () => formatTime(currentValue, cfg),
    [currentValue, cfg],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseTimeString(inputText, cfg);
    if (parsed) {
      commitValue(parsed);
    }
    setInputText("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setInputText("");
    }
  };

  // ------- Column data builders -------
  const hourItems = React.useMemo((): TimeColumnItem[] => {
    const start = cfg.is12h ? 1 : 0;
    const end = cfg.is12h ? 12 : 23;
    const items: TimeColumnItem[] = [];
    for (let i = start; i <= end; i++) {
      if (hideHours?.(i)) continue;
      items.push({
        value: i,
        label: i.toString().padStart(2, "0"),
        disabled: disabledHours?.(i),
      });
    }
    return items;
  }, [cfg.is12h, hideHours, disabledHours]);

  const minuteItems = React.useMemo((): TimeColumnItem[] => {
    const items: TimeColumnItem[] = [];
    for (let i = 0; i <= 59; i++) {
      if (hideMinutes?.(i)) continue;
      items.push({
        value: i,
        label: i.toString().padStart(2, "0"),
        disabled: disabledMinutes?.(i),
      });
    }
    return items;
  }, [hideMinutes, disabledMinutes]);

  const secondItems = React.useMemo((): TimeColumnItem[] => {
    const items: TimeColumnItem[] = [];
    for (let i = 0; i <= 59; i++) {
      if (hideSeconds?.(i)) continue;
      items.push({
        value: i,
        label: i.toString().padStart(2, "0"),
        disabled: disabledSeconds?.(i),
      });
    }
    return items;
  }, [hideSeconds, disabledSeconds]);

  const meridiemItems: TimeColumnItem[] = [
    { value: "AM", label: "AM" },
    { value: "PM", label: "PM" },
  ];

  // ------- Size variants -------
  const sizeClasses = {
    sm: "h-8 text-xs",
    md: "h-9 text-sm",
    lg: "h-10 text-base",
  };

  const iconSizeClasses = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-4",
  };

  // ------- Determine column count for popover width -------
  let columnCount = 2; // hours + minutes
  if (cfg.showSeconds) columnCount++;
  if (cfg.showMeridiem) columnCount++;
  // Each column gets roughly 72px
  const popoverWidth = columnCount * 72;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <div
          className={cn(
            "group relative inline-flex items-center gap-2 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] cursor-pointer",
            "border-input dark:bg-input/30",
            "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
            sizeClasses[size],
            disabled && "pointer-events-none opacity-50",
            className,
          )}
        >
          {/* Clock icon */}
          <span className="pointer-events-none pl-3 text-muted-foreground">
            <Clock className={iconSizeClasses[size]} />
          </span>

          {/* Input / display */}
          {editable && !disabled ? (
            <input
              type="text"
              className={cn(
                "flex-1 min-w-0 bg-transparent outline-none font-mono tabular-nums",
                "placeholder:text-muted-foreground",
                sizeClasses[size],
                // Remove the h-* from sizeClasses since it's on the wrapper
                "!h-auto py-0",
              )}
              placeholder={placeholder ?? format}
              value={isEditing ? inputText : displayText}
              onChange={handleInputChange}
              onFocus={(e) => {
                setIsEditing(true);
                setInputText(displayText);
                // Prevent the popover from opening when focusing the input for typing
                e.stopPropagation();
              }}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              readOnly={!editable}
              disabled={disabled}
            />
          ) : (
            <span
              className={cn(
                "flex-1 min-w-0 font-mono tabular-nums truncate",
                !currentValue && "text-muted-foreground",
              )}
            >
              {displayText || placeholder || format}
            </span>
          )}

          {/* Clear button */}
          {cleanable && currentValue && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="pr-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
              aria-label="Clear time"
            >
              <X className={iconSizeClasses[size]} />
            </button>
          )}

          {/* Invisible padding when clear button is hidden */}
          {(!cleanable || !currentValue || disabled) && (
            <span className="pr-3" />
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="p-0"
        style={{ width: `${popoverWidth}px` }}
        align="start"
        onOpenAutoFocus={(e) => {
          // Prevent auto-focus stealing from causing scroll jumps.
          e.preventDefault();
        }}
      >
        {/* Column area */}
        <div className="flex">
          {/* Hours */}
          <TimeColumn
            title="Hours"
            items={hourItems}
            selectedValue={pendingHour}
            onSelect={(v) => setPendingHour(v as number)}
          />

          {/* Minutes */}
          <TimeColumn
            title="Minutes"
            items={minuteItems}
            selectedValue={pendingMinute}
            onSelect={(v) => setPendingMinute(v as number)}
            isLast={!cfg.showSeconds && !cfg.showMeridiem}
          />

          {/* Seconds */}
          {cfg.showSeconds && (
            <TimeColumn
              title="Seconds"
              items={secondItems}
              selectedValue={pendingSecond}
              onSelect={(v) => setPendingSecond(v as number)}
              isLast={!cfg.showMeridiem}
            />
          )}

          {/* AM/PM */}
          {cfg.showMeridiem && (
            <TimeColumn
              title="AM/PM"
              items={meridiemItems}
              selectedValue={pendingMeridiem}
              onSelect={(v) => setPendingMeridiem(v as "AM" | "PM")}
              isLast
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-2 py-2">
          <div className="flex items-center gap-1">
            {/* Now shortcut */}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleNow}
              className="text-xs"
            >
              Now
            </Button>
            {/* Custom range shortcuts */}
            {ranges?.map((range) => (
              <Button
                key={range.label}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  const h = range.value.getHours();
                  if (cfg.is12h) {
                    setPendingMeridiem(h >= 12 ? "PM" : "AM");
                    setPendingHour(h % 12 || 12);
                  } else {
                    setPendingHour(h);
                  }
                  setPendingMinute(range.value.getMinutes());
                  setPendingSecond(range.value.getSeconds());
                }}
                className="text-xs"
              >
                {range.label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="xs"
            onClick={handleConfirm}
          >
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

TimePicker.displayName = "TimePicker";

export { TimePicker };
