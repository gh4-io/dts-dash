import { db, sqlite } from "./client";
import * as schema from "./schema";
import { hashSync } from "bcryptjs";
import { eq } from "drizzle-orm";

function generateId(): string {
  return crypto.randomUUID();
}

export async function seed() {
  console.log("Seeding database...");

  // Create tables using raw SQL (Drizzle push would be better but this works for bootstrap)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
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
      theme_preset TEXT NOT NULL DEFAULT 'neutral',
      accent_color TEXT,
      compact_mode INTEGER NOT NULL DEFAULT 0,
      default_timezone TEXT NOT NULL DEFAULT 'UTC',
      default_date_range TEXT NOT NULL DEFAULT '3d',
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
          displayName: "Test User",
          passwordHash: hashSync("user123", 10),
          role: "user",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    console.log("  Seeded 2 users (admin@cvg.local / admin123, user@cvg.local / user123)");
  }

  // ─── Seed Customers ──────────────────────────────────────────────────────

  const existingCustomers = db.select().from(schema.customers).all();

  if (existingCustomers.length === 0) {
    const now = new Date().toISOString();
    const seedCustomers = [
      { name: "CargoJet Airways", displayName: "CargoJet", color: "#22c55e", colorText: "#ffffff", sortOrder: 1 },
      { name: "Aerologic", displayName: "Aerologic", color: "#8b5cf6", colorText: "#ffffff", sortOrder: 2 },
      { name: "Kalitta Air", displayName: "Kalitta Air", color: "#f97316", colorText: "#ffffff", sortOrder: 3 },
      { name: "DHL Air UK", displayName: "DHL Air UK", color: "#ef4444", colorText: "#ffffff", sortOrder: 4 },
      { name: "Kalitta Charters II", displayName: "Kalitta Chrt II", color: "#06b6d4", colorText: "#ffffff", sortOrder: 5 },
      { name: "21 Air", displayName: "21 Air", color: "#ec4899", colorText: "#ffffff", sortOrder: 6 },
    ];

    db.insert(schema.customers)
      .values(
        seedCustomers.map((c) => ({
          id: generateId(),
          ...c,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .run();

    console.log("  Seeded 6 customers with colors");
  }

  // ─── Seed Aircraft Type Mappings (D-015) ──────────────────────────────────

  const existingMappings = db.select().from(schema.aircraftTypeMappings).all();

  if (existingMappings.length === 0) {
    const now = new Date().toISOString();
    const seedMappings = [
      // Exact matches (highest priority)
      { pattern: "^B777$", canonicalType: "B777" as const, description: "Exact B777", priority: 100 },
      { pattern: "^B767$", canonicalType: "B767" as const, description: "Exact B767", priority: 100 },
      { pattern: "^B747$", canonicalType: "B747" as const, description: "Exact B747", priority: 100 },
      { pattern: "^B757$", canonicalType: "B757" as const, description: "Exact B757", priority: 100 },
      { pattern: "^B737$", canonicalType: "B737" as const, description: "Exact B737", priority: 100 },
      // Pattern matches (lower priority)
      { pattern: "777", canonicalType: "B777" as const, description: "Contains 777", priority: 50 },
      { pattern: "767", canonicalType: "B767" as const, description: "Contains 767", priority: 50 },
      { pattern: "747", canonicalType: "B747" as const, description: "Contains 747 (incl 747-4R7F, 747F)", priority: 50 },
      { pattern: "757", canonicalType: "B757" as const, description: "Contains 757", priority: 50 },
      { pattern: "737", canonicalType: "B737" as const, description: "Contains 737 (incl 737-200)", priority: 50 },
    ];

    db.insert(schema.aircraftTypeMappings)
      .values(
        seedMappings.map((m) => ({
          id: generateId(),
          ...m,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .run();

    console.log("  Seeded 10 aircraft type mappings");
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

    console.log("  Seeded default app configuration");
  }

  console.log("Seeding complete.");
}

// Allow running directly
if (require.main === module) {
  seed().catch(console.error);
}
