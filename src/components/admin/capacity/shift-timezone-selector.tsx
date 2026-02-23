"use client";

import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShiftTimezoneSelectorProps {
  currentTimezone: string;
  onSave: (tz: string) => Promise<void>;
}

export function ShiftTimezoneSelector({ currentTimezone, onSave }: ShiftTimezoneSelectorProps) {
  const [tz, setTz] = useState(currentTimezone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChange = useCallback(
    async (value: string) => {
      setTz(value);
      setSaving(true);
      setMessage(null);
      try {
        await onSave(value);
        setMessage({ type: "success", text: `Shift timezone set to ${value}` });
      } catch {
        setMessage({ type: "error", text: "Failed to update timezone" });
        setTz(currentTimezone); // revert
      } finally {
        setSaving(false);
      }
    },
    [onSave, currentTimezone],
  );

  return (
    <section className="rounded-lg border border-border bg-card p-6 space-y-3">
      <h2 className="text-lg font-semibold">
        <i className="fa-solid fa-globe mr-2 text-muted-foreground" />
        Shift Timezone
      </h2>
      <p className="text-xs text-muted-foreground">
        All shift start/end hours are interpreted in this timezone. For example, if set to Eastern,
        a DAY shift of 07:00-15:00 means 07:00-15:00 Eastern time.
      </p>

      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground shrink-0">Timezone</Label>
        <Select value={tz} onValueChange={handleChange} disabled={saving}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UTC">UTC</SelectItem>
            <SelectItem value="America/New_York">Eastern (America/New_York)</SelectItem>
          </SelectContent>
        </Select>
        {saving && <i className="fa-solid fa-spinner fa-spin text-xs text-muted-foreground" />}
      </div>

      {message && (
        <div
          className={`rounded-md px-3 py-2 text-xs ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}
    </section>
  );
}
