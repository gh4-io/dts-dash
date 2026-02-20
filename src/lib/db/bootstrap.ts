/**
 * Database bootstrap — auto-initializes schema, system user, and default config
 * on server startup. Eliminates the need for manual `npm run db:seed` on first run.
 *
 * All operations are idempotent: safe to call on every startup.
 */

import { sqlite } from "./client";
import { createTables, runMigrations } from "./schema-init";
import { SYSTEM_AUTH_ID, SYSTEM_USER_EMAIL, SYSTEM_USER_DISPLAY_NAME } from "@/lib/constants";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("bootstrap");

/** Default app_config keys seeded on first run (INSERT OR IGNORE — never overwrites). */
const DEFAULT_CONFIG: Array<{ key: string; value: string }> = [
  { key: "defaultMH", value: "3.0" },
  { key: "wpMHMode", value: "include" },
  { key: "theoreticalCapacityPerPerson", value: "8.0" },
  { key: "realCapacityPerPerson", value: "6.5" },
  {
    key: "shifts",
    value: JSON.stringify([
      { name: "Day", startHour: 7, endHour: 15, headcount: 8 },
      { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
      { name: "Night", startHour: 23, endHour: 7, headcount: 4 },
    ]),
  },
  { key: "ingestApiKey", value: "" },
  { key: "ingestRateLimitSeconds", value: "60" },
  { key: "ingestMaxSizeMB", value: "50" },
  { key: "ingestChunkTimeoutSeconds", value: "300" },
  { key: "masterDataConformityMode", value: "warning" },
  { key: "masterDataOverwriteConfirmed", value: "warn" },
  {
    key: "allowedHostnames",
    value: JSON.stringify([
      {
        id: "default-localhost",
        hostname: "localhost",
        port: 3000,
        protocol: "http",
        enabled: true,
        label: "Local Development",
      },
    ]),
  },
  { key: "registrationEnabled", value: "false" },
];

/**
 * Ensure the system user row exists (internal-only, no password, inactive).
 * Used as FK target for import_log.importedBy when data is ingested via API or CLI.
 */
function ensureSystemUser(): void {
  const row = sqlite.prepare("SELECT id FROM users WHERE auth_id = ?").get(SYSTEM_AUTH_ID) as
    | { id: number }
    | undefined;

  if (row) return;

  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO users (auth_id, email, display_name, password_hash, role, is_active, force_password_change, token_version, created_at, updated_at)
       VALUES (?, ?, ?, '', 'user', 0, 0, 0, ?, ?)`,
    )
    .run(SYSTEM_AUTH_ID, SYSTEM_USER_EMAIL, SYSTEM_USER_DISPLAY_NAME, now, now);

  log.info("Created system user for API ingestion");
}

/**
 * Seed default app_config rows. Uses INSERT OR IGNORE so existing values
 * (e.g. admin-modified settings) are never overwritten.
 */
function ensureDefaultConfig(): void {
  const now = new Date().toISOString();
  const stmt = sqlite.prepare(
    "INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES (?, ?, ?)",
  );

  let inserted = 0;
  for (const { key, value } of DEFAULT_CONFIG) {
    const result = stmt.run(key, value, now);
    if (result.changes > 0) inserted++;
  }

  if (inserted > 0) {
    log.info(`Seeded ${inserted} default config key(s)`);
  }
}

/**
 * Main bootstrap entry point. Called from instrumentation.ts on server startup.
 *
 * 1. Create tables (IF NOT EXISTS)
 * 2. Run migrations (idempotent)
 * 3. Ensure system user exists
 * 4. Ensure default config keys exist
 */
export function bootstrapDatabase(): void {
  try {
    createTables();
    const migrations = runMigrations();
    const applied = migrations.filter((m) => m.applied);
    if (applied.length > 0) {
      log.info(`Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(", ")}`);
    }

    ensureSystemUser();
    ensureDefaultConfig();

    log.info("Database bootstrap complete");
  } catch (err) {
    log.error({ err }, "Database bootstrap failed");
    throw err;
  }
}
