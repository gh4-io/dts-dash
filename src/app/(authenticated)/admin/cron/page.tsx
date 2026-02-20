"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CronJobTable, type CronJobRow } from "@/components/admin/cron-job-table";
import { CronJobForm } from "@/components/admin/cron-job-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BuiltinDef {
  key: string;
  name: string;
  description: string;
  script: string;
  defaultSchedule: string;
  defaultEnabled: boolean;
  defaultOptions: Record<string, unknown>;
  optionsSchema: Record<
    string,
    {
      type: "number" | "string" | "boolean";
      default: unknown;
      label: string;
      min?: number;
      max?: number;
      description?: string;
    }
  >;
}

export default function CronJobsPage() {
  const [jobs, setJobs] = useState<CronJobRow[]>([]);
  const [builtins, setBuiltins] = useState<BuiltinDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingJob, setEditingJob] = useState<CronJobRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CronJobRow | null>(null);
  const [resetTarget, setResetTarget] = useState<CronJobRow | null>(null);
  const [runningKey, setRunningKey] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cron");
      if (res.ok) {
        setJobs(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBuiltins = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cron/builtins");
      if (res.ok) {
        setBuiltins(await res.json());
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchBuiltins();
  }, [fetchJobs, fetchBuiltins]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = window.setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleCreate = () => {
    setEditingJob(null);
    setFormMode("create");
    setFormOpen(true);
  };

  const handleEdit = (job: CronJobRow) => {
    setEditingJob(job);
    setFormMode("edit");
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: {
    key: string;
    name: string;
    description: string;
    script: string;
    schedule: string;
    enabled: boolean;
    options: Record<string, unknown>;
  }) => {
    setMessage(null);

    if (formMode === "create") {
      const res = await fetch("/api/admin/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create job");

      await fetchJobs();
      setMessage({ type: "success", text: `Custom job "${data.name}" created` });
    } else if (editingJob) {
      const res = await fetch(`/api/admin/cron/${editingJob.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update job");

      await fetchJobs();
      setMessage({ type: "success", text: "Job updated" });
    }
  };

  const handleToggle = async (job: CronJobRow) => {
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/cron/${job.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Failed to toggle job" });
      } else {
        setMessage({
          type: "success",
          text: `${job.name} ${job.enabled ? "suspended" : "resumed"}`,
        });
        await fetchJobs();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const handleRunNow = async (job: CronJobRow) => {
    setMessage(null);
    setRunningKey(job.key);
    try {
      const res = await fetch(`/api/admin/cron/${job.key}/run`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Execution failed" });
      } else {
        setMessage({ type: "success", text: body.message ?? "Job completed" });
        await fetchJobs();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setRunningKey(null);
    }
  };

  const handleDelete = (job: CronJobRow) => {
    setDeleteTarget(job);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/cron/${deleteTarget.key}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Failed to delete job" });
      } else {
        setMessage({ type: "success", text: `Job "${deleteTarget.name}" deleted` });
        await fetchJobs();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleReset = (job: CronJobRow) => {
    setResetTarget(job);
  };

  const confirmReset = async () => {
    if (!resetTarget) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/cron/${resetTarget.key}/reset`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error ?? "Failed to reset job" });
      } else {
        setMessage({ type: "success", text: `${resetTarget.name} reset to defaults` });
        await fetchJobs();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setResetTarget(null);
    }
  };

  const handleFormReset = async () => {
    if (!editingJob?.builtin) return;
    setFormOpen(false);
    handleReset(editingJob);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-spinner fa-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""} ({jobs.filter((j) => j.builtin).length}{" "}
          built-in, {jobs.filter((j) => !j.builtin).length} custom)
        </p>
        <Button size="sm" onClick={handleCreate}>
          <i className="fa-solid fa-plus mr-2" />
          Add Custom Job
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

      <CronJobTable
        jobs={jobs}
        onEdit={handleEdit}
        onToggle={handleToggle}
        onRunNow={handleRunNow}
        onDelete={handleDelete}
        onReset={handleReset}
        runningKey={runningKey}
      />

      {/* Create/Edit dialog */}
      <CronJobForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialData={editingJob ?? undefined}
        builtinDefs={builtins}
        onSubmit={handleFormSubmit}
        onReset={editingJob?.builtin ? handleFormReset : undefined}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Custom Job</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will remove
            it from the YAML configuration and stop its schedule.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <i className="fa-solid fa-trash mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <Dialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Defaults</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reset <strong>{resetTarget?.name}</strong> to its built-in defaults? This will remove
            any YAML overrides for this job (schedule, options, enabled state).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReset}>
              <i className="fa-solid fa-rotate-left mr-2" />
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
