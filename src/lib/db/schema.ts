import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["user", "admin", "superadmin"] })
    .notNull()
    .default("user"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  forcePasswordChange: integer("force_password_change", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Sessions (Auth.js) ─────────────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Customers ──────────────────────────────────────────────────────────────

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  color: text("color").notNull(),
  colorText: text("color_text").notNull().default("#ffffff"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── User Preferences ───────────────────────────────────────────────────────

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  colorMode: text("color_mode", { enum: ["light", "dark", "system"] })
    .notNull()
    .default("dark"),
  themePreset: text("theme_preset").notNull().default("vitepress"),
  accentColor: text("accent_color"),
  compactMode: integer("compact_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  defaultTimezone: text("default_timezone").notNull().default("UTC"),
  defaultDateRange: text("default_date_range", { enum: ["1d", "3d", "1w"] })
    .notNull()
    .default("3d"),
  timeFormat: text("time_format", { enum: ["12h", "24h"] })
    .notNull()
    .default("24h"),
  tablePageSize: integer("table_page_size").notNull().default(30),
});

// ─── MH Overrides ───────────────────────────────────────────────────────────

export const mhOverrides = sqliteTable("mh_overrides", {
  id: text("id").primaryKey(),
  workPackageId: integer("work_package_id").notNull().unique(),
  overrideMH: real("override_mh").notNull(),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => users.id),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Aircraft Type Mappings (D-015) ─────────────────────────────────────────

export const aircraftTypeMappings = sqliteTable("aircraft_type_mappings", {
  id: text("id").primaryKey(),
  pattern: text("pattern").notNull(),
  canonicalType: text("canonical_type", {
    enum: ["B777", "B767", "B747", "B757", "B737", "Unknown"],
  }).notNull(),
  description: text("description"),
  priority: integer("priority").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Import Log ─────────────────────────────────────────────────────────────

export const importLog = sqliteTable("import_log", {
  id: text("id").primaryKey(),
  importedAt: text("imported_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  recordCount: integer("record_count").notNull(),
  source: text("source", { enum: ["file", "paste", "api"] }).notNull(),
  fileName: text("file_name"),
  importedBy: text("imported_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["success", "partial", "failed"] }).notNull(),
  errors: text("errors"),
  idempotencyKey: text("idempotency_key"),
});

// ─── Analytics Events ───────────────────────────────────────────────────────

export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  eventType: text("event_type").notNull(),
  eventData: text("event_data"),
  page: text("page"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── App Config ─────────────────────────────────────────────────────────────

export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
