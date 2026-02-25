# Changelog

All notable changes to DTS Dashboard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Demand Contracts Redesign (from `feat/demand-contracts`)
- **Hierarchical demand contracts model** — parent `demand_contracts` + child `demand_allocation_lines` replaces flat `demand_allocations`
- **Period types** — WEEKLY, MONTHLY, ANNUAL, TOTAL, PER_EVENT (D-048)
- **Sanity check projection** — SHORTFALL / OK / EXCESS
- **Collapsible admin grid** — contracts with inline line editing
- **Migration M015** — DROP old table, CREATE new tables with CASCADE FKs
- **Breaking:** `demand_allocations` API endpoint removed (use `demand_contracts`)

### Added - Capacity Enhancements (E-01 through E-06 + G-01, from `feat/capacity-layout`)

#### Rolling 8-Week Forecast (E-01)
- Recency-weighted DOW forecast engine with hyperbolic decay, emerald dashed line on daily chart
- Configurable history window, confidence levels (high/medium/low), "8W Forecast" toggle

#### Scenario Toggle (E-02)
- Demand multiplier engine (Baseline 1.0x, +10% Demand 1.1x), utilization recomputed
- Lens overlay values never scaled by scenarios

#### Gap Analysis (E-03)
- Surplus/deficit classification engine, diverging bar "Gap" view mode, gap KPI card

#### UI Integration (E-04)
- Scenario selector, KPI strip wiring, effective data routing to charts
- Forecast uses original demand; drilldown drawer uses original demand

#### Compute Mode Badge (E-05, G-05)
- Shows active capacity model: "Rotation | Config Name" or "Headcount Plan"

#### Today Line + Future Shading (E-06, G-06)
- Dashed "Today" reference line, subtle future-date shading on daily chart

#### Aggregation Toggle (G-01)
- Daily / Weekly Pattern toggle, decoupled from lens selection
- Any of 7 lenses works with either aggregation mode

#### Per-Customer Event Attribution (G-10)
- Event attribution engine: `aggregateCoverageByCustomer`, `summarizeEventsByCustomer`, `buildCustomerCoverageMap`
- KPI strip shows top 3 customers by event count + "+N more" badge when Events lens active
- New types: `CustomerCoverageAggregate`, `CustomerEventSummary`
- No schema migration needed (customer field already existed)

### Fixed
- Capacity showing 0 on days without work packages (forecast-pattern-engine)
- E-01–E-04 review issues (I-01, I-06, R-01, R-05)

### Notes
- 11 new files, 9 modified. 53 new tests (574 total). Zero API changes for E-01–E-06 + G-01 + G-10.
- All engines are pure functions (zero DB imports)
- Version bump TBD at merge/release time

---

## [0.2.0] - 2026-02-21

### Added - Rotation-Based Staffing Matrix (v0.3.0)

#### Major Features
- **Rotation-Based Staffing System** — Advanced scheduling with 3-week (21-day) rotation cycles
  - **Rotation Pattern Library** — Create/edit reusable on/off cycle patterns with visual grid editor
  - **Staffing Configurations** — Named configuration sets for experimentation (duplicate, activate, compare)
  - **Custom Shift Definitions** — Combine rotation patterns with shift times, category (Day/Swing/Night/Other), breaks, headcount
  - **Weekly Staffing Matrix** — Auto-computed headcount/MH heatmap with productivity chain calculations
  - **Three-Panel Admin UI** — Rotation patterns (left), shift card-bars by category (center), weekly visualization + stats (right)

