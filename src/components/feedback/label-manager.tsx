"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelBadge } from "./label-badge";
import type { FeedbackLabel } from "@/types/feedback";

interface LabelManagerProps {
  labels: FeedbackLabel[];
  onCreateLabel: (name: string, color: string) => Promise<void>;
  onDeleteLabel: (id: number) => Promise<void>;
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function LabelManager({ labels, onCreateLabel, onDeleteLabel }: LabelManagerProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreateLabel(name.trim(), color);
      setName("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Manage Labels</h4>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <div key={label.id} className="group relative">
              <LabelBadge label={label} />
              <button
                onClick={() => onDeleteLabel(label.id)}
                className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] text-destructive-foreground group-hover:flex"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Name input — full width */}
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        placeholder="New label name"
        className="h-8 text-xs"
        maxLength={50}
      />

      {/* Color swatches + Add button on same row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="h-5 w-5 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "white" : "transparent",
                transform: color === c ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="h-7 shrink-0 px-3 text-xs"
        >
          Add
        </Button>
      </div>
    </div>
  );
}
