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
 * Ensure default capacity modeling data exists.
 * Seeds capacity_shifts, capacity_assumptions, and headcount_plans if empty.
 * Uses INSERT OR IGNORE so existing data is never overwritten.
 */
function ensureDefaultCapacityData(): void {
  const now = new Date().toISOString();

  // Check if capacity_shifts has any rows
  const shiftCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM capacity_shifts").get() as {
    cnt: number;
  };

  if (shiftCount.cnt === 0) {
    const shifts = [
      { code: "DAY", name: "Day", startHour: 7, endHour: 15, paidHours: 8.0, sortOrder: 0 },
      { code: "SWING", name: "Swing", startHour: 15, endHour: 23, paidHours: 8.0, sortOrder: 1 },
      { code: "NIGHT", name: "Night", startHour: 23, endHour: 7, paidHours: 8.0, sortOrder: 2 },
    ];

    const insertShift = sqlite.prepare(
      `INSERT INTO capacity_shifts (code, name, start_hour, end_hour, paid_hours, min_headcount, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?, ?)`,
    );

    const insertPlan = sqlite.prepare(
      `INSERT INTO headcount_plans (station, shift_id, headcount, effective_from, label, created_at, updated_at)
       VALUES ('CVG', ?, ?, '2020-01-01', ?, ?, ?)`,
    );

    const defaultHeadcounts: Record<string, number> = { DAY: 8, SWING: 6, NIGHT: 4 };

    for (const s of shifts) {
      insertShift.run(s.code, s.name, s.startHour, s.endHour, s.paidHours, s.sortOrder, now, now);
      const row = sqlite.prepare("SELECT id FROM capacity_shifts WHERE code = ?").get(s.code) as {
        id: number;
      };
      insertPlan.run(row.id, defaultHeadcounts[s.code], `Default ${s.name} shift`, now, now);
    }

    log.info("Seeded default capacity shifts and headcount plans");
  }

  // Check if capacity_assumptions has any rows
  const assumptionCount = sqlite
    .prepare("SELECT COUNT(*) as cnt FROM capacity_assumptions")
    .get() as { cnt: number };

  if (assumptionCount.cnt === 0) {
    sqlite
      .prepare(
        `INSERT INTO capacity_assumptions (station, paid_to_available, available_to_productive, default_mh_no_wp, night_productivity_factor, demand_curve, arrival_weight, departure_weight, allocation_mode, is_active, updated_at)
         VALUES ('CVG', 0.89, 0.73, 3.0, 0.85, 'EVEN', 0.0, 0.0, 'DISTRIBUTE', 1, ?)`,
      )
      .run(now);
    log.info("Seeded default capacity assumptions");
  }
}

/**
 * Main bootstrap entry point. Called from instrumentation.ts on server startup.
 *
 * 1. Create tables (IF NOT EXISTS)
 * 2. Run migrations (idempotent)
 * 3. Ensure system user exists
 * 4. Ensure default config keys exist
 * 5. Ensure default capacity data exists
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
    ensureDefaultCapacityData();

    log.info("Database bootstrap complete");
  } catch (err) {
    log.error({ err }, "Database bootstrap failed");
    throw err;
  }
}