#### New API Routes
- `GET/POST /api/admin/capacity/rotation-patterns` — List/create rotation patterns
- `PUT/DELETE /api/admin/capacity/rotation-patterns/[id]` — Update/delete pattern (delete blocked if in use)
- `POST /api/admin/capacity/rotation-patterns/bulk` — Bulk activate/deactivate/delete
- `GET/POST /api/admin/capacity/staffing-configs` — List/create staffing configs (with shift count + headcount)
- `GET/PUT/DELETE /api/admin/capacity/staffing-configs/[id]` — Config CRUD (delete blocked if active)
- `POST /api/admin/capacity/staffing-configs/[id]/activate` — Set active config (deactivates others)
- `POST /api/admin/capacity/staffing-configs/[id]/duplicate` — Deep copy config + all shifts
- `GET/POST /api/admin/capacity/staffing-shifts` — List/create shifts within a config
- `PUT/DELETE /api/admin/capacity/staffing-shifts/[id]` — Update/delete shift
- `POST /api/admin/capacity/staffing-shifts/bulk` — Bulk shift operations
- `GET /api/admin/capacity/staffing-matrix` — Computed weekly matrix (headcount + paid/available/productive MH)

#### Database
- **Migration M007** — 3 new tables: `rotation_patterns`, `staffing_configs`, `staffing_shifts`
- **Bootstrap** — Seeds 5 default rotation patterns + 1 default config on first run
- **Indexes** — config_id, config_id+category, rotation_id for query performance

#### UI Components (7 new)
- `RotationDots` — 21-dot visual grid (3×7) for rotation pattern display
- `RotationPatternEditor` — Interactive grid editor dialog with presets
- `RotationPatternList` — Left panel with bulk select, active toggle, inline actions
- `StaffingConfigSelector` — Config dropdown with create/rename/duplicate/activate/delete
- `ShiftDefinitionsGrid` — Center panel with category-grouped card-bars, inline headcount editing
- `WeeklyMatrixPanel` — Right panel heatmap grid, MH summary cards, key stats, coverage gap warnings

#### Import Schemas (2 new)
- `rotation-patterns` — Import/export rotation patterns via Data Hub
- `staffing-shifts` — Import/export shift definitions via Data Hub

#### Staffing Engine (pure functions, unit tested)
- `isWorkingDay()` — Resolve rotation pattern for any date
- `computeEffectivePaidHours()` — MH override or computed from shift duration
- `resolveStaffingDay()` — Per-day headcount by category from rotation engine
- `computeWeeklyMatrix()` — 7-day matrix with full productivity chain
- `resolveStaffingForCapacity()` — Output format compatible with existing capacity engine
- 36 unit tests covering edge cases (pattern wrapping, negative offsets, overnight shifts)

### Added - Universal Import Hub (v0.2.0)

#### Major Features
- **Universal Import Hub** — Single schema-driven interface replacing 3 siloed import pipelines
  - **Pluggable Schema System** — 9 importable data types (work packages, customers, aircraft, aircraft-type-mappings, aircraft-models, manufacturers, engine-types, users, app-config)
  - **6-Step Import Wizard** — Select Type → Load Data → Map Fields → Validate → Confirm → Results
  - **Visual Field Mapping** — Auto-mapping with 3-pass strategy (exact alias → case-insensitive → fuzzy normalized), manual select dropdowns per field
  - **Unified Import History** — Single audit log across all data types with type filtering, pagination, user attribution
  - **Export & Templates** — Export existing data with universal filters, download example templates (JSON/CSV)
  - **Contextual Help Panel** — Right-side toggleable docs, field reference tables, step-specific guidance (responsive: desktop sidebar ↔ mobile bottom sheet)

#### New API Routes
- `GET /api/admin/import/schemas` — List all registered schemas with metadata
- `POST /api/admin/import/parse` — Parse content + auto-map source fields to schema fields
- `POST /api/admin/import/export` — Export data for a schema with optional filters
- `GET /api/admin/import/template` — Download example template file (JSON/CSV)
- **Refactored** `POST /api/admin/import/validate` — Schema-driven validation (backwards-compatible)
- **Refactored** `POST /api/admin/import/commit` — Schema-driven commit (backwards-compatible)
- **Refactored** `GET /api/admin/import/history` — Queries unified log, supports type filtering
- **Refactored** `POST /api/admin/import/reset` — Accepts schemaId, multi-table reset capability

