import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "dashboard.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// Set busy timeout before any other operations to handle concurrent build workers
sqlite.pragma("busy_timeout = 5000");
// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
// Performance tuning — safe in WAL mode
sqlite.pragma("synchronous = NORMAL"); // reduce fsync overhead; still crash-safe in WAL
sqlite.pragma("cache_size = -65536"); // 64 MB page cache (negative = KiB)
sqlite.pragma("temp_store = MEMORY"); // temp tables and indexes in memory
sqlite.pragma("mmap_size = 268435456"); // 256 MB memory-mapped I/O

export const db = drizzle(sqlite, { schema });

export { sqlite };
export { DB_PATH as dbPath };

// Graceful shutdown — stop cron + close SQLite on process termination
function shutdown() {
  // Lazy dynamic import to avoid circular imports (cron → db/client → cron)
  import("@/lib/cron/index")
    .then(({ stopCron }) => stopCron())
    .catch(() => {
      // Cron module may not be loaded yet — ignore
    })
    .finally(() => {
      try {
        sqlite.close();
      } catch {
        // Already closed or error — ignore
      }
      process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
