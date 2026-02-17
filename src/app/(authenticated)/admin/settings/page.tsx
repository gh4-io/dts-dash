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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordSecurityForm } from "@/components/admin/password-security-form";
import { ServerTab } from "@/components/admin/server-tab";
import type { PasswordRequirements } from "@/lib/utils/password-validation";

interface ShiftConfig {
  name: string;
  startHour: number;
  endHour: number;
  headcount: number;
}

interface AllowedHostname {
  id: string;
  hostname: string;
  port: number | null;
  protocol: "http" | "https";
  enabled: boolean;
  label: string;
}

interface AppConfig {
  defaultMH: number;
  wpMHMode: string;
  theoreticalCapacityPerPerson: number;
  realCapacityPerPerson: number;
  shifts: ShiftConfig[];
  ingestApiKey: string;
  ingestRateLimitSeconds: number;
  ingestMaxSizeMB: number;
  ingestChunkTimeoutSeconds: number;
  allowedHostnames: AllowedHostname[];
}

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastImport] = useState<{ importedAt: string; recordCount: number; source: string } | null>(
    null,
  );
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [newHost, setNewHost] = useState({
    hostname: "",
    port: "3000",
    protocol: "http" as "http" | "https",
    label: "",
  });
  const [editingHostId, setEditingHostId] = useState<string | null>(null);
  const [editHost, setEditHost] = useState({
    hostname: "",
    port: "",
    protocol: "http" as "http" | "https",
    label: "",
  });
  const [passwordConfig, setPasswordConfig] = useState<PasswordRequirements | null>(null);
  const [passwordSource, setPasswordSource] = useState<"yaml" | "default">("default");

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
    fetchPasswordConfig();
  }, [fetchConfig]);

  const fetchPasswordConfig = async () => {
    try {
      const res = await fetch("/api/admin/password-security");
      if (res.ok) {
        const data = await res.json();
        setPasswordConfig(data.requirements);
        setPasswordSource(data.source);
      }
    } catch {
      // silently fail
    }
  };

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

  const addHostname = () => {
    if (!config || !newHost.hostname.trim()) return;
    const entry: AllowedHostname = {
      id: crypto.randomUUID(),
      hostname: newHost.hostname.trim(),
      port: newHost.port ? parseInt(newHost.port, 10) : null,
      protocol: newHost.protocol,
      enabled: true,
      label: newHost.label.trim() || newHost.hostname.trim(),
    };
    setConfig({
      ...config,
      allowedHostnames: [...(config.allowedHostnames ?? []), entry],
    });
    setNewHost({ hostname: "", port: "3000", protocol: "http", label: "" });
  };

  const removeHostname = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      allowedHostnames: config.allowedHostnames.filter((h) => h.id !== id),
    });
  };

  const toggleHostname = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      allowedHostnames: config.allowedHostnames.map((h) =>
        h.id === id ? { ...h, enabled: !h.enabled } : h,
      ),
    });
  };

  const startEditHostname = (h: AllowedHostname) => {
    setEditingHostId(h.id);
    setEditHost({
      hostname: h.hostname,
      port: h.port?.toString() ?? "",
      protocol: h.protocol,
      label: h.label,
    });
  };

  const saveEditHostname = () => {
    if (!config || !editingHostId || !editHost.hostname.trim()) return;
    setConfig({
      ...config,
      allowedHostnames: config.allowedHostnames.map((h) =>
        h.id === editingHostId
          ? {
              ...h,
              hostname: editHost.hostname.trim(),
              port: editHost.port ? parseInt(editHost.port, 10) : null,
              protocol: editHost.protocol,
              label: editHost.label.trim() || editHost.hostname.trim(),
            }
          : h,
      ),
    });
    setEditingHostId(null);
  };

  const formatHostUrl = (h: AllowedHostname) => {
    const base = `${h.protocol}://${h.hostname}`;
    return h.port ? `${base}:${h.port}` : base;
  };

  const handleSavePasswordConfig = async () => {
    if (!passwordConfig) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/password-security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: passwordConfig }),
      });

      if (res.ok) {
        const data = await res.json();
        setPasswordConfig(data.requirements);
        setPasswordSource(data.source);
        setMessage({ type: "success", text: "Password security settings saved" });
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

  const handleResetPasswordConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/password-security/reset", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setPasswordConfig(data.requirements);
        setPasswordSource(data.source);
        setMessage({ type: "success", text: "Password requirements reset to defaults" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Failed to reset" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
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
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <i className="fa-solid fa-sliders mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="server">
            <i className="fa-solid fa-server mr-2" />
            Server
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                System-wide configuration for demand/capacity models
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Individual users can override timezone, date range, and time format in their
                Settings.
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
              Adjust headcount per shift. Shift times are fixed (Day 07-15, Swing 15-23, Night
              23-07).
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
                      {String(shift.startHour).padStart(2, "0")}:00 –{" "}
                      {String(shift.endHour).padStart(2, "0")}:00
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Headcount</Label>
                    <Input
                      type="number"
                      value={shift.headcount}
                      onChange={(e) => updateShiftHeadcount(i, parseInt(e.target.value, 10) || 0)}
                      min={0}
                      max={50}
                      className="w-20"
                    />
                  </div>
                </div>
              ))}
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
                Last import: {new Date(lastImport.importedAt).toLocaleString()} —{" "}
                {lastImport.recordCount} records via {lastImport.source}
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
              Configure the <code className="rounded bg-muted px-1">POST /api/ingest</code> endpoint
              for Power Automate or other automation tools.
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
                      config.ingestApiKey ? `${"•".repeat(12)}${config.ingestApiKey.slice(-4)}` : ""
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
                Use as Bearer token:{" "}
                <code className="rounded bg-muted px-1">Authorization: Bearer &lt;key&gt;</code>
              </p>
            </div>

            {/* Rate Limit + Size Limit + Chunk Timeout */}
            <div className="grid grid-cols-3 gap-4">
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
                      ingestMaxSizeMB: Math.max(
                        1,
                        Math.min(200, parseInt(e.target.value, 10) || 50),
                      ),
                    })
                  }
                  min={1}
                  max={200}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum JSON payload size (default: 50MB)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Chunk Timeout (seconds)</Label>
                <Input
                  type="number"
                  value={config.ingestChunkTimeoutSeconds}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      ingestChunkTimeoutSeconds: Math.max(
                        30,
                        Math.min(3600, parseInt(e.target.value, 10) || 300),
                      ),
                    })
                  }
                  min={30}
                  max={3600}
                />
                <p className="text-xs text-muted-foreground">
                  Max idle time for chunked uploads (default: 300)
                </p>
              </div>
            </div>
          </section>

          {/* Allowed Hostnames */}
          <section className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              <i className="fa-solid fa-network-wired mr-2 text-muted-foreground" />
              Allowed Hostnames
            </h2>
            <p className="text-xs text-muted-foreground">
              Hostnames from which this dashboard can be accessed. Used for Auth.js callback
              resolution and cross-origin configuration.
            </p>
            <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
              <i className="fa-solid fa-circle-info mr-1" />
              Restart the dev server after changes for cross-origin settings to take effect.
            </div>

            {/* Hostname list */}
            <div className="space-y-2">
              {(config.allowedHostnames ?? []).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-background p-3"
                >
                  <Switch checked={h.enabled} onCheckedChange={() => toggleHostname(h.id)} />
                  {editingHostId === h.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Select
                        value={editHost.protocol}
                        onValueChange={(v) =>
                          setEditHost({ ...editHost, protocol: v as "http" | "https" })
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">http</SelectItem>
                          <SelectItem value="https">https</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={editHost.hostname}
                        onChange={(e) => setEditHost({ ...editHost, hostname: e.target.value })}
                        placeholder="hostname or IP"
                        className="flex-1"
                      />
                      <Input
                        value={editHost.port}
                        onChange={(e) => setEditHost({ ...editHost, port: e.target.value })}
                        placeholder="port"
                        className="w-20"
                      />
                      <Input
                        value={editHost.label}
                        onChange={(e) => setEditHost({ ...editHost, label: e.target.value })}
                        placeholder="label"
                        className="w-32"
                      />
                      <Button size="sm" variant="outline" onClick={saveEditHostname}>
                        <i className="fa-solid fa-check mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingHostId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{h.label}</span>
                          {!h.enabled && (
                            <span className="text-xs text-muted-foreground">(disabled)</span>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">{formatHostUrl(h)}</code>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => startEditHostname(h)}>
                        <i className="fa-solid fa-pen text-xs" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeHostname(h.id)}
                      >
                        <i className="fa-solid fa-trash text-xs" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new hostname */}
            <div className="flex items-end gap-2 rounded-md border border-dashed border-border p-3">
              <div className="space-y-1">
                <Label className="text-xs">Protocol</Label>
                <Select
                  value={newHost.protocol}
                  onValueChange={(v) => setNewHost({ ...newHost, protocol: v as "http" | "https" })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">http</SelectItem>
                    <SelectItem value="https">https</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Hostname / IP</Label>
                <Input
                  value={newHost.hostname}
                  onChange={(e) => setNewHost({ ...newHost, hostname: e.target.value })}
                  placeholder="e.g. 192.168.1.100"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Port</Label>
                <Input
                  value={newHost.port}
                  onChange={(e) => setNewHost({ ...newHost, port: e.target.value })}
                  placeholder="3000"
                  className="w-20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={newHost.label}
                  onChange={(e) => setNewHost({ ...newHost, label: e.target.value })}
                  placeholder="optional"
                  className="w-32"
                />
              </div>
              <Button size="sm" onClick={addHostname} disabled={!newHost.hostname.trim()}>
                <i className="fa-solid fa-plus mr-1" />
                Add
              </Button>
            </div>
          </section>

          {/* Password Security */}
          <section className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  <i className="fa-solid fa-shield-halved mr-2 text-muted-foreground" />
                  Password Security
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure password complexity requirements and security policies
                </p>
              </div>
              <Button
                onClick={handleSavePasswordConfig}
                disabled={saving || !passwordConfig}
                size="sm"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk mr-2" />
                    Save Password Settings
                  </>
                )}
              </Button>
            </div>

            {passwordConfig ? (
              <PasswordSecurityForm
                requirements={passwordConfig}
                source={passwordSource}
                onChange={setPasswordConfig}
                onReset={handleResetPasswordConfig}
              />
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                <i className="fa-solid fa-spinner fa-spin text-2xl" />
              </div>
            )}
          </section>

          {/* Coming Soon stubs */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[
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
        </TabsContent>

        <TabsContent value="server">
          <ServerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
