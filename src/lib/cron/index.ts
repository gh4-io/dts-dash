import * as cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import path from "path";
import { db } from "@/lib/db/client";
import { cronJobRuns } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { cleanupCanceledWPs } from "./tasks/cleanup-canceled";
import { createChildLogger } from "@/lib/logger";
import { getFeatures, getCronJobOverrides, getFlightSettings } from "@/lib/config/loader";

const log = createChildLogger("cron");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CronTaskResult {
  message: string;
}

export interface OptionSchemaDef {
  type: "number" | "string" | "boolean";
  default: unknown;
  label: string;
  min?: number;
  max?: number;
  description?: string;
}

export interface BuiltinJobDef {
  key: string;
  name: string;
  description: string;
  script: string;
  handler: (options: Record<string, unknown>) => Promise<CronTaskResult>;
  defaultSchedule: string;
  defaultEnabled: boolean;
  defaultOptions: Record<string, unknown>;
  optionsSchema: Record<string, OptionSchemaDef>;
}

/** Effective job config (built-in defaults merged with YAML overrides) */
export interface CronJobConfig {
  key: string;
  name: string;
  description: string;
  script: string;
  schedule: string;
  enabled: boolean;
  options: Record<string, unknown>;
  builtin: boolean;
}

/** Runtime state from DB */
export interface CronJobRunState {
  jobKey: string;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunMessage: string | null;
  runCount: number;
}

/** Full status: effective config + runtime state */
export interface CronJobStatus extends CronJobConfig {
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunMessage: string | null;
  runCount: number;
}

// ─── Built-in Job Registry ───────────────────────────────────────────────────

const BUILTIN_JOBS: BuiltinJobDef[] = [
  {
    key: "cleanup-canceled",
    name: "Cleanup Canceled WPs",
    description: "Permanently deletes canceled work packages past the grace period",
    script: "src/lib/cron/tasks/cleanup-canceled.ts",
    handler: cleanupCanceledWPs,
    defaultSchedule: "0 */6 * * *",
    defaultEnabled: true,
    defaultOptions: { graceHours: 6 },
    optionsSchema: {
      graceHours: {
        type: "number",
        default: 6,
        label: "Grace Period (hours)",
        min: 1,
        max: 720,
        description: "Hours after cancellation before permanent deletion",
      },
    },
  },
];

// ─── Active Task State ───────────────────────────────────────────────────────

const activeTasks = new Map<string, ScheduledTask>();

// ─── Merge Logic ─────────────────────────────────────────────────────────────

/**
 * Merge built-in defaults with YAML overrides to produce effective config.
 */
export function getEffectiveJobs(): CronJobConfig[] {
  const overrides = getCronJobOverrides();
  const result: CronJobConfig[] = [];
  const processedKeys = new Set<string>();

  // 1. Built-in jobs — merge with YAML overrides
  for (const builtin of BUILTIN_JOBS) {
    processedKeys.add(builtin.key);
    const override = overrides[builtin.key];

    // For cleanup-canceled, inject system flight settings as the base graceHours
    // Priority: code constant < flights.cleanupGraceHours < cron YAML override
    let baseOptions = { ...builtin.defaultOptions };
    if (builtin.key === "cleanup-canceled") {
      try {
        const { cleanupGraceHours } = getFlightSettings();
        baseOptions = { ...baseOptions, graceHours: cleanupGraceHours };
      } catch {
        // Fall back to code default if config not loaded yet
      }
    }

    result.push({
      key: builtin.key,
      name: override?.name ?? builtin.name,
      description: override?.description ?? builtin.description,
      script: builtin.script, // always from code for built-ins
      schedule: override?.schedule ?? builtin.defaultSchedule,
      enabled: override?.enabled ?? builtin.defaultEnabled,
      options: { ...baseOptions, ...override?.options },
      builtin: true,
    });
  }

  // 2. Custom jobs from YAML only
  for (const [key, entry] of Object.entries(overrides)) {
    if (processedKeys.has(key)) continue;

    // Custom jobs must have script + schedule
    if (!entry.script || !entry.schedule) {
      log.warn({ key }, "Custom cron job missing script or schedule, skipping");
      continue;
    }

    result.push({
      key,
      name: entry.name ?? key,
      description: entry.description ?? "",
      script: entry.script,
      schedule: entry.schedule,
      enabled: entry.enabled ?? true,
      options: entry.options ?? {},
      builtin: false,
    });
  }

  return result;
}

/** Get runtime state for all tracked jobs from DB */
function getRunStates(): Map<string, CronJobRunState> {
  const map = new Map<string, CronJobRunState>();
  try {
    const rows = db.select().from(cronJobRuns).all();
    for (const row of rows) {
      map.set(row.jobKey, {
        jobKey: row.jobKey,
        lastRunAt: row.lastRunAt,
        lastRunStatus: row.lastRunStatus as "success" | "error" | null,
        lastRunMessage: row.lastRunMessage,
        runCount: row.runCount,
      });
    }
  } catch {
    // Table may not exist yet during initial setup
  }
  return map;
}

