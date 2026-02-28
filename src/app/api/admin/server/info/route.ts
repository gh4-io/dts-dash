import os from "os";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAppTitle } from "@/lib/config/loader";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/server/info");

// Read package.json once at module load (one-time I/O, cached by Node module system)
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")) as {
  version: string;
  dependencies?: Record<string, string>;
};

// ─── GET — Application & runtime info ───────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const mem = process.memoryUsage();
    const cpus = os.cpus();

    return NextResponse.json({
      app: {
        name: getAppTitle(),
        version: pkg.version,
        nextVersion: pkg.dependencies?.next ?? "unknown",
        environment: process.env.NODE_ENV ?? "unknown",
      },
      runtime: {
        nodeVersion: process.version,
        processUptimeMs: Math.floor(process.uptime() * 1000),
        memoryRssBytes: mem.rss,
        memoryHeapUsedBytes: mem.heapUsed,
        memoryHeapTotalBytes: mem.heapTotal,
      },
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        osType: os.type(),
        osRelease: os.release(),
        systemUptimeMs: Math.floor(os.uptime() * 1000),
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model ?? "Unknown",
        memoryTotalBytes: os.totalmem(),
        memoryFreeBytes: os.freemem(),
        loadAvg: os.loadavg() as [number, number, number],
      },
    });
  } catch (error) {
    log.error({ error }, "Failed to fetch server info");
    return NextResponse.json({ error: "Failed to fetch server info" }, { status: 500 });
  }
}
