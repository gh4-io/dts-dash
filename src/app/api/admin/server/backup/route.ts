import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sqlite, dbPath } from "@/lib/db/client";
import { createChildLogger } from "@/lib/logger";
import fs from "fs";
import path from "path";

const log = createChildLogger("api/admin/server/backup");

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// ─── POST — Create database backup ─────────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: "Database file not found" }, { status: 404 });
    }

    const ts = timestamp();
    const backupDir = path.join(process.cwd(), "data", "backups", ts);
    fs.mkdirSync(backupDir, { recursive: true });

    // Flush WAL for consistent snapshot
    try {
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      log.warn("Could not checkpoint WAL (non-critical)");
    }

    // Copy database file
    const destPath = path.join(backupDir, "dashboard.db");
    fs.copyFileSync(dbPath, destPath);

    const size = fs.statSync(destPath).size;

    log.info(
      {
        userId: session.user.id,
        userEmail: session.user.email,
        backupDir: `data/backups/${ts}/`,
        size: formatBytes(size),
      },
      "Database backup created",
    );

    return NextResponse.json({
      message: "Backup created successfully",
      backupPath: `data/backups/${ts}/`,
      size: formatBytes(size),
    });
  } catch (error) {
    log.error({ error }, "Failed to create backup");
    return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
  }
}
