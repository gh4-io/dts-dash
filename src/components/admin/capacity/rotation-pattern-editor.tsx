"use client";

import { useState, useEffect, useCallback } from "react";
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
import type { RotationPattern } from "@/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_NAME_LEN = 32;

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
}

export function RotationPatternEditor({
  open,
  onOpenChange,
  pattern,
  onSave,
}: RotationPatternEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("ooooooooooooooooooooo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(pattern?.name ?? "");
      setDescription(pattern?.description ?? "");
      setCode(pattern?.pattern ?? "ooooooooooooooooooooo");
      setError(null);
    }
  }, [open, pattern]);

  const toggleDay = useCallback((index: number) => {
    setCode((prev) => {
      const chars = prev.split("");
      chars[index] = chars[index] === "x" ? "o" : "x";
      return chars.join("");
    });
  }, []);

  const workDays = code.split("").filter((c) => c === "x").length;

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
    if (code.length !== 21) {
      setError("Pattern must be exactly 21 characters");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({ name: trimmed, description: description.trim() || null, pattern: code });
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
              {[0, 1, 2].map((week) => (
                <div key={week} className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 mb-1">
                  <span className="w-10 text-[10px] text-muted-foreground flex items-center">
                    Wk {week + 1}
                  </span>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const idx = week * 7 + day;
                    const isWork = code[idx] === "x";
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`aspect-square rounded-md border-2 transition-all duration-100 hover:scale-105 ${
                          isWork
                            ? "bg-primary border-primary/80 shadow-sm shadow-primary/20"
                            : "bg-transparent border-muted-foreground/20 hover:border-muted-foreground/40"
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Stats + presets */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {workDays}/21 work days ({((workDays / 21) * 100).toFixed(0)}%)
              </span>
              <div className="flex gap-1">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setCode(preset.apply())}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Raw code */}
            <div className="rounded border border-border bg-muted/50 px-2.5 py-1.5">
              <span className="text-[10px] text-muted-foreground mr-2">Code:</span>
              <span className="font-mono text-xs text-foreground tracking-wider">{code}</span>
            </div>
          </div>

          {error && (
            <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
            {pattern ? "Save Changes" : "Create Pattern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
