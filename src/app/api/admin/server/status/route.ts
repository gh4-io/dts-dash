import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sqlite, dbPath } from "@/lib/db/client";
import { createChildLogger } from "@/lib/logger";
import fs from "fs";
import path from "path";

const log = createChildLogger("api/admin/server/status");
const startTime = Date.now();

const TABLE_NAMES = [
  "users",
  "sessions",
  "customers",
  "user_preferences",
  "work_packages",
  "mh_overrides",
  "aircraft_type_mappings",
  "manufacturers",
  "aircraft_models",
  "engine_types",
  "aircraft",
  "import_log",
  "master_data_import_log",
  "analytics_events",
  "app_config",
  "cron_job_runs",
  "feedback_posts",
  "feedback_comments",
  "feedback_labels",
  "feedback_post_labels",
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function dirSize(dirPath: string): number {
  let total = 0;
  try {
    for (const f of fs.readdirSync(dirPath)) {
      const fp = path.join(dirPath, f);
      const stat = fs.statSync(fp);
      total += stat.isDirectory() ? dirSize(fp) : stat.size;
    }
  } catch {
    // Directory may not exist
  }
  return total;
}

// ─── GET — Server & database status ─────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Database file info
    const dbStat = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
    const walPath = dbPath + "-wal";
    const walStat = fs.existsSync(walPath) ? fs.statSync(walPath) : null;

    // Table row counts
    const tables: Record<string, number> = {};
    let totalRows = 0;
    for (const table of TABLE_NAMES) {
      try {
        const result = sqlite.prepare(`SELECT count(*) as count FROM ${table}`).get() as {
          count: number;
        };
        tables[table] = result?.count ?? 0;
        totalRows += tables[table];
      } catch {
        tables[table] = -1; // Table may not exist
      }
    }

    // Last import
    let lastImport: {
      importedAt: string;
      recordCount: number;
      source: string;
      fileName: string | null;
    } | null = null;
    try {
      const row = sqlite
        .prepare(
          "SELECT imported_at, record_count, source, file_name FROM import_log ORDER BY imported_at DESC LIMIT 1",
        )
        .get() as
        | {
            imported_at: string;
            record_count: number;
            source: string;
            file_name: string | null;
          }
        | undefined;
      if (row) {
        lastImport = {
          importedAt: row.imported_at,
          recordCount: row.record_count,
          source: row.source,
          fileName: row.file_name,
        };
      }
    } catch {
      // import_log table may not exist
    }

    // Canceled WPs count
    let canceledCount = 0;
    try {
      const result = sqlite
        .prepare("SELECT count(*) as count FROM work_packages WHERE status LIKE 'Cancel%'")
        .get() as { count: number };
      canceledCount = result?.count ?? 0;
    } catch {
      // Table may not exist
    }

    // Backup info
    const backupsDir = path.join(process.cwd(), "data", "backups");
    let backupCount = 0;
    let lastBackup: string | null = null;
    let backupsTotalSize = 0;
    try {
      if (fs.existsSync(backupsDir)) {
        const entries = fs
          .readdirSync(backupsDir)
          .filter((e) => fs.statSync(path.join(backupsDir, e)).isDirectory())
          .sort()
          .reverse();
        backupCount = entries.length;
        lastBackup = entries[0] ?? null;
        backupsTotalSize = dirSize(backupsDir);
      }
    } catch {
      // Backups dir may not exist
    }

    const uptimeMs = Date.now() - startTime;

    return NextResponse.json({
      database: {
        path: path.relative(process.cwd(), dbPath),
        size: dbStat ? formatBytes(dbStat.size) : "N/A",
        sizeBytes: dbStat?.size ?? 0,
        walSize: walStat ? formatBytes(walStat.size) : "0 B",
        walSizeBytes: walStat?.size ?? 0,
        modified: dbStat?.mtime?.toISOString() ?? null,
      },
      tables,
      totalRows,
      lastImport,
      canceledCount,
      backups: {
        count: backupCount,
        lastBackup,
        totalSize: formatBytes(backupsTotalSize),
      },
      uptime: `${Math.floor(uptimeMs / 1000)}s`,
      uptimeMs,
    });
  } catch (error) {
    log.error({ error }, "Failed to fetch server status");
    return NextResponse.json({ error: "Failed to fetch server status" }, { status: 500 });
  }
}
