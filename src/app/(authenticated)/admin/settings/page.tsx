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
  ingestApiKey: string;
  ingestRateLimitSeconds: number;
  ingestMaxSizeMB: number;
}

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastImport] = useState<{ importedAt: string; recordCount: number; source: string } | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        setConfig(await res.json());
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
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-spinner fa-spin text-2xl" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-destructive">
        Failed to load settings
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            System-wide configuration for demand/capacity models
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Individual users can override timezone, date range, and time format in their Settings.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
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

      {/* Demand Model */}
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

      {/* Capacity Model */}
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

      {/* Shift Configuration */}
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

      {/* Display */}
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

      {/* Data */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-database mr-2 text-muted-foreground" />
          Data
        </h2>

        {lastImport ? (
          <div className="text-sm text-muted-foreground">
            Last import: {new Date(lastImport.importedAt).toLocaleString()} — {lastImport.recordCount} records via {lastImport.source}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No import data available. Use the Data Import page to load work packages.
          </p>
        )}
      </section>

      {/* API Integration */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            <i className="fa-solid fa-plug mr-2 text-muted-foreground" />
            API Integration
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                config.ingestApiKey ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {config.ingestApiKey ? "Endpoint active" : "Endpoint disabled"}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure the <code className="rounded bg-muted px-1">POST /api/ingest</code> endpoint for Power Automate or other automation tools.
        </p>

        {/* API Key */}
        <div className="space-y-2">
          <Label>API Key</Label>
          {generatedKey ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-500">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                Copy this key now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                  {generatedKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    setKeyCopied(true);
                    setTimeout(() => setKeyCopied(false), 2000);
                  }}
                >
                  <i className={`fa-solid ${keyCopied ? "fa-check" : "fa-copy"} mr-1`} />
                  {keyCopied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setGeneratedKey(null)}
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={
                  config.ingestApiKey
                    ? `${"•".repeat(12)}${config.ingestApiKey.slice(-4)}`
                    : ""
                }
                placeholder="Not configured"
                disabled
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
                  setConfig({ ...config, ingestApiKey: key });
                  setGeneratedKey(key);
                  setKeyCopied(false);
                }}
              >
                <i className="fa-solid fa-rotate mr-1" />
                {config.ingestApiKey ? "Regenerate" : "Generate"}
              </Button>
              {config.ingestApiKey && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setConfig({ ...config, ingestApiKey: "" });
                    setGeneratedKey(null);
                  }}
                >
                  <i className="fa-solid fa-ban mr-1" />
                  Revoke
                </Button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Use as Bearer token: <code className="rounded bg-muted px-1">Authorization: Bearer &lt;key&gt;</code>
          </p>
        </div>

        {/* Rate Limit + Size Limit */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Rate Limit (seconds)</Label>
            <Input
              type="number"
              value={config.ingestRateLimitSeconds}
              onChange={(e) =>
                setConfig({
                  ...config,
                  ingestRateLimitSeconds: Math.max(10, parseInt(e.target.value, 10) || 60),
                })
              }
              min={10}
              max={3600}
            />
            <p className="text-xs text-muted-foreground">
              Minimum seconds between requests (default: 60)
            </p>
          </div>
          <div className="space-y-2">
            <Label>Max Payload Size (MB)</Label>
            <Input
              type="number"
              value={config.ingestMaxSizeMB}
              onChange={(e) =>
                setConfig({
                  ...config,
                  ingestMaxSizeMB: Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 50)),
                })
              }
              min={1}
              max={200}
            />
            <p className="text-xs text-muted-foreground">
              Maximum JSON payload size (default: 50MB)
            </p>
          </div>
        </div>
      </section>

      {/* Coming Soon stubs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Authentication", icon: "fa-solid fa-lock" },
          { label: "Email", icon: "fa-solid fa-envelope" },
          { label: "Storage", icon: "fa-solid fa-hard-drive" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-card/50 p-4 text-center opacity-50"
          >
            <i className={`${item.icon} text-lg text-muted-foreground`} />
            <p className="mt-2 text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">Coming Soon</p>
          </div>
        ))}
      </div>
    </div>
  );
}
