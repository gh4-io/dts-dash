import { sqlite } from "./client";

// ─── Table Creation ──────────────────────────────────────────────────────────

export function createTables() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_id TEXT NOT NULL UNIQUE,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_token TEXT UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      sp_id INTEGER UNIQUE,
      guid TEXT UNIQUE,
      source TEXT NOT NULL DEFAULT 'inferred',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_at TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      source TEXT NOT NULL,
      file_name TEXT,
      imported_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      errors TEXT,
      idempotency_key TEXT,
      data_type TEXT NOT NULL DEFAULT 'work-packages',
      format TEXT NOT NULL DEFAULT 'json',
      records_inserted INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_skipped INTEGER NOT NULL DEFAULT 0,
      field_mapping TEXT,
      warnings TEXT
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
      customer_sp_id INTEGER,
      sp_modified TEXT,
      sp_created TEXT,
      sp_version TEXT,
      import_log_id INTEGER REFERENCES import_log(id),
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mh_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_package_id INTEGER NOT NULL UNIQUE REFERENCES work_packages(id),
      override_mh REAL NOT NULL,
      updated_by INTEGER NOT NULL REFERENCES users(id),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS aircraft_type_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      canonical_type TEXT NOT NULL,
      description TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS aircraft_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_code TEXT NOT NULL UNIQUE,
      canonical_type TEXT NOT NULL,
      manufacturer_id INTEGER REFERENCES manufacturers(id),
      display_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS engine_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      manufacturer TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS aircraft (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration TEXT NOT NULL UNIQUE,
      sp_id INTEGER UNIQUE,
      guid TEXT UNIQUE,
      aircraft_type TEXT,
      aircraft_model_id INTEGER REFERENCES aircraft_models(id),
      operator_id INTEGER REFERENCES customers(id),
      manufacturer_id INTEGER REFERENCES manufacturers(id),
      engine_type_id INTEGER REFERENCES engine_types(id),
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
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS master_data_import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_at TEXT NOT NULL,
      data_type TEXT NOT NULL,
      source TEXT NOT NULL,
      format TEXT NOT NULL,
      file_name TEXT,
      records_total INTEGER NOT NULL,
      records_added INTEGER NOT NULL,
      records_updated INTEGER NOT NULL,
      records_skipped INTEGER NOT NULL,
      imported_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      warnings TEXT,
      errors TEXT
    );

    CREATE TABLE IF NOT EXISTS cron_job_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_key TEXT NOT NULL UNIQUE,
      last_run_at TEXT,
      last_run_status TEXT,
      last_run_message TEXT,
      run_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Feedback Board
    CREATE TABLE IF NOT EXISTS feedback_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES feedback_comments(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback_post_labels (
      post_id INTEGER NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES feedback_labels(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, label_id)
    );

    -- Invite Codes
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      max_uses INTEGER NOT NULL DEFAULT 1,
      current_uses INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Capacity Modeling (v0.3.0)
    CREATE TABLE IF NOT EXISTS capacity_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      paid_hours REAL NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      min_headcount INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capacity_assumptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL DEFAULT 'CVG',
      paid_to_available REAL NOT NULL DEFAULT 0.89,
      available_to_productive REAL NOT NULL DEFAULT 0.73,
      default_mh_no_wp REAL NOT NULL DEFAULT 3.0,
      night_productivity_factor REAL NOT NULL DEFAULT 0.85,
      demand_curve TEXT NOT NULL DEFAULT 'EVEN',
      arrival_weight REAL NOT NULL DEFAULT 0.0,
      departure_weight REAL NOT NULL DEFAULT 0.0,
      allocation_mode TEXT NOT NULL DEFAULT 'DISTRIBUTE',
      is_active INTEGER NOT NULL DEFAULT 1,
      effective_from TEXT,
      effective_to TEXT,
      updated_at TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS headcount_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL DEFAULT 'CVG',
      shift_id INTEGER NOT NULL REFERENCES capacity_shifts(id),
      headcount INTEGER NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      day_of_week INTEGER,
      label TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS headcount_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station TEXT NOT NULL DEFAULT 'CVG',
      shift_id INTEGER NOT NULL REFERENCES capacity_shifts(id),
      exception_date TEXT NOT NULL,
      headcount_delta INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      UNIQUE(shift_id, exception_date)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_hcp_shift ON headcount_plans(shift_id);
    CREATE INDEX IF NOT EXISTS idx_hcp_effective ON headcount_plans(effective_from, effective_to);
    CREATE INDEX IF NOT EXISTS idx_hce_shift_date ON headcount_exceptions(shift_id, exception_date);
    CREATE INDEX IF NOT EXISTS idx_import_log_data_type ON import_log(data_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_ae_user_created ON analytics_events(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_import_log_imported_at ON import_log(imported_at);
    CREATE INDEX IF NOT EXISTS idx_wp_arrival ON work_packages(arrival);
    CREATE INDEX IF NOT EXISTS idx_wp_departure ON work_packages(departure);
    CREATE INDEX IF NOT EXISTS idx_wp_customer ON work_packages(customer);
    CREATE INDEX IF NOT EXISTS idx_wp_aircraft_reg ON work_packages(aircraft_reg);
    CREATE INDEX IF NOT EXISTS idx_wp_import_log ON work_packages(import_log_id);
    CREATE INDEX IF NOT EXISTS idx_wp_status ON work_packages(status);
    CREATE INDEX IF NOT EXISTS idx_wp_arrival_departure ON work_packages(arrival, departure);
    CREATE INDEX IF NOT EXISTS idx_wp_customer_arrival ON work_packages(customer, arrival);
    CREATE INDEX IF NOT EXISTS idx_aircraft_operator ON aircraft(operator_id);
    CREATE INDEX IF NOT EXISTS idx_aircraft_source ON aircraft(source);
    CREATE INDEX IF NOT EXISTS idx_aircraft_model ON aircraft(aircraft_model_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_posts_author ON feedback_posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_posts_status ON feedback_posts(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_posts_created ON feedback_posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_comments_post ON feedback_comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_post_labels_post ON feedback_post_labels(post_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_post_labels_label ON feedback_post_labels(label_id);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

    -- Staffing: Rotation Patterns
    CREATE TABLE IF NOT EXISTS rotation_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      pattern TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Staffing: Rotation Presets (reference library)
    CREATE TABLE IF NOT EXISTS rotation_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      pattern TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Staffing: Configurations
    CREATE TABLE IF NOT EXISTS staffing_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id)
    );

    -- Staffing: Shift Definitions
    CREATE TABLE IF NOT EXISTS staffing_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER NOT NULL REFERENCES staffing_configs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      rotation_id INTEGER REFERENCES rotation_patterns(id),
      rotation_start_date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      start_minute INTEGER NOT NULL DEFAULT 0,
      end_hour INTEGER NOT NULL,
      end_minute INTEGER NOT NULL DEFAULT 0,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      lunch_minutes INTEGER NOT NULL DEFAULT 0,
      mh_override REAL,
      headcount INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ss_config ON staffing_shifts(config_id);
    CREATE INDEX IF NOT EXISTS idx_ss_config_category ON staffing_shifts(config_id, category);
    CREATE INDEX IF NOT EXISTS idx_ss_rotation ON staffing_shifts(rotation_id);

    -- Demand Contracts (hierarchical)
    CREATE TABLE IF NOT EXISTS demand_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      contracted_mh REAL,
      period_type TEXT,
      reason TEXT,
      priority INTEGER NOT NULL DEFAULT 100,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dc_customer ON demand_contracts(customer_id);
    CREATE INDEX IF NOT EXISTS idx_dc_effective ON demand_contracts(effective_from, effective_to);

    CREATE TABLE IF NOT EXISTS demand_allocation_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL REFERENCES demand_contracts(id) ON DELETE CASCADE,
      shift_id INTEGER REFERENCES capacity_shifts(id),
      day_of_week INTEGER,
      allocated_mh REAL NOT NULL,
      label TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_dal_contract ON demand_allocation_lines(contract_id);

    -- Flight Events (final form: nullable aircraft_reg, recurrence fields)
    CREATE TABLE IF NOT EXISTS flight_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_package_id INTEGER,
      aircraft_reg TEXT,
      aircraft_type TEXT,
      customer TEXT NOT NULL,
      scheduled_arrival TEXT,
      actual_arrival TEXT,
      scheduled_departure TEXT,
      actual_departure TEXT,
      arrival_window_minutes INTEGER NOT NULL DEFAULT 30,
      departure_window_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      day_pattern TEXT,
      recurrence_start TEXT,
      recurrence_end TEXT,
      arrival_time_utc TEXT,
      departure_time_utc TEXT,
      suppressed_dates TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_fe_aircraft_reg ON flight_events(aircraft_reg);
    CREATE INDEX IF NOT EXISTS idx_fe_scheduled_arrival ON flight_events(scheduled_arrival);
    CREATE INDEX IF NOT EXISTS idx_fe_scheduled_departure ON flight_events(scheduled_departure);
    CREATE INDEX IF NOT EXISTS idx_fe_work_package_id ON flight_events(work_package_id);
    CREATE INDEX IF NOT EXISTS idx_fe_is_recurring ON flight_events(is_recurring);

    -- Forecast Models (P2-5)
    CREATE TABLE IF NOT EXISTS forecast_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      method TEXT NOT NULL,
      lookback_days INTEGER NOT NULL DEFAULT 30,
      forecast_horizon_days INTEGER NOT NULL DEFAULT 14,
      granularity TEXT NOT NULL DEFAULT 'shift',
      customer_filter TEXT,
      weight_recent REAL NOT NULL DEFAULT 0.7,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fm_active ON forecast_models(is_active);

    -- Forecast Rates (P2-5)
    CREATE TABLE IF NOT EXISTS forecast_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL REFERENCES forecast_models(id) ON DELETE CASCADE,
      forecast_date TEXT NOT NULL,
      shift_code TEXT,
      customer TEXT,
      forecasted_mh REAL NOT NULL,
      confidence REAL,
      is_manual_override INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fr_model ON forecast_rates(model_id);
    CREATE INDEX IF NOT EXISTS idx_fr_date ON forecast_rates(forecast_date);
    CREATE INDEX IF NOT EXISTS idx_fr_model_date ON forecast_rates(model_id, forecast_date);

    -- Time Bookings (P2-2: Worked Hours)
    CREATE TABLE IF NOT EXISTS time_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_package_id INTEGER,
      aircraft_reg TEXT NOT NULL,
      customer TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      shift_code TEXT NOT NULL,
      task_name TEXT,
      task_type TEXT NOT NULL DEFAULT 'routine',
      worked_mh REAL NOT NULL,
      technician_count INTEGER,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tb_date ON time_bookings(booking_date);
    CREATE INDEX IF NOT EXISTS idx_tb_customer ON time_bookings(customer);
    CREATE INDEX IF NOT EXISTS idx_tb_wp ON time_bookings(work_package_id);

    -- Billing Entries (P2-3: Billed Hours)
    CREATE TABLE IF NOT EXISTS billing_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_package_id INTEGER,
      aircraft_reg TEXT NOT NULL,
      customer TEXT NOT NULL,
      billing_date TEXT NOT NULL,
      shift_code TEXT NOT NULL,
      description TEXT,
      billed_mh REAL NOT NULL,
      invoice_ref TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_be_date ON billing_entries(billing_date);
    CREATE INDEX IF NOT EXISTS idx_be_customer ON billing_entries(customer);
    CREATE INDEX IF NOT EXISTS idx_be_wp ON billing_entries(work_package_id);

    -- Weekly MH Projections (TEMPORARY — OI-067)
    CREATE TABLE IF NOT EXISTS weekly_mh_projections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      shift_code TEXT NOT NULL,
      projected_mh REAL NOT NULL,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_wmp_customer_day_shift
      ON weekly_mh_projections(customer, day_of_week, shift_code);
  `);
}

// ─── Migrations ──────────────────────────────────────────────────────────────

export interface MigrationResult {
  name: string;
  applied: boolean;
}

export function runMigrations(): MigrationResult[] {
  // v0.2.0: All migrations (M003–M021) consolidated into createTables().
  // Fresh databases get the complete schema; no incremental migrations needed.
  // Future schema changes after v0.2.0 should add new migrations here.
  return [];
}
