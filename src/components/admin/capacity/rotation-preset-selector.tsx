"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RotationDots } from "./rotation-dots";
import type { RotationPreset } from "@/types";

interface RotationPresetSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (preset: { name: string; description: string | null; pattern: string }) => void;
}

export function RotationPresetSelector({
  open,
  onOpenChange,
  onSelect,
}: RotationPresetSelectorProps) {
  const [presets, setPresets] = useState<RotationPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const fetchPresets = async () => {
      try {
        setLoading(true);
        setSearch("");
        const response = await fetch("/api/admin/capacity/rotation-presets", {
          signal: controller.signal,
        });
        const data = await response.json();
        setPresets(Array.isArray(data) ? data : []);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setPresets([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPresets();

    return () => controller.abort();
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return presets;
    const q = search.toLowerCase();
    return presets.filter(
      (p) =>
        (p.code ?? "").toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [presets, search]);

  const handleSelect = (p: RotationPreset) => {
    onSelect({
      name: p.name,
      description: p.description,
      pattern: p.pattern,
    });
    onOpenChange(false);
  };

  const workDaysOf = (pattern: string) => pattern.split("").filter((c) => c === "x").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <i className="fa-solid fa-swatchbook text-muted-foreground" />
            Select Rotation Preset
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-1">
          <Input
            placeholder="Search by code, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-lg text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <i className="fa-solid fa-swatchbook text-2xl mb-2 opacity-30" />
              <p className="text-sm">
                {search ? "No presets match your search" : "No presets available"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className="text-left rounded-lg border border-border p-3 hover:bg-accent/40 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {p.code && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-mono shrink-0"
                      >
                        {p.code}
                      </Badge>
                    )}
                    <span className="text-sm font-semibold truncate">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {workDaysOf(p.pattern)}/21
                    </span>
                  </div>
                  <div className="mb-1.5">
                    <RotationDots pattern={p.pattern} size="md" showWeekLabels />
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer: count */}
        <div className="text-[10px] text-muted-foreground px-1 pt-1 border-t border-border">
          {filtered.length} of {presets.length} presets
          {search && filtered.length !== presets.length && (
            <button
              type="button"
              className="ml-2 text-primary hover:underline"
              onClick={() => setSearch("")}
            >
              Clear filter
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
