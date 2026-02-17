import { db, sqlite } from "@/lib/db/client";
import { cronJobs } from "@/lib/db/schema";
import { invalidateCache } from "@/lib/data/reader";
import { invalidateTransformerCache } from "@/lib/data/transformer";
import { eq } from "drizzle-orm";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("cron:cleanup-canceled");

export interface CleanupResult {
  deletedCount: number;
  overridesDeleted: number;
}

/**
 * Hard-delete canceled work packages that have exceeded the grace period.
 * Also removes orphaned MH overrides to avoid FK violations.
 */
export function cleanupCanceledWPs(graceHours: number): CleanupResult {
  const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString();

  // Find canceled WPs past the grace period
  const canceledRows = sqlite
    .prepare(`SELECT id FROM work_packages WHERE status LIKE 'Cancel%' AND imported_at < ?`)
    .all(cutoff) as { id: number }[];

  if (canceledRows.length === 0) {
    log.debug({ graceHours, cutoff }, "No canceled WPs past grace period");
    return { deletedCount: 0, overridesDeleted: 0 };
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

  log.info(
    { deletedCount: wpIds.length, overridesDeleted, graceHours, cutoff },
    "Canceled work packages purged",
  );

  // Update cron job status
  try {
    db.update(cronJobs)
      .set({
        lastRunAt: new Date().toISOString(),
        lastRunStatus: "success",
        lastRunMessage: `Deleted ${wpIds.length} canceled WP(s), ${overridesDeleted} override(s)`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(cronJobs.id, "cleanup-canceled"))
      .run();
  } catch (err) {
    log.warn({ err }, "Failed to update cron job status");
  }

  return { deletedCount: wpIds.length, overridesDeleted };
}
