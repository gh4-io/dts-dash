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

    -- Unified Import Log (v0.2.0)
    CREATE TABLE IF NOT EXISTS unified_import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imported_at TEXT NOT NULL,
      data_type TEXT NOT NULL,
      source TEXT NOT NULL,
      format TEXT NOT NULL,
      file_name TEXT,
      imported_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      records_total INTEGER NOT NULL,
      records_inserted INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      records_skipped INTEGER NOT NULL DEFAULT 0,
      field_mapping TEXT,
      warnings TEXT,
      errors TEXT,
      idempotency_key TEXT
    );

    -- Capacity Modeling (v0.3.0)
    CREATE TABLE IF NOT EXISTS capacity_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      paid_hours REAL NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_unified_import_log_type ON unified_import_log(data_type);
    CREATE INDEX IF NOT EXISTS idx_unified_import_log_imported_at ON unified_import_log(imported_at);
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
  `);
}

// ─── Migrations ──────────────────────────────────────────────────────────────

export interface MigrationResult {
  name: string;
  applied: boolean;
}

export function runMigrations(): MigrationResult[] {
  // All prior migrations (M001–M002b) have been rolled into createTables().
  // Fresh databases get the full schema; no incremental ALTER TABLEs needed.
  // Add future migrations here if the schema evolves after this baseline.

  const results: MigrationResult[] = [];

  // M003: Add GUID columns + restructure aircraft PK
  results.push(
    applyMigration("M003_guid_columns_aircraft_pk", () => {
      // 1. Add guid column to customers (if missing)
      const custCols = sqlite.pragma("table_info(customers)") as Array<{ name: string }>;
      if (!custCols.some((c) => c.name === "guid")) {
        sqlite.exec(`ALTER TABLE customers ADD COLUMN guid TEXT;`);
        sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_guid ON customers(guid);`);
      }

      // 2. Restructure aircraft table: registration PK → id autoincrement PK + guid
      const acCols = sqlite.pragma("table_info(aircraft)") as Array<{ name: string; pk: number }>;
      const hasId = acCols.some((c) => c.name === "id");
      const hasGuid = acCols.some((c) => c.name === "guid");
      const regIsPk = acCols.some((c) => c.name === "registration" && c.pk === 1);

      if (!hasId || regIsPk) {
        // Full table rebuild needed — PK change requires recreation in SQLite
        sqlite.exec(`
        CREATE TABLE aircraft_new (
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

        INSERT INTO aircraft_new (registration, sp_id, aircraft_type, aircraft_model_id,
          operator_id, manufacturer_id, engine_type_id, serial_number, age, lessor, category,
          operator_raw, operator_match_confidence, source, is_active, created_at, updated_at,
          created_by, updated_by)
        SELECT registration, sp_id, aircraft_type, aircraft_model_id,
          operator_id, manufacturer_id, engine_type_id, serial_number, age, lessor, category,
          operator_raw, operator_match_confidence, source, is_active, created_at, updated_at,
          created_by, updated_by
        FROM aircraft;

        DROP TABLE aircraft;
        ALTER TABLE aircraft_new RENAME TO aircraft;

        CREATE INDEX IF NOT EXISTS idx_aircraft_operator ON aircraft(operator_id);
        CREATE INDEX IF NOT EXISTS idx_aircraft_source ON aircraft(source);
        CREATE INDEX IF NOT EXISTS idx_aircraft_model ON aircraft(aircraft_model_id);
      `);
      } else if (!hasGuid) {
        // Table already has id PK but missing guid
        sqlite.exec(`ALTER TABLE aircraft ADD COLUMN guid TEXT;`);
        sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_aircraft_guid ON aircraft(guid);`);
      }
    }),
  );

  // M004: Add invite_codes table
  results.push(
    applyMigration("M004_invite_codes", () => {
      sqlite.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
      `);
    }),
  );

  // M005: Add unified_import_log table (v0.2.0 Universal Import Hub)
  results.push(
    applyMigration("M005_unified_import_log", () => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS unified_import_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          imported_at TEXT NOT NULL,
          data_type TEXT NOT NULL,
          source TEXT NOT NULL,
          format TEXT NOT NULL,
          file_name TEXT,
          imported_by INTEGER NOT NULL REFERENCES users(id),
          status TEXT NOT NULL,
          records_total INTEGER NOT NULL,
          records_inserted INTEGER NOT NULL DEFAULT 0,
          records_updated INTEGER NOT NULL DEFAULT 0,
          records_skipped INTEGER NOT NULL DEFAULT 0,
          field_mapping TEXT,
          warnings TEXT,
          errors TEXT,
          idempotency_key TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_unified_import_log_type ON unified_import_log(data_type);
        CREATE INDEX IF NOT EXISTS idx_unified_import_log_imported_at ON unified_import_log(imported_at);
      `);
    }),
  );

  // M006: Add capacity modeling tables (v0.3.0)
  results.push(
    applyMigration("M006_capacity_modeling", () => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS capacity_shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          start_hour INTEGER NOT NULL,
          end_hour INTEGER NOT NULL,
          paid_hours REAL NOT NULL,
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

        CREATE INDEX IF NOT EXISTS idx_hcp_shift ON headcount_plans(shift_id);
        CREATE INDEX IF NOT EXISTS idx_hcp_effective ON headcount_plans(effective_from, effective_to);
        CREATE INDEX IF NOT EXISTS idx_hce_shift_date ON headcount_exceptions(shift_id, exception_date);
      `);

      // Seed from existing appConfig.shifts if present
      const shiftsRow = sqlite
        .prepare("SELECT value FROM app_config WHERE key = 'shifts'")
        .get() as { value: string } | undefined;

      if (shiftsRow) {
        try {
          const shifts = JSON.parse(shiftsRow.value) as Array<{
            name: string;
            startHour: number;
            endHour: number;
            headcount: number;
          }>;
          const now = new Date().toISOString();
          const codeMap: Record<string, string> = { Day: "DAY", Swing: "SWING", Night: "NIGHT" };
          const insertShift = sqlite.prepare(
            `INSERT OR IGNORE INTO capacity_shifts (code, name, start_hour, end_hour, paid_hours, min_headcount, sort_order, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          );
          const insertPlan = sqlite.prepare(
            `INSERT INTO headcount_plans (station, shift_id, headcount, effective_from, label, created_at, updated_at)
             VALUES ('CVG', ?, ?, '2020-01-01', ?, ?, ?)`,
          );

          shifts.forEach((s, i) => {
            const code = codeMap[s.name] || s.name.toUpperCase();
            const hours =
              s.endHour > s.startHour ? s.endHour - s.startHour : 24 - s.startHour + s.endHour;
            insertShift.run(code, s.name, s.startHour, s.endHour, hours, 1, i, now, now);

            // Get the shift ID we just inserted
            const shiftRow = sqlite
              .prepare("SELECT id FROM capacity_shifts WHERE code = ?")
              .get(code) as { id: number } | undefined;
            if (shiftRow) {
              insertPlan.run(
                shiftRow.id,
                s.headcount,
                `Migrated from appConfig (${s.name})`,
                now,
                now,
              );
            }
          });

          // Seed default assumptions
          sqlite
            .prepare(
              `INSERT OR IGNORE INTO capacity_assumptions (station, paid_to_available, available_to_productive, default_mh_no_wp, night_productivity_factor, demand_curve, arrival_weight, departure_weight, allocation_mode, is_active, updated_at)
             VALUES ('CVG', 0.89, 0.73, 3.0, 0.85, 'EVEN', 0.0, 0.0, 'DISTRIBUTE', 1, ?)`,
            )
            .run(now);
        } catch {
          // If parsing fails, tables are created empty — bootstrap will seed defaults
        }
      }
    }),
  );

  // M007: Add staffing rotation matrix tables (v0.3.0)
  results.push(
    applyMigration("M007_staffing_rotation_matrix", () => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS rotation_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          pattern TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS staffing_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by INTEGER REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS staffing_shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id INTEGER NOT NULL REFERENCES staffing_configs(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          rotation_id INTEGER NOT NULL REFERENCES rotation_patterns(id),
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
      `);
    }),
  );

  // M008: Add description columns to rotation_patterns and staffing_shifts
  results.push(
    applyMigration("M008_staffing_descriptions", () => {
      // SQLite ALTER TABLE ADD COLUMN — safe if column already exists (IF NOT EXISTS not supported, so catch)
      try {
        sqlite.exec(`ALTER TABLE rotation_patterns ADD COLUMN description TEXT`);
      } catch {
        // Column already exists
      }
      try {
        sqlite.exec(`ALTER TABLE staffing_shifts ADD COLUMN description TEXT`);
      } catch {
        // Column already exists
      }
    }),
  );

  // M009: Create rotation_presets table for preset library
  results.push(
    applyMigration("M009_rotation_presets", () => {
      sqlite.exec(`
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
      `);
    }),
  );

  // M010: Create demand_allocations table for contractual minimum hours
  results.push(
    applyMigration("M010_demand_allocations", () => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS demand_allocations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          shift_id INTEGER REFERENCES capacity_shifts(id),
          day_of_week INTEGER,
          effective_from TEXT NOT NULL,
          effective_to TEXT,
          allocated_mh REAL NOT NULL,
          mode TEXT NOT NULL,
          reason TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_da_customer ON demand_allocations(customer_id);
        CREATE INDEX IF NOT EXISTS idx_da_effective ON demand_allocations(effective_from, effective_to);
        CREATE INDEX IF NOT EXISTS idx_da_shift ON demand_allocations(shift_id);
      `);
    }),
  );

  // M011: Create flight_events table for scheduled/actual arrivals and departures
  results.push(
    applyMigration("M011_flight_events", () => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS flight_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          work_package_id INTEGER,
          aircraft_reg TEXT NOT NULL,
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
          created_by INTEGER REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_fe_aircraft_reg ON flight_events(aircraft_reg);
        CREATE INDEX IF NOT EXISTS idx_fe_scheduled_arrival ON flight_events(scheduled_arrival);
        CREATE INDEX IF NOT EXISTS idx_fe_scheduled_departure ON flight_events(scheduled_departure);
        CREATE INDEX IF NOT EXISTS idx_fe_work_package_id ON flight_events(work_package_id);
      `);
    }),
  );

  // M012: Create forecast_models and forecast_rates tables for rate projection
  results.push(
    applyMigration("M012_forecast_models_rates", () => {
      sqlite.exec(`
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
      `);
    }),
  );

  // M013: Time Bookings (P2-2 Worked Hours)
  results.push(
    applyMigration("M013_time_bookings", () => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS time_bookings (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          work_package_id   INTEGER,
          aircraft_reg      TEXT NOT NULL,
          customer          TEXT NOT NULL,
          booking_date      TEXT NOT NULL,
          shift_code        TEXT NOT NULL,
          task_name         TEXT,
          task_type         TEXT NOT NULL DEFAULT 'routine',
          worked_mh         REAL NOT NULL,
          technician_count  INTEGER,
          notes             TEXT,
          source            TEXT NOT NULL DEFAULT 'manual',
          is_active         INTEGER NOT NULL DEFAULT 1,
          created_by        INTEGER REFERENCES users(id),
          created_at        TEXT NOT NULL,
          updated_at        TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tb_date ON time_bookings(booking_date);
        CREATE INDEX IF NOT EXISTS idx_tb_customer ON time_bookings(customer);
        CREATE INDEX IF NOT EXISTS idx_tb_wp ON time_bookings(work_package_id);
      `);
    }),
  );

  // M014: Billing Entries (P2-3 Billed Hours)
  results.push(
    applyMigration("M014_billing_entries", () => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS billing_entries (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          work_package_id   INTEGER,
          aircraft_reg      TEXT NOT NULL,
          customer          TEXT NOT NULL,
          billing_date      TEXT NOT NULL,
          shift_code        TEXT NOT NULL,
          description       TEXT,
          billed_mh         REAL NOT NULL,
          invoice_ref       TEXT,
          notes             TEXT,
          source            TEXT NOT NULL DEFAULT 'manual',
          is_active         INTEGER NOT NULL DEFAULT 1,
          created_by        INTEGER REFERENCES users(id),
          created_at        TEXT NOT NULL,
          updated_at        TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_be_date ON billing_entries(billing_date);
        CREATE INDEX IF NOT EXISTS idx_be_customer ON billing_entries(customer);
        CREATE INDEX IF NOT EXISTS idx_be_wp ON billing_entries(work_package_id);
      `);
    }),
  );

  // M015: Replace demand_allocations with demand_contracts + demand_allocation_lines
  results.push(
    applyMigration("M015_demand_contracts", () => {
      sqlite.exec(`
        DROP TABLE IF EXISTS demand_allocations;

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
      `);
    }),
  );

  // M016: Add timezone to capacity_shifts
  results.push(
    applyMigration("M016_shift_timezone", () => {
      sqlite.exec(`
        ALTER TABLE capacity_shifts ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
      `);
    }),
  );

  // M016b: Nullable aircraft_reg + recurrence fields for flight_events
  // SQLite cannot ALTER COLUMN — full table rebuild required.
  results.push(
    applyMigration("M016_flight_events_recurrence", () => {
      sqlite.exec(`
        CREATE TABLE flight_events_new (
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
        INSERT INTO flight_events_new
          SELECT id, work_package_id, aircraft_reg, NULL, customer,
                 scheduled_arrival, actual_arrival, scheduled_departure, actual_departure,
                 arrival_window_minutes, departure_window_minutes,
                 status, source, notes, is_active,
                 0, NULL, NULL, NULL, NULL, NULL, '[]',
                 created_by, created_at, updated_at
          FROM flight_events;
        DROP TABLE flight_events;
        ALTER TABLE flight_events_new RENAME TO flight_events;
        CREATE INDEX idx_fe_aircraft_reg ON flight_events(aircraft_reg);
        CREATE INDEX idx_fe_scheduled_arrival ON flight_events(scheduled_arrival);
        CREATE INDEX idx_fe_scheduled_departure ON flight_events(scheduled_departure);
        CREATE INDEX idx_fe_work_package_id ON flight_events(work_package_id);
        CREATE INDEX idx_fe_is_recurring ON flight_events(is_recurring);
      `);
    }),
  );

  // M017: Add aircraft_type column to flight_events
  // M016 was applied before aircraft_type was added to it.
  results.push(
    applyMigration("M017_flight_events_aircraft_type", () => {
      const cols = sqlite.pragma("table_info(flight_events)") as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "aircraft_type")) {
        sqlite.exec(`ALTER TABLE flight_events ADD COLUMN aircraft_type TEXT`);
      }
    }),
  );

  // M018: Weekly MH projections (TEMPORARY — OI-067)
  results.push(
    applyMigration("M018_weekly_mh_projections", () => {
      sqlite.exec(`
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
    }),
  );

  // M019: Add priority column to demand_contracts
  results.push(
    applyMigration("M019_demand_contracts_priority", () => {
      const cols = sqlite.pragma("table_info(demand_contracts)") as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "priority")) {
        sqlite.exec(
          `ALTER TABLE demand_contracts ADD COLUMN priority INTEGER NOT NULL DEFAULT 100`,
        );
      }
    }),
  );

  // M020: Add operating_days column to capacity_shifts + backfill SWING (Mon-Thu)
  results.push(
    applyMigration("M020_shift_operating_days", () => {
      const cols = sqlite.pragma("table_info(capacity_shifts)") as Array<{ name: string }>;
      if (!cols.some((c) => c.name === "operating_days")) {
        sqlite.exec(`ALTER TABLE capacity_shifts ADD COLUMN operating_days TEXT`);
      }
      // Backfill: SWING operates Mon-Thu only (ISO DOW 1-4)
      sqlite.exec(
        `UPDATE capacity_shifts SET operating_days = '[1,2,3,4]' WHERE code = 'SWING' AND operating_days IS NULL`,
      );
    }),
  );

  // M021: Drop operating_days column — shift run state now derived from staffing rotation
  results.push(
    applyMigration("M021_drop_operating_days", () => {
      const cols = sqlite.pragma("table_info(capacity_shifts)") as Array<{ name: string }>;
      if (cols.some((c) => c.name === "operating_days")) {
        sqlite.exec(`ALTER TABLE capacity_shifts DROP COLUMN operating_days`);
      }
    }),
  );

  return results;
}

function applyMigration(name: string, fn: () => void): MigrationResult {
  // Track applied migrations in app_config
  const key = `migration_${name}`;
  const existing = sqlite.prepare("SELECT value FROM app_config WHERE key = ?").get(key) as
    | { value: string }
    | undefined;

  if (existing) {
    return { name, applied: false };
  }

  fn();

  sqlite
    .prepare("INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)")
    .run(key, "applied", new Date().toISOString());

  return { name, applied: true };
}
