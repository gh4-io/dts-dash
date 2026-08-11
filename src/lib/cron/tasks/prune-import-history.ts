import { db, sqlite } from "@/lib/db/client";
import { createChildLogger } from "@/lib/logger";
import type { CronTaskResult } from "@/lib/cron/index";

const log = createChildLogger("cron:prune-import-history");

/** Default retention window in days. 0 disables pruning entirely. */
export const DEFAULT_RETENTION_DAYS = 10;

export interface PruneImportHistoryResult {
  /** Rows removed from import_log. */
  pruned: number;
  /** Work packages whose import_log_id was cleared to allow the delete. */
  dereferenced: number;
  /** ISO cutoff used, or null when pruning was disabled. */
  cutoff: string | null;
}

/**
 * Delete import_log rows older than the retention window.
 *
 * Nothing is summarised or archived first — the log records a high-frequency
 * API feed whose rows carry no information once they age out (in production
 * every run has status 'success' and ~40% of them changed no records at all).
 * A durable trace belongs in a real audit log; see OPEN_ITEMS.
 *
 * Safe to run repeatedly: a second run inside the same window prunes nothing.
 */
export function pruneImportHistory(retentionDays: number): PruneImportHistoryResult {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return { pruned: 0, dereferenced: 0, cutoff: null };
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  let pruned = 0;
  let dereferenced = 0;

  db.transaction(() => {
    // work_packages.import_log_id references import_log(id) with the default
    // NO ACTION, and the connection runs with foreign_keys = ON, so the delete
    // below fails outright unless these pointers are cleared first. The column
    // is write-only provenance — nothing reads it — so nulling it loses nothing.
    dereferenced = sqlite
      .prepare(
        `UPDATE work_packages
            SET import_log_id = NULL
          WHERE import_log_id IN (SELECT id FROM import_log WHERE imported_at < ?)`,
      )
      .run(cutoff).changes;

    pruned = sqlite.prepare(`DELETE FROM import_log WHERE imported_at < ?`).run(cutoff).changes;
  });

  return { pruned, dereferenced, cutoff };
}

/**
 * Cron entry point. Conforms to the CronTaskResult interface for the orchestrator.
 */
export async function pruneImportHistoryTask(
  options: Record<string, unknown>,
): Promise<CronTaskResult> {
  const retentionDays =
    typeof options.retentionDays === "number" ? options.retentionDays : DEFAULT_RETENTION_DAYS;

  const { pruned, dereferenced, cutoff } = pruneImportHistory(retentionDays);

  if (cutoff === null) {
    log.debug("Import history retention disabled (retentionDays = 0)");
    return { message: "Retention disabled — nothing pruned" };
  }

  if (pruned === 0) {
    log.debug({ retentionDays, cutoff }, "No import history past the retention window");
    return { message: `No import runs older than ${retentionDays} day(s)` };
  }

  const message = `Pruned ${pruned} import run(s) older than ${retentionDays} day(s)`;
  log.info({ pruned, dereferenced, retentionDays, cutoff }, message);

  return { message };
}
