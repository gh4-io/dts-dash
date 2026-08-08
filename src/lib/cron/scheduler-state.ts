/**
 * DB-backed runtime switch for the cron scheduler (server-only).
 *
 * Stored as a single JSON row in the existing `app_config` key/value table —
 * no new table, so nothing here touches the schema. `runMigrations()` stays
 * empty and `createTables()` remains the single canonical schema declaration.
 *
 * This is deliberately separate from `features.cronEnabled`: the YAML flag is
 * the deployment gate (server access + restart), this is the runtime state an
 * administrator can flip from the admin UI.
 */

import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";
import type { SchedulerRuntimeState } from "./scheduler-status";

const log = createChildLogger("cron:scheduler-state");

/** app_config key holding the serialized runtime state */
export const SCHEDULER_STATE_KEY = "cronSchedulerState";

const DEFAULT_STATE: SchedulerRuntimeState = {
  paused: false,
  changedAt: null,
  changedBy: null,
};

/** Coerce whatever is in the DB into a usable state (a corrupt row must not stop the scheduler). */
function parseState(raw: string): SchedulerRuntimeState {
  try {
    const parsed = JSON.parse(raw) as Partial<SchedulerRuntimeState>;
    return {
      paused: parsed.paused === true,
      changedAt: typeof parsed.changedAt === "string" ? parsed.changedAt : null,
      changedBy: typeof parsed.changedBy === "string" ? parsed.changedBy : null,
    };
  } catch {
    log.warn({ raw }, "Unparseable cron scheduler state, treating as running");
    return DEFAULT_STATE;
  }
}

/**
 * Read the runtime state. Defaults to running — a missing row (fresh install)
 * or an unreadable database must never leave the scheduler silently paused.
 */
export function getSchedulerRuntimeState(): SchedulerRuntimeState {
  try {
    const row = db.select().from(appConfig).where(eq(appConfig.key, SCHEDULER_STATE_KEY)).get();

    return row ? parseState(row.value) : DEFAULT_STATE;
  } catch {
    // Table may not exist yet during initial setup
    return DEFAULT_STATE;
  }
}

/** Convenience wrapper for the hot path in `startCron()`. */
export function isSchedulerPaused(): boolean {
  return getSchedulerRuntimeState().paused;
}

/**
 * Persist the runtime state along with the acting user and timestamp, so the
 * admin UI can always answer "who paused this, and when?".
 */
export function setSchedulerRuntimeState(
  paused: boolean,
  changedBy: string,
): SchedulerRuntimeState {
  const state: SchedulerRuntimeState = {
    paused,
    changedAt: new Date().toISOString(),
    changedBy,
  };

  const value = JSON.stringify(state);
  const now = state.changedAt!;

  const existing = db.select().from(appConfig).where(eq(appConfig.key, SCHEDULER_STATE_KEY)).get();

  if (existing) {
    db.update(appConfig)
      .set({ value, updatedAt: now })
      .where(eq(appConfig.key, SCHEDULER_STATE_KEY))
      .run();
  } else {
    db.insert(appConfig).values({ key: SCHEDULER_STATE_KEY, value, updatedAt: now }).run();
  }

  log.info({ paused, changedBy }, paused ? "Cron scheduler paused" : "Cron scheduler resumed");
  return state;
}
