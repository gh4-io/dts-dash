import * as cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { db } from "@/lib/db/client";
import { cronJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cleanupCanceledWPs } from "./tasks/cleanup-canceled";
import { createChildLogger } from "@/lib/logger";
import { getFeatures } from "@/lib/config/loader";

const log = createChildLogger("cron");

/** Registry of active cron tasks keyed by job ID */
const activeTasks = new Map<string, ScheduledTask>();

/** Task handler registry — maps job IDs to their execution functions */
const taskHandlers: Record<string, (graceHours: number) => void> = {
  "cleanup-canceled": (graceHours: number) => {
    try {
      const result = cleanupCanceledWPs(graceHours);
      log.info({ jobId: "cleanup-canceled", ...result }, "Cleanup task completed");
    } catch (err) {
      log.error({ err, jobId: "cleanup-canceled" }, "Cleanup task failed");

      // Update job status to error
      try {
        db.update(cronJobs)
          .set({
            lastRunAt: new Date().toISOString(),
            lastRunStatus: "error",
            lastRunMessage: (err as Error).message,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(cronJobs.id, "cleanup-canceled"))
          .run();
      } catch (updateErr) {
        log.warn({ err: updateErr }, "Failed to update cron job error status");
      }
    }
  },
};

/**
 * Start the cron scheduler.
 * Reads job definitions from the `cron_jobs` table and registers active tasks.
 * Guards against double-registration.
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

  // Read job definitions from DB
  let jobs: Array<{
    id: string;
    name: string;
    schedule: string;
    enabled: boolean;
    graceHours: number | null;
  }>;

  try {
    jobs = db.select().from(cronJobs).all();
  } catch {
    log.warn("cron_jobs table not found — skipping cron startup");
    return;
  }

  if (jobs.length === 0) {
    log.info("No cron jobs configured");
    return;
  }

  for (const job of jobs) {
    if (!job.enabled) {
      log.info({ jobId: job.id, name: job.name }, "Cron job disabled, skipping");
      continue;
    }

    const handler = taskHandlers[job.id];
    if (!handler) {
      log.warn({ jobId: job.id, name: job.name }, "No handler registered for cron job");
      continue;
    }

    if (!cron.validate(job.schedule)) {
      log.error({ jobId: job.id, schedule: job.schedule }, "Invalid cron schedule expression");
      continue;
    }

    const task = cron.schedule(job.schedule, () => {
      log.info({ jobId: job.id, name: job.name }, "Cron job executing");
      handler(job.graceHours ?? 6);
    });

    activeTasks.set(job.id, task);
    log.info({ jobId: job.id, name: job.name, schedule: job.schedule }, "Cron job registered");
  }

  log.info({ jobCount: activeTasks.size }, "Cron scheduler started");
}

/**
 * Stop all cron tasks (for graceful shutdown).
 */
export function stopCron(): void {
  for (const [id, task] of activeTasks) {
    task.stop();
    log.info({ jobId: id }, "Cron job stopped");
  }
  activeTasks.clear();
  log.info("Cron scheduler stopped");
}
