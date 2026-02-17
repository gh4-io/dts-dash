import { db, sqlite } from "./client";
import * as schema from "./schema";
import { hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import { isCanceled } from "@/lib/utils/status";
import {
  SEED_USERS,
  SEED_CUSTOMERS,
  SEED_AIRCRAFT_TYPE_MAPPINGS,
  SEED_APP_CONFIG,
  SEED_MANUFACTURERS,
  SEED_AIRCRAFT_MODELS,
  SEED_ENGINE_TYPES,
  SEED_WORK_PACKAGES,
} from "./seed-data";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("seed");

function generateId(): string {
  return crypto.randomUUID();
}

// ─── Table Creation ──────────────────────────────────────────────────────────

export function createTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      force_password_change INTEGER NOT NULL DEFAULT 0,
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      color TEXT NOT NULL,
      color_text TEXT NOT NULL DEFAULT '#ffffff',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      color_mode TEXT NOT NULL DEFAULT 'dark',
      theme_preset TEXT NOT NULL DEFAULT 'vitepress',
      accent_color TEXT,
      compact_mode INTEGER NOT NULL DEFAULT 0,
      default_timezone TEXT NOT NULL DEFAULT 'UTC',
      default_date_range TEXT NOT NULL DEFAULT '3d',
      time_format TEXT NOT NULL DEFAULT '24h',
      table_page_size INTEGER NOT NULL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS work_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guid TEXT NOT NULL UNIQUE,
      sp_id INTEGER UNIQUE,
      title TEXT,
      aircraft_reg TEXT NOT NULL,
      aircraft_type TEXT,
      customer TEXT NOT NULL,
      customer_ref TEXT,
      flight_id TEXT,
      arrival TEXT NOT NULL,
      departure TEXT NOT NULL,
      total_mh REAL,
      total_ground_hours TEXT,
      status TEXT NOT NULL DEFAULT 'New',
      description TEXT,
      parent_id TEXT,
      has_workpackage INTEGER,
      workpackage_no TEXT,
      calendar_comments TEXT,
      is_not_closed_or_canceled TEXT,
      document_set_id INTEGER,
      aircraft_sp_id INTEGER,
      sp_modified TEXT,
      sp_created TEXT,
      sp_version TEXT,
      import_log_id TEXT REFERENCES import_log(id),
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mh_overrides (
      id TEXT PRIMARY KEY,
      work_package_id INTEGER NOT NULL UNIQUE REFERENCES work_packages(id),
      override_mh REAL NOT NULL,
      updated_by TEXT NOT NULL REFERENCES users(id),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS aircraft_type_mappings (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      canonical_type TEXT NOT NULL,
      description TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_log (
      id TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      source TEXT NOT NULL,
      file_name TEXT,
      imported_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      errors TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      event_type TEXT NOT NULL,
      event_data TEXT,
      page TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manufacturers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS aircraft_models (
      id TEXT PRIMARY KEY,
      model_code TEXT NOT NULL UNIQUE,
      canonical_type TEXT NOT NULL,
      manufacturer_id TEXT REFERENCES manufacturers(id),
      display_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS engine_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      manufacturer TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS aircraft (
      registration TEXT PRIMARY KEY,
      aircraft_model_id TEXT REFERENCES aircraft_models(id),
      operator_id TEXT REFERENCES customers(id),
      manufacturer_id TEXT REFERENCES manufacturers(id),
      engine_type_id TEXT REFERENCES engine_types(id),
      serial_number TEXT,
      age TEXT,
      lessor TEXT,
      category TEXT,
      operator_raw TEXT,
      operator_match_confidence INTEGER,
      source TEXT NOT NULL DEFAULT 'inferred',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS master_data_import_log (
      id TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL,
      data_type TEXT NOT NULL,
      source TEXT NOT NULL,
      format TEXT NOT NULL,
      file_name TEXT,
      records_total INTEGER NOT NULL,
      records_added INTEGER NOT NULL,
      records_updated INTEGER NOT NULL,
      records_skipped INTEGER NOT NULL,
      imported_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      warnings TEXT,
      errors TEXT
    );

    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      grace_hours INTEGER,
      last_run_at TEXT,
      last_run_status TEXT,
      last_run_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_import_log_imported_at ON import_log(imported_at);
    CREATE INDEX IF NOT EXISTS idx_wp_arrival ON work_packages(arrival);
    CREATE INDEX IF NOT EXISTS idx_wp_departure ON work_packages(departure);
    CREATE INDEX IF NOT EXISTS idx_wp_customer ON work_packages(customer);
    CREATE INDEX IF NOT EXISTS idx_wp_aircraft_reg ON work_packages(aircraft_reg);
    CREATE INDEX IF NOT EXISTS idx_wp_import_log ON work_packages(import_log_id);
    CREATE INDEX IF NOT EXISTS idx_wp_status ON work_packages(status);
    CREATE INDEX IF NOT EXISTS idx_aircraft_operator ON aircraft(operator_id);
    CREATE INDEX IF NOT EXISTS idx_aircraft_source ON aircraft(source);
    CREATE INDEX IF NOT EXISTS idx_aircraft_model ON aircraft(aircraft_model_id);
  `);
}

// ─── Migrations ──────────────────────────────────────────────────────────────

export interface MigrationResult {
  name: string;
  applied: boolean;
}

export function runMigrations(): MigrationResult[] {
  const migrations = [
    {
      name: "Add time_format to user_preferences",
      sql: "ALTER TABLE user_preferences ADD COLUMN time_format TEXT NOT NULL DEFAULT '24h'",
    },
    {
      name: "Add idempotency_key to import_log",
      sql: "ALTER TABLE import_log ADD COLUMN idempotency_key TEXT",
    },
    {
      name: "Add username to users",
      sql: "ALTER TABLE users ADD COLUMN username TEXT UNIQUE",
    },
    // Master data migrations: extend customers table
    {
      name: "Add country to customers",
      sql: "ALTER TABLE customers ADD COLUMN country TEXT",
    },
    {
      name: "Add established to customers",
      sql: "ALTER TABLE customers ADD COLUMN established TEXT",
    },
    {
      name: "Add group_parent to customers",
      sql: "ALTER TABLE customers ADD COLUMN group_parent TEXT",
    },
    {
      name: "Add base_airport to customers",
      sql: "ALTER TABLE customers ADD COLUMN base_airport TEXT",
    },
    {
      name: "Add website to customers",
      sql: "ALTER TABLE customers ADD COLUMN website TEXT",
    },
    {
      name: "Add moc_phone to customers",
      sql: "ALTER TABLE customers ADD COLUMN moc_phone TEXT",
    },
    {
      name: "Add iata_code to customers",
      sql: "ALTER TABLE customers ADD COLUMN iata_code TEXT",
    },
    {
      name: "Add icao_code to customers",
      sql: "ALTER TABLE customers ADD COLUMN icao_code TEXT",
    },
    {
      name: "Add source to customers",
      sql: "ALTER TABLE customers ADD COLUMN source TEXT NOT NULL DEFAULT 'inferred'",
    },
    {
      name: "Add created_by to customers",
      sql: "ALTER TABLE customers ADD COLUMN created_by TEXT REFERENCES users(id)",
    },
    {
      name: "Add updated_by to customers",
      sql: "ALTER TABLE customers ADD COLUMN updated_by TEXT REFERENCES users(id)",
    },
    {
      name: "Add token_version to users",
      sql: "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0",
    },
    {
      name: "Add session_token to sessions",
      sql: "ALTER TABLE sessions ADD COLUMN session_token TEXT UNIQUE",
    },
    // D-029: work_packages table — created by createTables() for new DBs.
    // For existing DBs, the CREATE TABLE IF NOT EXISTS in createTables() handles it.
    // Migration here drops broken mh_overrides (keyed by non-existent SP ID) and recreates with FK.
    {
      name: "D-029: Recreate mh_overrides with work_packages FK",
      sql: `DROP TABLE IF EXISTS mh_overrides;
            CREATE TABLE IF NOT EXISTS mh_overrides (
              id TEXT PRIMARY KEY,
              work_package_id INTEGER NOT NULL UNIQUE REFERENCES work_packages(id),
              override_mh REAL NOT NULL,
              updated_by TEXT NOT NULL REFERENCES users(id),
              updated_at TEXT NOT NULL
            )`,
    },
  ];

  const results: MigrationResult[] = [];

  for (const m of migrations) {
    try {
      sqlite.exec(m.sql);
      results.push({ name: m.name, applied: true });
    } catch {
      // Column already exists — skip
      results.push({ name: m.name, applied: false });
    }
  }

  return results;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

export async function seedData() {
  const now = new Date().toISOString();

  // ─── Users ─────────────────────────────────────────────────────────────────

  const existingAdmin = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@cvg.local"))
    .get();

  if (!existingAdmin) {
    const isProd = process.env.NODE_ENV === "production";
    const envEmail = process.env.INITIAL_ADMIN_EMAIL;
    const envPassword = process.env.INITIAL_ADMIN_PASSWORD;

    if (envEmail && envPassword) {
      // Use env-provided credentials
      db.insert(schema.users)
        .values({
          id: generateId(),
          email: envEmail.toLowerCase(),
          username: null,
          displayName: "Admin",
          passwordHash: hashSync(envPassword, 10),
          role: "superadmin" as const,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      log.info("Seeded admin user from INITIAL_ADMIN_EMAIL env var.");
    } else if (!isProd) {
      // Development only: use seed file defaults
      const regularUsers = SEED_USERS.filter((u) => u.password !== "");
      if (regularUsers.length > 0) {
        db.insert(schema.users)
          .values(
            regularUsers.map((u) => ({
              id: u.id || generateId(),
              email: u.email,
              username: u.username,
              displayName: u.displayName,
              passwordHash: hashSync(u.password, 10),
              role: u.role,
              isActive: u.isActive,
              createdAt: now,
              updatedAt: now,
            })),
          )
          .run();
        log.info(
          `Seeded ${regularUsers.length} dev users. Default passwords — change after first login.`,
        );
      }
    } else {
      log.warn(
        "No INITIAL_ADMIN_EMAIL/PASSWORD set. Skipping user seed — use /setup for first-run.",
      );
    }
  }

  // ─── System User ──────────────────────────────────────────────────────────

  const systemUser = SEED_USERS.find((u) => u.password === "");
  if (systemUser) {
    const existingSystem = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, systemUser.id!))
      .get();

    if (!existingSystem) {
      db.insert(schema.users)
        .values({
          id: systemUser.id!,
          email: systemUser.email,
          displayName: systemUser.displayName,
          passwordHash: "",
          role: systemUser.role,
          isActive: systemUser.isActive,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      log.info("Seeded system user for API ingestion");
    }
  }

  // ─── Customers ────────────────────────────────────────────────────────────

  const existingCustomers = db.select().from(schema.customers).all();

  if (existingCustomers.length === 0) {
    db.insert(schema.customers)
      .values(
        SEED_CUSTOMERS.map((c) => ({
          id: generateId(),
          ...c,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_CUSTOMERS.length} customers with colors`);
  }

  // ─── Aircraft Type Mappings ───────────────────────────────────────────────

  const existingMappings = db.select().from(schema.aircraftTypeMappings).all();

  if (existingMappings.length === 0) {
    db.insert(schema.aircraftTypeMappings)
      .values(
        SEED_AIRCRAFT_TYPE_MAPPINGS.map((m) => ({
          id: generateId(),
          ...m,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_AIRCRAFT_TYPE_MAPPINGS.length} aircraft type mappings`);
  }

  // ─── App Config ───────────────────────────────────────────────────────────

  const existingConfig = db.select().from(schema.appConfig).all();

  if (existingConfig.length === 0) {
    db.insert(schema.appConfig)
      .values(SEED_APP_CONFIG.map((d) => ({ ...d, updatedAt: now })))
      .run();
    log.info("Seeded default app configuration");
  } else {
    // Idempotent: add any missing config keys
    for (const d of SEED_APP_CONFIG) {
      const existing = db
        .select()
        .from(schema.appConfig)
        .where(eq(schema.appConfig.key, d.key))
        .get();
      if (!existing) {
        db.insert(schema.appConfig)
          .values({ ...d, updatedAt: now })
          .run();
        log.info(`Seeded config: ${d.key} = ${d.value || "(empty)"}`);
      }
    }
  }

  // ─── Cron Jobs ──────────────────────────────────────────────────────────

  const existingCronJobs = db.select().from(schema.cronJobs).all();

  if (existingCronJobs.length === 0) {
    db.insert(schema.cronJobs)
      .values({
        id: "cleanup-canceled",
        name: "Cleanup Canceled WPs",
        schedule: "0 */6 * * *",
        enabled: true,
        graceHours: 6,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    log.info("Seeded cron job: cleanup-canceled (every 6 hours, 6h grace)");
  } else {
    // Ensure cleanup-canceled job exists (idempotent)
    const existing = db
      .select()
      .from(schema.cronJobs)
      .where(eq(schema.cronJobs.id, "cleanup-canceled"))
      .get();
    if (!existing) {
      db.insert(schema.cronJobs)
        .values({
          id: "cleanup-canceled",
          name: "Cleanup Canceled WPs",
          schedule: "0 */6 * * *",
          enabled: true,
          graceHours: 6,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      log.info("Seeded missing cron job: cleanup-canceled");
    }
  }

  // ─── Manufacturers ────────────────────────────────────────────────────────

  const existingManufacturers = db.select().from(schema.manufacturers).all();

  if (existingManufacturers.length === 0) {
    db.insert(schema.manufacturers)
      .values(
        SEED_MANUFACTURERS.map((m) => ({
          id: generateId(),
          ...m,
          isActive: true,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_MANUFACTURERS.length} manufacturers`);
  }

  // ─── Aircraft Models ──────────────────────────────────────────────────────

  const existingModels = db.select().from(schema.aircraftModels).all();

  if (existingModels.length === 0) {
    // Map manufacturer name to ID for FK reference
    const manufacturerMap = new Map(
      db
        .select()
        .from(schema.manufacturers)
        .all()
        .map((m) => [m.name, m.id]),
    );

    db.insert(schema.aircraftModels)
      .values(
        SEED_AIRCRAFT_MODELS.map((m) => ({
          id: generateId(),
          modelCode: m.modelCode,
          canonicalType: m.canonicalType,
          manufacturerId: manufacturerMap.get(m.manufacturer) || null,
          displayName: m.displayName,
          sortOrder: m.sortOrder,
          isActive: true,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_AIRCRAFT_MODELS.length} aircraft models`);
  }

  // ─── Engine Types ─────────────────────────────────────────────────────────

  const existingEngines = db.select().from(schema.engineTypes).all();

  if (existingEngines.length === 0) {
    db.insert(schema.engineTypes)
      .values(
        SEED_ENGINE_TYPES.map((e) => ({
          id: generateId(),
          ...e,
          isActive: true,
        })),
      )
      .run();

    log.info(`Seeded ${SEED_ENGINE_TYPES.length} engine types`);
  }

  // ─── Work Packages (D-029) ────────────────────────────────────────────────

  const existingWPs = db.select().from(schema.workPackages).all();

  // Filter out any canceled WPs from seed data (defensive)
  const activeWPs = SEED_WORK_PACKAGES.filter((wp) => !isCanceled(wp.Workpackage_x0020_Status));

  if (existingWPs.length === 0 && activeWPs.length > 0) {
    const now = new Date().toISOString();

    // Create a seed import log entry
    const seedLogId = generateId();
    db.insert(schema.importLog)
      .values({
        id: seedLogId,
        importedAt: now,
        recordCount: activeWPs.length,
        source: "file",
        fileName: "work-packages.json (seed)",
        importedBy: "system",
        status: "success",
        errors: null,
      })
      .run();

    for (const wp of activeWPs) {
      db.insert(schema.workPackages)
        .values({
          guid: wp.GUID,
          spId: wp.ID ?? null,
          title: wp.Title ?? null,
          aircraftReg: wp.Aircraft.Title,
          aircraftType: wp.Aircraft.field_5 ?? null,
          customer: wp.Customer,
          customerRef: wp.CustomerReference ?? null,
          flightId: wp.FlightId ?? null,
          arrival: wp.Arrival,
          departure: wp.Departure,
          totalMH: wp.TotalMH ?? null,
          totalGroundHours: wp.TotalGroundHours ?? null,
          status: wp.Workpackage_x0020_Status ?? "New",
          description: wp.Description ?? null,
          parentId: wp.ParentID ?? null,
          hasWorkpackage: wp.HasWorkpackage ?? null,
          workpackageNo: wp.WorkpackageNo ?? null,
          calendarComments: wp.CalendarComments ?? null,
          isNotClosedOrCanceled: wp.IsNotClosedOrCanceled ?? null,
          documentSetId: wp.DocumentSetID ?? null,
          aircraftSpId: wp.AircraftId ?? null,
          spModified: wp.Modified ?? null,
          spCreated: wp.Created ?? null,
          spVersion: wp.OData__UIVersionString ?? null,
          importLogId: seedLogId,
          importedAt: now,
        })
        .run();
    }

    log.info(`Seeded ${activeWPs.length} work packages`);
  }

  log.info("Seeding complete.");
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function seed() {
  log.info("Seeding database...");
  createTables();
  runMigrations();
  await seedData();
}

// Allow running directly
if (require.main === module) {
  seed().catch((err) => log.error({ err }, "Seed failed"));
}
