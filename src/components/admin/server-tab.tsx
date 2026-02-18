"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DEFAULT_CLEANUP_GRACE_HOURS } from "@/lib/data/config-defaults";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ServerStatus {
  database: {
    path: string;
    size: string;
    sizeBytes: number;
    walSize: string;
    walSizeBytes: number;
    modified: string | null;
  };
  tables: Record<string, number>;
  totalRows: number;
  lastImport: {
    importedAt: string;
    recordCount: number;
    source: string;
    fileName: string | null;
  } | null;
  canceledCount: number;
  backups: {
    count: number;
    lastBackup: string | null;
    totalSize: string;
  };
  uptime: string;
  uptimeMs: number;
}

interface ActionState {
  loading: boolean;
  message: { type: "success" | "error"; text: string } | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

// Key tables to highlight in the summary
const KEY_TABLES = [
  "users",
  "work_packages",
  "customers",
  "aircraft_type_mappings",
  "mh_overrides",
  "import_log",
  "analytics_events",
  "feedback_posts",
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

export function ServerTab() {
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.role === "superadmin";

  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Per-action states
  const [actions, setActions] = useState<Record<string, ActionState>>({});
  const [graceHours, setGraceHours] = useState(DEFAULT_CLEANUP_GRACE_HOURS);

  // Flight display settings (system-wide)
  const [flightSettings, setFlightSettings] = useState<{
    hideCanceled: boolean;
    cleanupGraceHours: number;
  } | null>(null);
  const [flightSettingsLoading, setFlightSettingsLoading] = useState(true);
  const [flightSettingsDirty, setFlightSettingsDirty] = useState(false);

  const getAction = (key: string): ActionState => actions[key] ?? { loading: false, message: null };

  const setActionState = (key: string, state: Partial<ActionState>) => {
    setActions((prev) => ({
      ...prev,
      [key]: { ...getAction(key), ...state },
    }));
  };

  // Fetch server status
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/admin/server/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatusError("Failed to load server status");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Fetch flight display settings
  const fetchFlightSettings = useCallback(async () => {
    setFlightSettingsLoading(true);
    try {
      const res = await fetch("/api/admin/server/flights");
      if (res.ok) {
        const data = await res.json();
        setFlightSettings(data.settings);
        setFlightSettingsDirty(false);
      }
    } catch {
      // silently fail — section shows nothing
    } finally {
      setFlightSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlightSettings();
  }, [fetchFlightSettings]);

  // Sync manual cleanup grace period input with system setting
  useEffect(() => {
    if (flightSettings) {
      setGraceHours(flightSettings.cleanupGraceHours);
    }
  }, [flightSettings]);

  // Save flight settings
  const saveFlightSettings = async () => {
    if (!flightSettings) return;
    setActionState("flights", { loading: true, message: null });
    try {
      const res = await fetch("/api/admin/server/flights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: flightSettings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionState("flights", {
          loading: false,
          message: { type: "error", text: data.error ?? "Failed to save" },
        });
        return;
      }
      setFlightSettings(data.settings);
      setFlightSettingsDirty(false);
      setActionState("flights", {
        loading: false,
        message: { type: "success", text: data.message },
      });
    } catch {
      setActionState("flights", {
        loading: false,
        message: { type: "error", text: "Network error" },
      });
    }
  };

  // Generic action handler
  const performAction = async (
    key: string,
    url: string,
    options?: { method?: string; body?: unknown },
  ) => {
    setActionState(key, { loading: true, message: null });
    try {
      const res = await fetch(url, {
        method: options?.method ?? "POST",
        headers: options?.body ? { "Content-Type": "application/json" } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setActionState(key, {
          loading: false,
          message: { type: "error", text: data.error ?? "Action failed" },
        });
        return;
      }
      setActionState(key, {
        loading: false,
        message: { type: "success", text: data.message },
      });
      // Refresh status after mutations
      if (key !== "restart") {
        fetchStatus();
      }
    } catch {
      setActionState(key, {
        loading: false,
        message: { type: "error", text: "Network error" },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Database Status ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-database text-muted-foreground" />
            <h3 className="text-lg font-semibold">Database Status</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={statusLoading}>
            <i className={`fa-solid fa-arrows-rotate mr-2 ${statusLoading ? "fa-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {statusError && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {statusError}
          </div>
        )}

        {statusLoading && !status && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <i className="fa-solid fa-spinner fa-spin" />
            Loading status...
          </div>
        )}

        {status && (
          <div className="space-y-4">
            {/* Overview row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">DB Size</div>
                <div className="text-lg font-semibold">{status.database.size}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">WAL Size</div>
                <div className="text-lg font-semibold">{status.database.walSize}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Total Rows</div>
                <div className="text-lg font-semibold">{status.totalRows.toLocaleString()}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Uptime</div>
                <div className="text-lg font-semibold">{formatUptime(status.uptimeMs)}</div>
              </div>
            </div>

            {/* Table counts */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">Table Row Counts</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                {KEY_TABLES.map((table) => (
                  <div key={table} className="flex justify-between">
                    <span className="text-muted-foreground">{table}</span>
                    <span className="font-mono">
                      {status.tables[table] === -1
                        ? "—"
                        : (status.tables[table] ?? 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Last import & backups */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Last Import</div>
                {status.lastImport ? (
                  <div className="space-y-0.5 text-sm">
                    <div>
                      {status.lastImport.recordCount.toLocaleString()} records via{" "}
                      {status.lastImport.source}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(status.lastImport.importedAt).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No imports yet</div>
                )}
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Backups</div>
                <div className="space-y-0.5 text-sm">
                  <div>
                    {status.backups.count} backup{status.backups.count !== 1 ? "s" : ""} (
                    {status.backups.totalSize})
                  </div>
                  {status.backups.lastBackup && (
                    <div className="text-xs text-muted-foreground">
                      Latest: {status.backups.lastBackup}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Canceled WPs indicator */}
            {status.canceledCount > 0 && (
              <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-500">
                <i className="fa-solid fa-triangle-exclamation mr-2" />
                {status.canceledCount} canceled work package
                {status.canceledCount !== 1 ? "s" : ""} in database
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Flight Display Settings ─────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <i className="fa-solid fa-plane text-muted-foreground" />
          <h3 className="text-lg font-semibold">Flight Display</h3>
        </div>

        {flightSettingsLoading && !flightSettings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <i className="fa-solid fa-spinner fa-spin" />
            Loading settings...
          </div>
        ) : flightSettings ? (
          <div className="space-y-4">
            {/* Hide Canceled toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Hide Canceled Flights</div>
                <div className="text-xs text-muted-foreground">
                  When enabled, canceled work packages are completely hidden from all views
                </div>
              </div>
              <Switch
                checked={flightSettings.hideCanceled}
                onCheckedChange={(checked) => {
                  setFlightSettings((prev) => (prev ? { ...prev, hideCanceled: checked } : prev));
                  setFlightSettingsDirty(true);
                }}
              />
            </div>

            {/* Grace period input */}
            <div>
              <label htmlFor="cleanup-grace-sys" className="text-sm font-medium">
                Cleanup Grace Period (hours)
              </label>
              <div className="mt-1 text-xs text-muted-foreground">
                Hours after import before the cleanup job permanently deletes canceled work packages
                (1&ndash;720)
              </div>
              <input
                id="cleanup-grace-sys"
                type="number"
                min={1}
                max={720}
                value={flightSettings.cleanupGraceHours}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(720, Number(e.target.value)));
                  setFlightSettings((prev) => (prev ? { ...prev, cleanupGraceHours: v } : prev));
                  setFlightSettingsDirty(true);
                }}
                className="mt-1 w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
              />
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={!flightSettingsDirty || getAction("flights").loading}
                onClick={saveFlightSettings}
              >
                {getAction("flights").loading ? (
                  <i className="fa-solid fa-spinner fa-spin mr-2" />
                ) : (
                  <i className="fa-solid fa-floppy-disk mr-2" />
                )}
                Save Settings
              </Button>
              <ActionMessage message={getAction("flights").message} />
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Server Actions ───────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Reload Configuration */}
        <ActionCard
          icon="fa-arrows-rotate"
          title="Reload Configuration"
          description="Hot-reload server.config.yml without restarting the server."
          actionLabel="Reload Config"
          state={getAction("reload")}
          onAction={() => performAction("reload", "/api/admin/server/reload-config")}
        />

        {/* Invalidate Cache */}
        <ActionCard
          icon="fa-broom"
          title="Invalidate Cache"
          description="Clear all computed data caches. Data will be recalculated on next request."
          actionLabel="Clear Cache"
          state={getAction("cache")}
          onAction={() => performAction("cache", "/api/admin/server/invalidate-cache")}
        />

        {/* Database Backup */}
        <ActionCard
          icon="fa-box-archive"
          title="Database Backup"
          description="Create a timestamped snapshot of the database in data/backups/."
          actionLabel="Create Backup"
          state={getAction("backup")}
          onAction={() => performAction("backup", "/api/admin/server/backup")}
        />

        {/* Cleanup Canceled WPs */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2">
            <i className="fa-solid fa-trash-can text-muted-foreground" />
            <h3 className="font-semibold">Cleanup Canceled WPs</h3>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Permanently delete canceled work packages older than the grace period.
          </p>
          <div className="mb-3 flex items-center gap-2">
            <label htmlFor="grace-hours" className="text-sm text-muted-foreground">
              Grace period (hours):
            </label>
            <input
              id="grace-hours"
              type="number"
              min={0}
              value={graceHours}
              onChange={(e) => setGraceHours(Math.max(0, Number(e.target.value)))}
              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={getAction("cleanup").loading}
            onClick={() =>
              performAction("cleanup", "/api/admin/server/cleanup", {
                body: { graceHours },
              })
            }
          >
            {getAction("cleanup").loading ? (
              <i className="fa-solid fa-spinner fa-spin mr-2" />
            ) : (
              <i className="fa-solid fa-trash-can mr-2" />
            )}
            Run Cleanup
          </Button>
          <ActionMessage message={getAction("cleanup").message} />
        </section>

        {/* Restart Server — superadmin only */}
        {isSuperadmin && (
          <section className="rounded-lg border border-destructive/30 bg-card p-6">
            <div className="mb-2 flex items-center gap-2">
              <i className="fa-solid fa-power-off text-destructive" />
              <h3 className="font-semibold text-destructive">Restart Server</h3>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Terminate the server process. Requires a process manager (PM2, systemd) for automatic
              restart.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={getAction("restart").loading}>
                  {getAction("restart").loading ? (
                    <i className="fa-solid fa-spinner fa-spin mr-2" />
                  ) : (
                    <i className="fa-solid fa-power-off mr-2" />
                  )}
                  Restart Server
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restart Server?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will terminate the server process. It will restart automatically if running
                    under a process manager (PM2, systemd, Docker). All active sessions will be
                    briefly interrupted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => performAction("restart", "/api/admin/server/restart")}
                  >
                    Restart Now
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <ActionMessage message={getAction("restart").message} />
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ActionCard({
  icon,
  title,
  description,
  actionLabel,
  state,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  state: ActionState;
  onAction: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="mb-2 flex items-center gap-2">
        <i className={`fa-solid ${icon} text-muted-foreground`} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      <Button size="sm" variant="outline" disabled={state.loading} onClick={onAction}>
        {state.loading ? (
          <i className="fa-solid fa-spinner fa-spin mr-2" />
        ) : (
          <i className={`fa-solid ${icon} mr-2`} />
        )}
        {actionLabel}
      </Button>
      <ActionMessage message={state.message} />
    </section>
  );
}

function ActionMessage({
  message,
}: {
  message: { type: "success" | "error"; text: string } | null;
}) {
  if (!message) return null;
  return (
    <div
      className={`mt-2 rounded-md px-3 py-2 text-xs ${
        message.type === "success"
          ? "bg-emerald-500/10 text-emerald-500"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {message.text}
    </div>
  );
}
