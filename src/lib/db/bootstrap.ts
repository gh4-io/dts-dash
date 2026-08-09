/**
 * Database bootstrap — auto-initializes schema, system user, and default config
 * on server startup. Eliminates the need for manual `npm run db:seed` on first run.
 *
 * All operations are idempotent: safe to call on every startup.
 */

import { sqlite } from "./client";
import { createTables, runMigrations, assertSchemaCompatible } from "./schema-init";
import { backfillMessages, assertMessagesReconciled } from "./backfill/messages-backfill";
import { SYSTEM_AUTH_ID, SYSTEM_USER_EMAIL, SYSTEM_USER_DISPLAY_NAME } from "@/lib/constants";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("bootstrap");

/** Default app_config keys seeded on first run (INSERT OR IGNORE — never overwrites). */
const DEFAULT_CONFIG: Array<{ key: string; value: string }> = [
  { key: "defaultMH", value: "3.0" },
  { key: "wpMHMode", value: "include" },
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
    // Derive paidHours from start/end times instead of hardcoding
    const computeShiftHours = (start: number, end: number): number =>
      end > start ? end - start : 24 - start + end;

    const shifts = [
      {
        code: "DAY",
        name: "Day",
        startHour: 7,
        endHour: 15,
        paidHours: computeShiftHours(7, 15),
        sortOrder: 0,
      },
      {
        code: "SWING",
        name: "Swing",
        startHour: 15,
        endHour: 23,
        paidHours: computeShiftHours(15, 23),
        sortOrder: 1,
      },
      {
        code: "NIGHT",
        name: "Night",
        startHour: 23,
        endHour: 7,
        paidHours: computeShiftHours(23, 7),
        sortOrder: 2,
      },
    ];

    const insertShift = sqlite.prepare(
      `INSERT INTO capacity_shifts (code, name, start_hour, end_hour, paid_hours, timezone, min_headcount, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'UTC', 1, ?, 1, ?, ?)`,
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
 * Seed default rotation patterns and a default staffing config if none exist.
 */
function ensureDefaultStaffingData(): void {
  const now = new Date().toISOString();

  // Check if rotation_patterns has any rows
  const patternCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM rotation_patterns").get() as {
    cnt: number;
  };

  if (patternCount.cnt === 0) {
    const patterns = [
      { name: "Standard 5-2", pattern: "oxxxxoxoxxxxoxoxxxxox", sort: 0 },
      { name: "Compressed 4-3", pattern: "oxxxxoooxxxxoooxxxxoo", sort: 1 },
      { name: "Weekend Bridge", pattern: "xoooooxxoooooxxooooox", sort: 2 },
      { name: "Panama 2-2-3", pattern: "xxooxxxooxxoooxxooxxx", sort: 3 },
      { name: "3-Week Rotation A", pattern: "oxxxooxooxxxoxoxxooox", sort: 4 },
    ];

    const insertPattern = sqlite.prepare(
      `INSERT INTO rotation_patterns (name, pattern, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, ?)`,
    );

    for (const p of patterns) {
      insertPattern.run(p.name, p.pattern, p.sort, now, now);
    }

    log.info("Seeded 5 default rotation patterns");
  }

  // Check if staffing_configs has any rows
  const configCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM staffing_configs").get() as {
    cnt: number;
  };

  if (configCount.cnt === 0) {
    sqlite
      .prepare(
        `INSERT INTO staffing_configs (name, description, is_active, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?)`,
      )
      .run("Default Configuration", "Auto-created default staffing configuration", now, now);

    log.info("Seeded default staffing configuration");
  }
}

/**
 * Move the six pre-v1.0.0 messaging tables into messages/labels/message_labels,
 * then refuse to continue if the counts do not reconcile (OI-099).
 *
 * ── Why this runs at boot rather than in a script ────────────────────────────
 *
 * `createTables()` above has just created `messages` EMPTY on a database whose
 * old tables still hold every comment, notification and feedback post. In that
 * window the app is fully functional and shows zero of all three. No error, no
 * exception, no log line — an empty thread looks exactly like a migrated one.
 *
 * Had this been a standalone script, any operator who forgot to run it would
 * have that as the permanent state of their installation and no way to notice.
 * The same class of failure already bit this release once: after OI-086 renamed
 * a column, the dev database went un-upgraded and the app happily rendered blank
 * work-package identifiers.
 *
 * The reconciliation guard therefore THROWS, which stops startup. That is the
 * intent: a crash with a message is the only failure mode anyone will see, and
 * the legacy tables are still intact for a rollback.
 *
 * On a fresh install none of the legacy tables exist and this is a no-op.
 */
function ensureMessagesBackfilled(): void {
  const result = backfillMessages({ db: sqlite });
  if (!result.ran) return;

  for (const warning of result.warnings) {
    log.warn({ warning }, "Messages backfill warning");
  }

  // Throws on any mismatch — see the comment above.
  assertMessagesReconciled(result);

  if (result.inserted > 0 || result.parentsRemapped > 0 || result.metadataRemapped > 0) {
    log.info(
      {
        inserted: result.inserted,
        alreadyPresent: result.alreadyPresent,
        orphansSkipped: result.orphansSkipped,
        parentsRemapped: result.parentsRemapped,
        metadataRemapped: result.metadataRemapped,
        sourceCounts: result.sourceCounts,
      },
      "Messages backfill complete (OI-099)",
    );
  }
}

/**
 * Main bootstrap entry point. Called from instrumentation.ts on server startup.
 *
 * 1. Create tables (IF NOT EXISTS)
 * 2. Run migrations (idempotent — returns [] since v1.0.0)
 * 3. Backfill messages + reconcile (OI-099) — THROWS on mismatch
 * 4. Ensure system user exists
 * 5. Ensure default config keys exist
 * 6. Ensure default capacity data exists
 * 7. Ensure default staffing data exists
 */
export function bootstrapDatabase(): void {
  try {
    createTables();

    // Before anything reads a column that moved in v1.0.0. createTables() is
    // additive and cannot bring an older database forward — db:upgrade-v1 does
    // that — so this is the line between "not upgraded yet" and "silently
    // serving wrong data".
    assertSchemaCompatible();

    const migrations = runMigrations();
    const applied = migrations.filter((m) => m.applied);
    if (applied.length > 0) {
      log.info(`Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(", ")}`);
    }

    // Must come immediately after the schema exists and before anything reads
    // messages — see ensureMessagesBackfilled for why this is not a script.
    ensureMessagesBackfilled();

    ensureSystemUser();
    ensureDefaultConfig();
    ensureDefaultCapacityData();
    ensureDefaultStaffingData();

    log.info("Database bootstrap complete");
  } catch (err) {
    log.error({ err }, "Database bootstrap failed");
    throw err;
  }
}
