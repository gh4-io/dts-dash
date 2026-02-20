import { db, sqlite } from "@/lib/db/client";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { createChildLogger } from "@/lib/logger";
import type { CronTaskResult } from "@/lib/cron/index";

const log = createChildLogger("cron:cleanup-canceled");

/**
 * Hard-delete canceled work packages that have exceeded the grace period.
 * Also removes orphaned MH overrides to avoid FK violations.
 *
 * Conforms to the CronTaskResult interface for the cron orchestrator.
 */
export async function cleanupCanceledWPs(
  options: Record<string, unknown>,
): Promise<CronTaskResult> {
  const graceHours = typeof options.graceHours === "number" ? options.graceHours : 6;
  const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString();

  // Find canceled WPs past the grace period
  const canceledRows = sqlite
    .prepare(`SELECT id FROM work_packages WHERE status LIKE 'Cancel%' AND imported_at < ?`)
    .all(cutoff) as { id: number }[];

  if (canceledRows.length === 0) {
    log.debug({ graceHours, cutoff }, "No canceled WPs past grace period");
    return { message: "No canceled WPs to clean up" };
  }

  const wpIds = canceledRows.map((r) => r.id);
  let overridesDeleted = 0;

  // Delete in a transaction for atomicity
  db.transaction(() => {
    // Delete MH overrides first (FK safety)
    for (const wpId of wpIds) {
      const result = sqlite.prepare("DELETE FROM mh_overrides WHERE work_package_id = ?").run(wpId);
      overridesDeleted += result.changes;
    }

    // Delete the canceled WPs
    const placeholders = wpIds.map(() => "?").join(",");
    sqlite.prepare(`DELETE FROM work_packages WHERE id IN (${placeholders})`).run(...wpIds);
  });

  // Invalidate caches
  invalidateCache();
  invalidateTransformerCache();

  const message = `Deleted ${wpIds.length} canceled WP(s), ${overridesDeleted} override(s)`;
  log.info({ deletedCount: wpIds.length, overridesDeleted, graceHours, cutoff }, message);

  return { message };
}