/** Update runtime state after a job run */
export function updateRunState(jobKey: string, status: "success" | "error", message: string): void {
  const now = new Date().toISOString();
  try {
    const existing = db.select().from(cronJobRuns).where(eq(cronJobRuns.jobKey, jobKey)).get();

    if (existing) {
      db.update(cronJobRuns)
        .set({
          lastRunAt: now,
          lastRunStatus: status,
          lastRunMessage: message,
          runCount: sql`${cronJobRuns.runCount} + 1`,
          updatedAt: now,
        })
        .where(eq(cronJobRuns.jobKey, jobKey))
        .run();
    } else {
      db.insert(cronJobRuns)
        .values({
          jobKey,
          lastRunAt: now,
          lastRunStatus: status,
          lastRunMessage: message,
          runCount: 1,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  } catch (err) {
    log.warn({ err, jobKey }, "Failed to update cron job run state");
  }
}

// ─── Job Execution ───────────────────────────────────────────────────────────

/** Execute a job (built-in via handler, custom via dynamic import) */
export async function executeJob(job: CronJobConfig): Promise<CronTaskResult> {
  const builtin = BUILTIN_JOBS.find((b) => b.key === job.key);

  if (builtin) {
    return builtin.handler(job.options);
  }

  // Custom job: dynamic import of script
  const scriptPath = path.resolve(job.script);
  const mod = await import(scriptPath);
  if (typeof mod.execute !== "function") {
    throw new Error(`Custom script ${job.script} does not export an execute() function`);
  }
  return mod.execute(job.options);
}

/** Run a job and update runtime state */
async function runJob(job: CronJobConfig): Promise<void> {
  const jobLog = createChildLogger(`cron:${job.key}`);
  jobLog.info("Cron job executing");

  try {
    const result = await executeJob(job);
    updateRunState(job.key, "success", result.message);
    jobLog.info({ message: result.message }, "Cron job completed");
  } catch (err) {
    const message = (err as Error).message ?? "Unknown error";
    updateRunState(job.key, "error", message);
    jobLog.error({ err }, "Cron job failed");
  }
}

// ─── Scheduler Control ───────────────────────────────────────────────────────

/**
 * Start the cron scheduler.
 * Reads built-in + YAML overrides, registers active tasks.
 */
export function startCron(): void {
  // Check system-level kill switch from server.config.yml
  if (!getFeatures().cronEnabled) {
    log.info("Cron disabled via server.config.yml features.cronEnabled");
    return;
  }

  // Guard against double-registration
  if (activeTasks.size > 0) {
    log.warn("Cron already started, skipping double-registration");
    return;
  }

  const jobs = getEffectiveJobs();
  if (jobs.length === 0) {
    log.info("No cron jobs configured");
    return;
  }

  for (const job of jobs) {
    if (!job.enabled) {
      log.info({ key: job.key, name: job.name }, "Cron job disabled, skipping");
      continue;
    }

    if (!cron.validate(job.schedule)) {
      log.error({ key: job.key, schedule: job.schedule }, "Invalid cron schedule expression");
      continue;
    }

    const task = cron.schedule(job.schedule, () => {
      runJob(job);
    });

    activeTasks.set(job.key, task);
    log.info({ key: job.key, name: job.name, schedule: job.schedule }, "Cron job registered");
  }

  log.info({ jobCount: activeTasks.size }, "Cron scheduler started");
}

/**
 * Stop all cron tasks (for graceful shutdown).
 */
export function stopCron(): void {
  for (const [key, task] of activeTasks) {
    task.stop();
    log.info({ key }, "Cron job stopped");
  }
  activeTasks.clear();
  log.info("Cron scheduler stopped");
}

/**
 * Restart the cron scheduler (stop + start).
 * Call after YAML overrides are updated.
 */
export function restartCron(): void {
  stopCron();
  startCron();
}

// ─── Status API ──────────────────────────────────────────────────────────────

/** Get effective jobs merged with runtime state */
export function getCronStatus(): CronJobStatus[] {
  const jobs = getEffectiveJobs();
  const runStates = getRunStates();

  return jobs.map((job) => {
    const state = runStates.get(job.key);
    return {
      ...job,
      lastRunAt: state?.lastRunAt ?? null,
      lastRunStatus: state?.lastRunStatus ?? null,
      lastRunMessage: state?.lastRunMessage ?? null,
      runCount: state?.runCount ?? 0,
    };
  });
}

/** Get built-in job definitions with optionsSchema (for admin UI form rendering) */
export function getBuiltinJobs(): BuiltinJobDef[] {
  return BUILTIN_JOBS;
}
