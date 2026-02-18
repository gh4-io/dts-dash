import { sqliteTable, text, integer, real, index, primaryKey } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authId: text("auth_id").notNull().unique(),
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
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Sessions (Auth.js) ─────────────────────────────────────────────────────

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionToken: text("session_token").unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    expiresIdx: index("idx_sessions_expires").on(table.expiresAt),
  }),
);

// ─── Customers ──────────────────────────────────────────────────────────────

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

  // SharePoint identifiers
  spId: integer("sp_id").unique(), // from cust.json ID field
  guid: text("guid").unique(), // SharePoint GUID from cust.json — primary dedup key when present

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
  createdBy: integer("created_by").references(() => users.id),
  updatedBy: integer("updated_by").references(() => users.id),
});

// ─── User Preferences ───────────────────────────────────────────────────────

export const userPreferences = sqliteTable("user_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  colorMode: text("color_mode", { enum: ["light", "dark", "system"] })
    .notNull()
    .default("dark"),
  themePreset: text("theme_preset").notNull().default("vitepress"),
  accentColor: text("accent_color"),
  compactMode: integer("compact_mode", { mode: "boolean" }).notNull().default(false),
  defaultTimezone: text("default_timezone").notNull().default("UTC"),
  defaultDateRange: text("default_date_range", { enum: ["1d", "3d", "1w"] }),
  defaultZoom: text("default_zoom"),
  timeFormat: text("time_format", { enum: ["12h", "24h"] })
    .notNull()
    .default("24h"),
  tablePageSize: integer("table_page_size").notNull().default(30),
});

// ─── Work Packages (D-029) ──────────────────────────────────────────────────

export const workPackages = sqliteTable(
  "work_packages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guid: text("guid").notNull().unique(),
    spId: integer("sp_id").unique(),

    // Core fields
    title: text("title"),
    aircraftReg: text("aircraft_reg").notNull(),
    aircraftType: text("aircraft_type"),
    customer: text("customer").notNull(),
    customerRef: text("customer_ref"),
    flightId: text("flight_id"),
    arrival: text("arrival").notNull(),
    departure: text("departure").notNull(),
    totalMH: real("total_mh"),
    totalGroundHours: text("total_ground_hours"),
    status: text("status").notNull().default("New"),
    description: text("description"),
    parentId: text("parent_id"),

    // Optional fields (present in some SP exports)
    hasWorkpackage: integer("has_workpackage", { mode: "boolean" }),
    workpackageNo: text("workpackage_no"),
    calendarComments: text("calendar_comments"),
    isNotClosedOrCanceled: text("is_not_closed_or_canceled"),
    documentSetId: integer("document_set_id"),
    aircraftSpId: integer("aircraft_sp_id"),

    // SP ID stubs for future linking
    customerSpId: integer("customer_sp_id"), // stub — no source in wp.json currently

    // SharePoint metadata
    spModified: text("sp_modified"),
    spCreated: text("sp_created"),
    spVersion: text("sp_version"),

    // Import metadata
    importLogId: integer("import_log_id").references(() => importLog.id),
    importedAt: text("imported_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    arrivalIdx: index("idx_wp_arrival").on(table.arrival),
    departureIdx: index("idx_wp_departure").on(table.departure),
    customerIdx: index("idx_wp_customer").on(table.customer),
    aircraftRegIdx: index("idx_wp_aircraft_reg").on(table.aircraftReg),
    importLogIdx: index("idx_wp_import_log").on(table.importLogId),
    statusIdx: index("idx_wp_status").on(table.status),
    // Compound indexes for date range and filtered queries
    arrivalDepartureIdx: index("idx_wp_arrival_departure").on(table.arrival, table.departure),
    customerArrivalIdx: index("idx_wp_customer_arrival").on(table.customer, table.arrival),
  }),
);

// ─── MH Overrides ───────────────────────────────────────────────────────────

export const mhOverrides = sqliteTable("mh_overrides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workPackageId: integer("work_package_id")
    .notNull()
    .unique()
    .references(() => workPackages.id),
  overrideMH: real("override_mh").notNull(),
  updatedBy: integer("updated_by")
    .notNull()
    .references(() => users.id),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Aircraft Type Mappings (D-015) ─────────────────────────────────────────

export const aircraftTypeMappings = sqliteTable("aircraft_type_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  id: integer("id").primaryKey({ autoIncrement: true }),
  importedAt: text("imported_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  recordCount: integer("record_count").notNull(),
  source: text("source", { enum: ["file", "paste", "api"] }).notNull(),
  fileName: text("file_name"),
  importedBy: integer("imported_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["success", "partial", "failed"] }).notNull(),
  errors: text("errors"),
  idempotencyKey: text("idempotency_key"),
});

// ─── Analytics Events ───────────────────────────────────────────────────────

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    eventType: text("event_type").notNull(),
    eventData: text("event_data"),
    page: text("page"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    userCreatedIdx: index("idx_ae_user_created").on(table.userId, table.createdAt),
  }),
);

