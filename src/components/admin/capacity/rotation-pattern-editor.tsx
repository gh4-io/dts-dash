"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { RotationPresetSelector } from "./rotation-preset-selector";
import type { RotationPattern } from "@/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_NAME_LEN = 14;
const WEEK_LABELS = ["Week 1", "Week 2", "Week 3"];

const PRESETS = [
  { label: "Weekdays", apply: () => "xxxxxooxxxxxooxxxxxoo" },
  { label: "Weekends", apply: () => "oooooxxoooooxxoooooxx" },
  { label: "All On", apply: () => "xxxxxxxxxxxxxxxxxxxxx" },
  { label: "Clear", apply: () => "ooooooooooooooooooooo" },
];

interface RotationPatternEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pattern?: RotationPattern;
  onSave: (data: { name: string; description: string | null; pattern: string }) => Promise<void>;
  onToggleActive?: () => Promise<void>;
  onDelete?: () => void;
}

export function RotationPatternEditor({
  open,
  onOpenChange,
  pattern,
  onSave,
  onToggleActive,
  onDelete,
}: RotationPatternEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [codeInput, setCodeInput] = useState("ooooooooooooooooooooo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetCount, setPresetCount] = useState(0);

  useEffect(() => {
    if (open) {
      setName(pattern?.name ?? "");
      setDescription(pattern?.description ?? "");
      setCodeInput(pattern?.pattern ?? "ooooooooooooooooooooo");
      setError(null);
      // Fetch preset count (lightweight) to enable/disable Presets button
      fetch("/api/admin/capacity/rotation-presets/count")
        .then((r) => r.json())
        .then((data) => setPresetCount(data.count ?? 0))
        .catch(() => setPresetCount(0));
    }
  }, [open, pattern]);

  // Normalized code: always 21 chars of x/o for grid display
  const normalizedCode = useMemo(() => {
    return codeInput
      .toLowerCase()
      .split("")
      .map((c) => (c === "x" ? "x" : "o"))
      .slice(0, 21)
      .join("")
      .padEnd(21, "o");
  }, [codeInput]);

  const toggleDay = useCallback(
    (index: number) => {
      const chars = normalizedCode.split("");
      chars[index] = chars[index] === "x" ? "o" : "x";
      setCodeInput(chars.join(""));
    },
    [normalizedCode],
  );

  const handleCodeBlur = () => {
    setCodeInput(normalizedCode);
  };

  const workDays = normalizedCode.split("").filter((c) => c === "x").length;

  const handlePresetSelect = (preset: {
    name: string;
    description: string | null;
    pattern: string;
  }) => {
    setName(preset.name);
    setDescription(preset.description ?? "");
    setCodeInput(preset.pattern);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (trimmed.length > MAX_NAME_LEN) {
      setError(`Name must be ${MAX_NAME_LEN} characters or less`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: trimmed,
        description: description.trim() || null,
        pattern: normalizedCode,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Save current changes first
      await onSave({
        name: trimmed,
        description: description.trim() || null,
        pattern: normalizedCode,
      });
      // Then toggle active state
      await onToggleActive?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <i className="fa-solid fa-calendar-days text-muted-foreground" />
            {pattern ? "Edit Rotation Pattern" : "New Rotation Pattern"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pattern-name" className="text-xs">
              Name <span className="text-muted-foreground">({MAX_NAME_LEN} char max)</span>
            </Label>
            <Input
              id="pattern-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
              placeholder="e.g. Standard 5-2"
              className="h-8 text-sm"
              maxLength={MAX_NAME_LEN}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pattern-desc" className="text-xs">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="pattern-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Mon-Fri every week"
              className="h-8 text-sm"
            />
          </div>

          {/* Interactive grid */}
          <div className="space-y-2">
            <Label className="text-xs">3-Week Rotation</Label>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              {/* Day headers */}
              <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 mb-1">
                <span className="w-10" />
                {DAY_LABELS.map((d) => (
                  <span
                    key={d}
                    className="text-[10px] text-center text-muted-foreground font-medium"
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Week rows */}
              <TooltipProvider delayDuration={300}>
                {[0, 1, 2].map((week) => (
                  <div key={week} className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 mb-1">
                    <span className="w-10 text-[10px] text-muted-foreground flex items-center">
                      Wk {week + 1}
                    </span>
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                      const idx = week * 7 + day;
                      const isWork = normalizedCode[idx] === "x";
                      return (
                        <Tooltip key={day}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => toggleDay(idx)}
                              className={`aspect-square rounded-md border-2 transition-all duration-100 hover:scale-105 ${
                                isWork
                                  ? "bg-primary border-primary/80 shadow-sm shadow-primary/20"
                                  : "bg-transparent border-muted-foreground/20 hover:border-muted-foreground/40"
                              }`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] px-1.5 py-0.5">
                            {WEEK_LABELS[week]} · {DAY_LABELS[day]}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </TooltipProvider>
            </div>

            {/* Stats + presets */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {workDays}/21 work days ({((workDays / 21) * 100).toFixed(0)}%)
              </span>
              <div className="flex gap-1 items-center">
                {/* DB Presets button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setPresetOpen(true)}
                  disabled={presetCount === 0}
                >
                  <i className="fa-solid fa-swatchbook mr-1 text-[9px]" />
                  Presets
                  {presetCount > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">
                      {presetCount}
                    </Badge>
                  )}
                </Button>
                {/* Separator */}
                <span className="w-px h-4 bg-border mx-0.5" />
                {/* Quick utility presets */}
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setCodeInput(preset.apply())}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Editable code — free text input, validates on blur */}
            <div className="space-y-1">
              <Label htmlFor="pattern-code" className="text-[10px] text-muted-foreground">
                Code
              </Label>
              <Input
                id="pattern-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onBlur={handleCodeBlur}
                placeholder="x = work, o = off"
                className="h-7 text-xs font-mono tracking-wider"
              />
            </div>
          </div>

          {error && (
            <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center sm:justify-between">
          {pattern ? (
            <div className="flex gap-1.5">
              {onToggleActive && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeactivate}
                        disabled={saving}
                      >
                        <i
                          className={`fa-solid ${pattern.isActive ? "fa-eye-slash" : "fa-eye"} mr-1.5 text-[10px]`}
                        />
                        {pattern.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px] max-w-48">
                      {pattern.isActive
                        ? "Save changes and hide from shift assignments"
                        : "Save changes and make available for shift assignments"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {onDelete && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          onDelete();
                          onOpenChange(false);
                        }}
                        disabled={saving}
                      >
                        <i className="fa-solid fa-trash mr-1.5 text-[10px]" />
                        Delete
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px] max-w-48">
                      Delete this pattern permanently
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
              {pattern ? "Save Changes" : "Create Pattern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Nested preset selector dialog */}
      <RotationPresetSelector
        open={presetOpen}
        onOpenChange={setPresetOpen}
        onSelect={handlePresetSelect}
      />
    </Dialog>
  );
}
