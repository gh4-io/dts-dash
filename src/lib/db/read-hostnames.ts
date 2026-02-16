import Database from "better-sqlite3";
import path from "path";

/**
 * Synchronously reads allowed hostnames from app_config for next.config.ts.
 * Returns origin strings for allowedDevOrigins (e.g., "http://localhost:3000").
 * Falls back to empty array if the DB doesn't exist yet (first run before seed).
 */
export function readAllowedDevOrigins(): string[] {
  try {
    const dbPath = path.join(process.cwd(), "data", "dashboard.db");
    const db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = ?")
      .get("allowedHostnames") as { value: string } | undefined;
    db.close();

    if (!row?.value) return [];

    const hostnames = JSON.parse(row.value) as Array<{
      hostname: string;
      port: number | null;
      protocol: string;
      enabled: boolean;
    }>;

    return hostnames
      .filter((h) => h.enabled)
      .map((h) => {
        const origin = `${h.protocol}://${h.hostname}`;
        return h.port ? `${origin}:${h.port}` : origin;
      });
  } catch {
    return [];
  }
}
