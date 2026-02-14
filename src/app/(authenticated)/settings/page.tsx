"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShiftConfig {
  name: string;
  startHour: number;
  endHour: number;
  headcount: number;
}

interface AppConfig {
  defaultMH: number;
  wpMHMode: string;
  theoreticalCapacityPerPerson: number;
  realCapacityPerPerson: number;
  shifts: ShiftConfig[];
  timelineDefaultDays: number;
  defaultTimezone: string;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const updateShiftHeadcount = (index: number, headcount: number) => {
    if (!config) return;
    const shifts = [...config.shifts];
    shifts[index] = { ...shifts[index], headcount };
    setConfig({ ...config, shifts });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">
          <i className="fa-solid fa-gear mr-2" />
          Settings
        </h1>
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <i className="fa-solid fa-spinner fa-spin text-2xl" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">
          <i className="fa-solid fa-gear mr-2" />
          Settings
        </h1>
        <div className="rounded-lg border border-border bg-card p-8 text-center text-destructive">
          Failed to load settings
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <i className="fa-solid fa-gear mr-2" />
          Settings
        </h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ─── Demand Model ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-calculator mr-2 text-muted-foreground" />
          Demand Model
        </h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Default Man-Hours (MH)</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {config.defaultMH.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[config.defaultMH]}
            onValueChange={([v]) => setConfig({ ...config, defaultMH: v })}
            min={0.5}
            max={10}
            step={0.5}
          />
          <p className="text-xs text-muted-foreground">
            Fallback MH when work package has no MH value
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Include WP Man-Hours</Label>
            <p className="text-xs text-muted-foreground">
              Use TotalMH from work packages when available
            </p>
          </div>
          <Switch
            checked={config.wpMHMode === "include"}
            onCheckedChange={(checked) =>
              setConfig({ ...config, wpMHMode: checked ? "include" : "exclude" })
            }
          />
        </div>
      </section>

      {/* ─── Capacity Model ────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-gauge-high mr-2 text-muted-foreground" />
          Capacity Model
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Theoretical MH/Person</Label>
            <Input
              type="number"
              value={config.theoreticalCapacityPerPerson}
              onChange={(e) =>
                setConfig({
                  ...config,
                  theoreticalCapacityPerPerson: parseFloat(e.target.value) || 8.0,
                })
              }
              min={1}
              max={24}
              step={0.5}
            />
          </div>
          <div className="space-y-2">
            <Label>Real MH/Person</Label>
            <Input
              type="number"
              value={config.realCapacityPerPerson}
              onChange={(e) =>
                setConfig({
                  ...config,
                  realCapacityPerPerson: parseFloat(e.target.value) || 6.5,
                })
              }
              min={1}
              max={24}
              step={0.5}
            />
          </div>
        </div>
      </section>

      {/* ─── Shift Configuration ───────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-clock mr-2 text-muted-foreground" />
          Shift Configuration
        </h2>
        <p className="text-xs text-muted-foreground">
          Adjust headcount per shift. Shift times are fixed (Day 07-15, Swing 15-23, Night 23-07).
        </p>

        <div className="space-y-3">
          {config.shifts.map((shift, i) => (
            <div
              key={shift.name}
              className="flex items-center justify-between rounded-md border border-border bg-background p-3"
            >
              <div>
                <span className="font-medium">{shift.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {String(shift.startHour).padStart(2, "0")}:00 – {String(shift.endHour).padStart(2, "0")}:00
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Headcount</Label>
                <Input
                  type="number"
                  value={shift.headcount}
                  onChange={(e) =>
                    updateShiftHeadcount(i, parseInt(e.target.value, 10) || 0)
                  }
                  min={0}
                  max={50}
                  className="w-20"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Display ───────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-display mr-2 text-muted-foreground" />
          Display
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Timeline Default (Days)</Label>
            <Select
              value={String(config.timelineDefaultDays)}
              onValueChange={(v) =>
                setConfig({ ...config, timelineDefaultDays: parseInt(v, 10) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="3">3 Days</SelectItem>
                <SelectItem value="7">1 Week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default Timezone</Label>
            <Select
              value={config.defaultTimezone}
              onValueChange={(v) =>
                setConfig({ ...config, defaultTimezone: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}
