import { sqlite } from "./client";

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
      country TEXT,
      established TEXT,
      group_parent TEXT,
      base_airport TEXT,
      website TEXT,
      moc_phone TEXT,
      iata_code TEXT,
      icao_code TEXT,
      source TEXT NOT NULL DEFAULT 'inferred',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      updated_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      color_mode TEXT NOT NULL DEFAULT 'dark',
      theme_preset TEXT NOT NULL DEFAULT 'vitepress',
      accent_color TEXT,
      compact_mode INTEGER NOT NULL DEFAULT 0,
      default_timezone TEXT NOT NULL DEFAULT 'UTC',
      default_date_range TEXT,
      default_zoom TEXT,
      time_format TEXT NOT NULL DEFAULT '24h',
      table_page_size INTEGER NOT NULL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS import_log (
      id TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      source TEXT NOT NULL,
      file_name TEXT,
      imported_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      errors TEXT,
      idempotency_key TEXT
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

    -- Feedback Board
    CREATE TABLE IF NOT EXISTS feedback_posts (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_post_labels (
      post_id TEXT NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
      label_id TEXT NOT NULL REFERENCES feedback_labels(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, label_id)
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_posts_author ON feedback_posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_posts_status ON feedback_posts(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_posts_created ON feedback_posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_comments_post ON feedback_comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_post_labels_post ON feedback_post_labels(post_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_post_labels_label ON feedback_post_labels(label_id);
    -- End Feedback Board
  `);
}

// ─── Migrations ──────────────────────────────────────────────────────────────

export interface MigrationResult {
  name: string;
  applied: boolean;
}

export function runMigrations(): MigrationResult[] {
  const results: MigrationResult[] = [];

  // Migration 001: Feedback Board tables
  // For existing databases that were created before createTables() included these tables.
  const hasFeedbackPosts = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback_posts'")
    .get();

  if (!hasFeedbackPosts) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS feedback_posts (
        id TEXT PRIMARY KEY,
        author_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback_comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback_labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback_post_labels (
        post_id TEXT NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
        label_id TEXT NOT NULL REFERENCES feedback_labels(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, label_id)
      );

      CREATE INDEX IF NOT EXISTS idx_feedback_posts_author ON feedback_posts(author_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_posts_status ON feedback_posts(status);
      CREATE INDEX IF NOT EXISTS idx_feedback_posts_created ON feedback_posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_feedback_comments_post ON feedback_comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_post_labels_post ON feedback_post_labels(post_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_post_labels_label ON feedback_post_labels(label_id);
    `);
    results.push({ name: "001_feedback_board", applied: true });
  } else {
    results.push({ name: "001_feedback_board", applied: false });
  }

  return results;
}
