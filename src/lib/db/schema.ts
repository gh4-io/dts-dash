import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";

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

  // Extended metadata (from SharePoint cust.json)
  country: text("country"),
  established: text("established"), // ISO date string
  groupParent: text("group_parent"),
  baseAirport: text("base_airport"),
  website: text("website"),
  mocPhone: text("moc_phone"),
  iataCode: text("iata_code"),
  icaoCode: text("icao_code"),

  // Source tracking
  source: text("source", {
    enum: ["inferred", "imported", "confirmed"],
  })
    .notNull()
    .default("inferred"),

  // Audit fields
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  createdBy: text("created_by").references(() => users.id),
  updatedBy: text("updated_by").references(() => users.id),
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

// ─── Master Data: Manufacturers ─────────────────────────────────────────────

export const manufacturers = sqliteTable("manufacturers", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Master Data: Aircraft Models ───────────────────────────────────────────

export const aircraftModels = sqliteTable("aircraft_models", {
  id: text("id").primaryKey(),
  modelCode: text("model_code").notNull().unique(), // "767-200(F)", "777F"
  canonicalType: text("canonical_type").notNull(), // B777, B767, etc.
  manufacturerId: text("manufacturer_id").references(() => manufacturers.id),
  displayName: text("display_name").notNull(), // "Boeing 767-200 Freighter"
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Master Data: Engine Types ──────────────────────────────────────────────

export const engineTypes = sqliteTable("engine_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(), // "CF6-80C2", "PW4000"
  manufacturer: text("manufacturer"), // "GE", "Pratt & Whitney"
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Master Data: Aircraft ──────────────────────────────────────────────────

export const aircraft = sqliteTable(
  "aircraft",
  {
    registration: text("registration").primaryKey(), // e.g., "C-FOIJ"

    // Foreign keys to lookup tables
    aircraftModelId: text("aircraft_model_id").references(
      () => aircraftModels.id
    ),
    operatorId: text("operator_id").references(() => customers.id),
    manufacturerId: text("manufacturer_id").references(() => manufacturers.id),
    engineTypeId: text("engine_type_id").references(() => engineTypes.id),

    // Extended metadata (from SharePoint ac.json)
    serialNumber: text("serial_number"),
    age: text("age"), // "41.1 Years" (as-is from SharePoint)
    lessor: text("lessor"), // field_1 from ac.json
    category: text("category"), // field_3 from ac.json (e.g., "Cargo")

    // Fuzzy match metadata
    operatorRaw: text("operator_raw"), // Original operator string before fuzzy match
    operatorMatchConfidence: integer("operator_match_confidence"), // 0-100

    // Source tracking
    source: text("source", {
      enum: ["inferred", "imported", "confirmed"],
    })
      .notNull()
      .default("inferred"),

    // Soft delete
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),

    // Audit
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
  },
  (table) => ({
    operatorIdx: index("aircraft_operator_idx").on(table.operatorId),
    sourceIdx: index("aircraft_source_idx").on(table.source),
    modelIdx: index("aircraft_model_idx").on(table.aircraftModelId),
  })
);

// ─── Master Data Import Log ─────────────────────────────────────────────────

export const masterDataImportLog = sqliteTable("master_data_import_log", {
  id: text("id").primaryKey(),
  importedAt: text("imported_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  dataType: text("data_type", { enum: ["customer", "aircraft"] }).notNull(),
  source: text("source", { enum: ["file", "paste", "api"] }).notNull(),
  format: text("format", { enum: ["csv", "json"] }).notNull(),
  fileName: text("file_name"),

  recordsTotal: integer("records_total").notNull(),
  recordsAdded: integer("records_added").notNull(),
  recordsUpdated: integer("records_updated").notNull(),
  recordsSkipped: integer("records_skipped").notNull(),

  importedBy: text("imported_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["success", "partial", "failed"] }).notNull(),
  warnings: text("warnings"), // JSON array
  errors: text("errors"), // JSON array
});
