import { db, sqlite } from "./client";
import * as schema from "./schema";
import { hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";
import { SEED_CUSTOMERS, SEED_AIRCRAFT_TYPE_MAPPINGS } from "./seed-data";

function generateId(): string {
  return crypto.randomUUID();
}

export async function seed() {
  console.warn("Seeding database...");

  // Create tables using raw SQL (Drizzle push would be better but this works for bootstrap)
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS mh_overrides (
      id TEXT PRIMARY KEY,
      work_package_id INTEGER NOT NULL UNIQUE,
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

    CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_import_log_imported_at ON import_log(imported_at);
  `);

  // ─── Migration: add time_format column to existing DBs ─────────────────
  try {
    sqlite.exec(`ALTER TABLE user_preferences ADD COLUMN time_format TEXT NOT NULL DEFAULT '24h'`);
  } catch {
    // Column already exists — ignore
  }

  // ─── Migration: add idempotency_key column to import_log ────────────────
  try {
    sqlite.exec(`ALTER TABLE import_log ADD COLUMN idempotency_key TEXT`);
  } catch {
    // Column already exists — ignore
  }

  // ─── Migration: add username column to users ──────────────────────────
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN username TEXT UNIQUE`);
  } catch {
    // Column already exists — ignore
  }

  // ─── Seed Users ──────────────────────────────────────────────────────────

  const existingAdmin = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@cvg.local"))
    .get();

  if (!existingAdmin) {
    const now = new Date().toISOString();

    db.insert(schema.users)
      .values([
        {
          id: generateId(),
          email: "admin@cvg.local",
          username: "admin",
          displayName: "Admin",
          passwordHash: hashSync("admin123", 10),
          role: "superadmin",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: generateId(),
          email: "user@cvg.local",
          username: "user",
          displayName: "Test User",
          passwordHash: hashSync("user123", 10),
          role: "user",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    console.warn("  Seeded 2 users (admin@cvg.local, user@cvg.local). Default passwords in use — change after first login.");
  }

  // ─── Seed System User (API Ingest) ─────────────────────────────────────

  const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
  const existingSystem = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, SYSTEM_USER_ID))
    .get();

  if (!existingSystem) {
    const now = new Date().toISOString();
    db.insert(schema.users)
      .values({
        id: SYSTEM_USER_ID,
        email: "system@internal",
        displayName: "API Ingest",
        passwordHash: "",
        role: "user",
        isActive: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    console.warn("  Seeded system user for API ingestion");
  }

  // ─── Seed Customers ──────────────────────────────────────────────────────

  const existingCustomers = db.select().from(schema.customers).all();

  if (existingCustomers.length === 0) {
    const now = new Date().toISOString();

    db.insert(schema.customers)
      .values(
        SEED_CUSTOMERS.map((c) => ({
          id: generateId(),
          ...c,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .run();

    console.warn("  Seeded 6 customers with colors");
  }

  // ─── Seed Aircraft Type Mappings (D-015) ──────────────────────────────────

  const existingMappings = db.select().from(schema.aircraftTypeMappings).all();

  if (existingMappings.length === 0) {
    const now = new Date().toISOString();

    db.insert(schema.aircraftTypeMappings)
      .values(
        SEED_AIRCRAFT_TYPE_MAPPINGS.map((m) => ({
          id: generateId(),
          ...m,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .run();

    console.warn(`  Seeded ${SEED_AIRCRAFT_TYPE_MAPPINGS.length} aircraft type mappings`);
  }

  // ─── Seed Default Config ─────────────────────────────────────────────────

  const existingConfig = db.select().from(schema.appConfig).all();

  if (existingConfig.length === 0) {
    const now = new Date().toISOString();
    const defaults = [
      { key: "defaultMH", value: "3.0" },
      { key: "wpMHMode", value: "include" },
      { key: "theoreticalCapacityPerPerson", value: "8.0" },
      { key: "realCapacityPerPerson", value: "6.5" },
      { key: "timelineDefaultDays", value: "3" },
      { key: "defaultTimezone", value: "UTC" },
      {
        key: "shifts",
        value: JSON.stringify([
          { name: "Day", startHour: 7, endHour: 15, headcount: 8 },
          { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
          { name: "Night", startHour: 23, endHour: 7, headcount: 4 },
        ]),
      },
    ];

    db.insert(schema.appConfig)
      .values(defaults.map((d) => ({ ...d, updatedAt: now })))
      .run();

    console.warn("  Seeded default app configuration");
  }

  // ─── Seed Ingest Config Defaults (idempotent) ──────────────────────────

  const ingestDefaults = [
    { key: "ingestApiKey", value: "" },
    { key: "ingestRateLimitSeconds", value: "60" },
    { key: "ingestMaxSizeMB", value: "50" },
  ];

  for (const d of ingestDefaults) {
    const existing = db
      .select()
      .from(schema.appConfig)
      .where(eq(schema.appConfig.key, d.key))
      .get();
    if (!existing) {
      db.insert(schema.appConfig)
        .values({ ...d, updatedAt: new Date().toISOString() })
        .run();
      console.warn(`  Seeded config: ${d.key} = ${d.value || "(empty)"}`);
    }
  }

  console.warn("Seeding complete.");
}

// Allow running directly
if (require.main === module) {
  seed().catch(console.error);
}