// ─── App Config ─────────────────────────────────────────────────────────────

export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Cron Job Runs (runtime state only — config lives in code + YAML) ──────

export const cronJobRuns = sqliteTable("cron_job_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobKey: text("job_key").notNull().unique(),
  lastRunAt: text("last_run_at"),
  lastRunStatus: text("last_run_status", { enum: ["success", "error"] }),
  lastRunMessage: text("last_run_message"),
  runCount: integer("run_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Master Data: Manufacturers ─────────────────────────────────────────────

export const manufacturers = sqliteTable("manufacturers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Master Data: Aircraft Models ───────────────────────────────────────────

export const aircraftModels = sqliteTable("aircraft_models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelCode: text("model_code").notNull().unique(), // "767-200(F)", "777F"
  canonicalType: text("canonical_type").notNull(), // B777, B767, etc.
  manufacturerId: integer("manufacturer_id").references(() => manufacturers.id),
  displayName: text("display_name").notNull(), // "Boeing 767-200 Freighter"
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Master Data: Engine Types ──────────────────────────────────────────────

export const engineTypes = sqliteTable("engine_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // "CF6-80C2", "PW4000"
  manufacturer: text("manufacturer"), // "GE", "Pratt & Whitney"
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Master Data: Aircraft ──────────────────────────────────────────────────

export const aircraft = sqliteTable(
  "aircraft",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    registration: text("registration").notNull().unique(), // e.g., "C-FOIJ"

    // SharePoint identifiers
    spId: integer("sp_id").unique(), // from ac.json ID field — links work_packages.aircraft_sp_id
    guid: text("guid").unique(), // SharePoint GUID from ac.json — primary dedup key when present

    // Direct type from ac.json field_5 (e.g. "767-200(F)") — truth source for type resolution
    aircraftType: text("aircraft_type"),

    // Foreign keys to lookup tables (optional refinement — populated when models/mfr seeded)
    aircraftModelId: integer("aircraft_model_id").references(() => aircraftModels.id),
    operatorId: integer("operator_id").references(() => customers.id),
    manufacturerId: integer("manufacturer_id").references(() => manufacturers.id),
    engineTypeId: integer("engine_type_id").references(() => engineTypes.id),

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
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Audit
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    createdBy: integer("created_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
  },
  (table) => ({
    operatorIdx: index("aircraft_operator_idx").on(table.operatorId),
    sourceIdx: index("aircraft_source_idx").on(table.source),
    modelIdx: index("aircraft_model_idx").on(table.aircraftModelId),
  }),
);

// ─── Master Data Import Log ─────────────────────────────────────────────────

export const masterDataImportLog = sqliteTable("master_data_import_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

  importedBy: integer("imported_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["success", "partial", "failed"] }).notNull(),
  warnings: text("warnings"), // JSON array
  errors: text("errors"), // JSON array
});

// ─── Feedback Board ──────────────────────────────────────────────────────────

export const feedbackPosts = sqliteTable(
  "feedback_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", {
      enum: ["open", "under_review", "planned", "in_progress", "done", "wont_fix"],
    })
      .notNull()
      .default("open"),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    authorIdx: index("idx_feedback_posts_author").on(table.authorId),
    statusIdx: index("idx_feedback_posts_status").on(table.status),
    createdIdx: index("idx_feedback_posts_created").on(table.createdAt),
  }),
);

export const feedbackComments = sqliteTable(
  "feedback_comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => feedbackPosts.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    postIdx: index("idx_feedback_comments_post").on(table.postId),
  }),
);

export const feedbackLabels = sqliteTable("feedback_labels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const feedbackPostLabels = sqliteTable(
  "feedback_post_labels",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => feedbackPosts.id, { onDelete: "cascade" }),
    labelId: integer("label_id")
      .notNull()
      .references(() => feedbackLabels.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.labelId] }),
    postIdx: index("idx_feedback_post_labels_post").on(table.postId),
    labelIdx: index("idx_feedback_post_labels_label").on(table.labelId),
  }),
);

// ─── End Feedback Board ──────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// Relations — enables Drizzle db.query relational API
// ═══════════════════════════════════════════════════════════════════════════════

