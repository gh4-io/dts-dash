"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AutocompleteOption {
  value: string;
  label?: string;
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Lightweight autocomplete input with filtered dropdown.
 * Allows free-text entry — selecting from the list is optional.
 */
export function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
  className,
  inputClassName,
  disabled,
  id,
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync external value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter options based on input
  const filtered = React.useMemo(() => {
    if (!inputValue.trim()) return options;
    const lower = inputValue.toLowerCase();
    return options.filter(
      (o) =>
        o.value.toLowerCase().includes(lower) || (o.label && o.label.toLowerCase().includes(lower)),
    );
  }, [inputValue, options]);

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (val: string) => {
    setInputValue(val);
    onChange(val);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    if (!open) setOpen(true);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName,
        )}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <ul className="max-h-[180px] overflow-y-auto py-1">
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center px-2 py-1 text-xs cursor-default hover:bg-accent hover:text-accent-foreground transition-colors",
                    opt.value === value && "bg-accent/50",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur before select
                    handleSelect(opt.value);
                  }}
                >
                  {opt.label ?? opt.value}
                  {opt.value === value && (
                    <i className="fa-solid fa-check ml-auto text-[10px] opacity-70" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