#### Database
- **New Table:** `unified_import_log` (16 columns: id, importedAt, dataType, source, format, fileName, importedBy, status, recordsTotal/Inserted/Updated/Skipped, fieldMapping, warnings, errors, idempotencyKey)
- **New Relations:** `unifiedImportLog` → `users` (importedBy FK)

#### UI Components (13 new)
- `ImportHub` — Main state machine orchestrator (6-step wizard + toolbar + history)
- `ImportStepper` — Visual step indicator (responsive circles + labels)
- `ImportToolbar` — Import/Export/Template action buttons with dropdown menus
- `StepSelectType` — Schema card grid grouped by category
- `StepLoadData` — Drag & drop + paste textarea for raw data
- `StepFieldMapping` — Target × source select dropdowns, auto-map button, preview
- `StepValidation` — Errors, warnings, summary badges, data preview
- `StepConfirmImport` — Final review before commit
- `StepResults` — Success/failure stats (inserted/updated/skipped)
- `ImportHistory` — Unified history table with type filter + pagination
- `DataPreviewTable` — Auto-column detection, cell truncation, empty state
- `HelpPanel` — Contextual docs (desktop right panel ↔ mobile bottom sheet)
- `ExportDialog` — Format selection modal for exports

#### Backend Infrastructure
- **Schema Registry** — `registerSchema()`, `getSchema()`, `getAllSchemas()`, `toSerializable()`
- **Auto-Mapping Engine** — 3-pass field mapping (exact alias → case-insensitive → fuzzy normalized)
- **Unified Parser** — Auto-detects JSON/CSV, delegates to existing parsers, size validation
- **Validation Pipeline** — Per-field validation, schema post-validation hooks, preview row generation
- **Export System** — Universal data export with filter DSL, template generation from field types
- **9 Import Schemas** (all with full lifecycle hooks: preProcess, postMapValidate, commit, postCommit, summarize):
  - `work-packages` — 25 fields, OData preProcess, version-based change detection, cache invalidation
  - `customers` — 17 fields, COLOR_PALETTE auto-assign, cascading dedup (GUID→name)
  - `aircraft` — 14 fields, fuzzy operator matching, cascading dedup (GUID→reg+serial→reg)
  - `aircraft-type-mappings` — Pattern-based normalization rules
  - `aircraft-models` — Model codes with manufacturer FK resolution
  - `manufacturers` — Reference data with sort order
  - `engine-types` — Reference data with manufacturer
  - `users` — Bulk user creation with temp passwords, superadmin protection
  - `app-config` — Key-value configuration backup/restore

#### Navigation & Pages
- **Admin Nav Consolidation** — 9 items → 7 items; "Data Hub" replaces Customers + Aircraft Types + Data Import
- **Redirect Pages** — `/admin/customers` → `/admin/import?type=customers`, `/admin/aircraft-types` → `/admin/import?type=aircraft-type-mappings`
- **Data Hub Page** — `/admin/import` wired to `ImportHub` component

#### Developer Experience
- **Backwards Compatibility** — Old API endpoints still work (legacy route redirects, schemaId fallback to work-packages)
- **Type Safety** — Full TypeScript interfaces for all import types (FieldDef, ImportSchema, CommitResult, ValidationPreview, etc.)
- **Extensibility** — New schemas can be added by creating a file in `src/lib/import/schemas/`, auto-registers at module load
- **Logging** — Structured pino logging, child loggers per endpoint, full audit trail in unified_import_log

### Added - Capacity Modeling MVP (v0.3.0)