export const usersRelations = relations(users, ({ one, many }) => ({
  preferences: one(userPreferences),
  sessions: many(sessions),
  analyticsEvents: many(analyticsEvents),
  importLogs: many(importLog),
  masterDataImportLogs: many(masterDataImportLog),
  feedbackPosts: many(feedbackPosts),
  feedbackComments: many(feedbackComments),
  mhOverrides: many(mhOverrides),
  customersCreated: many(customers, { relationName: "customerCreatedBy" }),
  customersUpdated: many(customers, { relationName: "customerUpdatedBy" }),
  aircraftCreated: many(aircraft, { relationName: "aircraftCreatedBy" }),
  aircraftUpdated: many(aircraft, { relationName: "aircraftUpdatedBy" }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [customers.createdBy],
    references: [users.id],
    relationName: "customerCreatedBy",
  }),
  updatedByUser: one(users, {
    fields: [customers.updatedBy],
    references: [users.id],
    relationName: "customerUpdatedBy",
  }),
  aircraft: many(aircraft),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const importLogRelations = relations(importLog, ({ one, many }) => ({
  importedByUser: one(users, {
    fields: [importLog.importedBy],
    references: [users.id],
  }),
  workPackages: many(workPackages),
}));

export const workPackagesRelations = relations(workPackages, ({ one }) => ({
  importLogEntry: one(importLog, {
    fields: [workPackages.importLogId],
    references: [importLog.id],
  }),
  mhOverride: one(mhOverrides),
}));

export const mhOverridesRelations = relations(mhOverrides, ({ one }) => ({
  workPackage: one(workPackages, {
    fields: [mhOverrides.workPackageId],
    references: [workPackages.id],
  }),
  updatedByUser: one(users, {
    fields: [mhOverrides.updatedBy],
    references: [users.id],
  }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
  }),
}));

export const manufacturersRelations = relations(manufacturers, ({ many }) => ({
  models: many(aircraftModels),
  aircraft: many(aircraft),
}));

export const aircraftModelsRelations = relations(aircraftModels, ({ one, many }) => ({
  manufacturer: one(manufacturers, {
    fields: [aircraftModels.manufacturerId],
    references: [manufacturers.id],
  }),
  aircraft: many(aircraft),
}));

export const engineTypesRelations = relations(engineTypes, ({ many }) => ({
  aircraft: many(aircraft),
}));

export const aircraftRelations = relations(aircraft, ({ one }) => ({
  model: one(aircraftModels, {
    fields: [aircraft.aircraftModelId],
    references: [aircraftModels.id],
  }),
  operator: one(customers, {
    fields: [aircraft.operatorId],
    references: [customers.id],
  }),
  manufacturer: one(manufacturers, {
    fields: [aircraft.manufacturerId],
    references: [manufacturers.id],
  }),
  engineType: one(engineTypes, {
    fields: [aircraft.engineTypeId],
    references: [engineTypes.id],
  }),
  createdByUser: one(users, {
    fields: [aircraft.createdBy],
    references: [users.id],
    relationName: "aircraftCreatedBy",
  }),
  updatedByUser: one(users, {
    fields: [aircraft.updatedBy],
    references: [users.id],
    relationName: "aircraftUpdatedBy",
  }),
}));

export const masterDataImportLogRelations = relations(masterDataImportLog, ({ one }) => ({
  importedByUser: one(users, {
    fields: [masterDataImportLog.importedBy],
    references: [users.id],
  }),
}));

export const feedbackPostsRelations = relations(feedbackPosts, ({ one, many }) => ({
  author: one(users, {
    fields: [feedbackPosts.authorId],
    references: [users.id],
  }),
  comments: many(feedbackComments),
  postLabels: many(feedbackPostLabels),
}));

export const feedbackCommentsRelations = relations(feedbackComments, ({ one, many }) => ({
  post: one(feedbackPosts, {
    fields: [feedbackComments.postId],
    references: [feedbackPosts.id],
  }),
  parent: one(feedbackComments, {
    fields: [feedbackComments.parentId],
    references: [feedbackComments.id],
    relationName: "commentReplies",
  }),
  replies: many(feedbackComments, {
    relationName: "commentReplies",
  }),
  author: one(users, {
    fields: [feedbackComments.authorId],
    references: [users.id],
  }),
}));

export const feedbackLabelsRelations = relations(feedbackLabels, ({ many }) => ({
  postLabels: many(feedbackPostLabels),
}));

export const feedbackPostLabelsRelations = relations(feedbackPostLabels, ({ one }) => ({
  post: one(feedbackPosts, {
    fields: [feedbackPostLabels.postId],
    references: [feedbackPosts.id],
  }),
  label: one(feedbackLabels, {
    fields: [feedbackPostLabels.labelId],
    references: [feedbackLabels.id],
  }),
}));