#### Major Features
- **3-Tier Capacity Model** — Replaces flat 6.5 MH/person with configurable chain: Paid Hours x paidToAvailable x availableToProductive x nightFactor = Productive MH/person
- **Demand Distribution Engine** — Distributes WP man-hours across ground-time shift slots (replaces old per-day duplication model). Configurable demand curves (EVEN/WEIGHTED) with arrival/departure weights.
- **Capacity Heatmap** — Date x Shift grid with color-coded utilization cells, click-to-drilldown
- **Shift Drilldown Drawer** — Explainable capacity chain breakdown and WP attribution per cell
- **Effective-Dated Headcount Plans** — Per-shift headcount with date ranges and weekday overrides
- **Headcount Exceptions** — Date-specific delta overrides for holidays, overtime, etc.
- **Admin Capacity Settings** — Headcount plan editor + model assumptions editor with live preview sliders

#### New Database Tables
- `capacity_shifts` — Shift window definitions (code, hours, paid time, min headcount)
- `capacity_assumptions` — Productivity factors, demand curve config (single active row)
- `headcount_plans` — Effective-dated headcount targets per shift
- `headcount_exceptions` — Date-specific headcount delta overrides

#### New API Routes
- `GET /api/capacity/overview` — Full capacity+demand+utilization with drilldown data
- `GET /api/admin/capacity/shifts` — List active shifts
- `GET/PUT /api/admin/capacity/assumptions` — Read/update productivity factors
- `GET/POST /api/admin/capacity/headcount-plans` — List/create headcount plans
- `PUT/DELETE /api/admin/capacity/headcount-plans/[id]` — Update/delete plans
- `GET/POST /api/admin/capacity/headcount-exceptions` — List/create exceptions
- `PUT/DELETE /api/admin/capacity/headcount-exceptions/[id]` — Update/delete exceptions

#### New UI Components
- `CapacityHeatmap` — Date x Shift utilization grid with color coding and tooltips
- `CapacityKpiStrip` — KPI cards (avg/peak utilization, demand, capacity, critical days)
- `CapacitySummaryChart` — Recharts bar/line chart with stacked/total view toggle
- `ShiftDrilldownDrawer` — Sheet drawer with capacity chain and demand breakdown
- `HeadcountGrid` — Admin editor for headcount plans and exceptions
- `AssumptionsForm` — Admin editor with sliders and live preview

#### Import Hub Integration
- 3 new import schemas: `capacity-shifts`, `headcount-plans`, `headcount-exceptions`
- All schemas support JSON/CSV, export, templates

#### Behavioral Changes
- **Demand model**: MH is now DISTRIBUTED across ground-time slots (not duplicated per day). A 3-day WP with 3 MH shows 1 MH/slot = 3 MH total (was 3 MH/day = 9 MH total).
- **Capacity model**: Day shift = 5.20 MH/person (was 6.5), Night = 4.42 MH/person. All factors admin-configurable.

### Changed
- Admin navigation restructured for Data Hub UX
- Import history moved to unified table (all data types in one view)
- Admin nav: added "Capacity" link after "Cron Jobs"
- Config panel: added info banner linking to admin capacity settings

### Fixed
- N/A (new feature)

### Security
- Role-based access control (admin/superadmin only) on all import endpoints
- Source protection for "confirmed" records (customers, aircraft)
- Superadmin role blocked from bulk user imports
- Idempotency key support for re-submit safety

### Notes
- **MINOR version bump** (v0.1.0 → v0.2.0) — all changes are backwards-compatible; new functionality is additive
- Old customer/aircraft-type editor components remain in codebase but are no longer linked from nav (can be deprecated in v0.3.0)
- Migration path: existing users' old import URLs continue to work via legacy fallback logic

---

## [0.1.0] - 2025-12-15

Initial release. See `.claude/PROD_RELEASE_PLAN.md` for v0.1.0 release notes.

[Unreleased]: https://github.com/gh4-io/dts-dash/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/gh4-io/dts-dash/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gh4-io/dts-dash/releases/tag/v0.1.0
