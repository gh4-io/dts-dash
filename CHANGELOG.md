# Changelog

All notable changes to DTS Dashboard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.2.0] - 2026-03-02

> **MINOR release** — all changes are backwards-compatible; all new functionality is additive.

### Added

#### Universal Import Hub
- **Single schema-driven Data Hub** replacing 3 siloed import pipelines (Customers, Aircraft Types, Data Import)
- **6-Step Import Wizard** — Select Type → Load Data → Map Fields → Validate → Confirm → Results
- **9 Pluggable Import Schemas** — work-packages, customers, aircraft, aircraft-type-mappings, aircraft-models, manufacturers, engine-types, users, app-config
- **3-Pass Auto-Mapping Engine** — exact alias → case-insensitive → fuzzy normalized; manual select dropdowns per field
- **Unified Import History** — single audit log across all data types with type filtering and pagination
- **Export & Templates** — export existing data (JSON/CSV) and download example templates per schema type
- **Contextual Help Panel** — desktop right sidebar ↔ mobile bottom sheet; step-specific guidance and field reference tables
- **Schema Registry** — `registerSchema()` API; new schemas auto-register by adding a file to `src/lib/import/schemas/`
- **Admin Nav Consolidation** — 9 items → 7 items; "Data Hub" replaces Customers + Aircraft Types + Data Import
- **Backwards-compatible redirects** — `/admin/customers` and `/admin/aircraft-types` redirect to Data Hub equivalents
- Auto-detect JSON/CSV schema type from uploaded data content
- New `unified_import_log` database table (replaces siloed per-type logs)
- 13 new UI components and 4 new API routes (`/schemas`, `/parse`, `/export`, `/template`)

#### Capacity Modeling
- **Full Capacity Suite** — 3-tier productivity model (Paid Hours × paidToAvailable × availableToProductive × nightFactor), demand distribution engine (EVEN/WEIGHTED curves), utilization heatmap, shift drilldown drawer, headcount plans + exceptions, and admin settings UI
- **Rotation-Based Staffing** — rotation pattern library (21-dot visual grid editor, presets), named staffing configurations (create/rename/duplicate/activate/compare), custom shift definitions per category (Day/Swing/Night/Other), weekly staffing matrix with full productivity chain + coverage gap warnings; staffing-driven capacity mode
- **Demand Contracts** — hierarchical `demand_contracts` + `demand_allocation_lines` model (replaces flat `demand_allocations`); period types WEEKLY, MONTHLY, ANNUAL, TOTAL, PER_EVENT; contract priority field (lowest number wins); SHORTFALL / OK / EXCESS sanity check; collapsible admin grid with inline line editing
- **7-Lens Analysis UI** — Demand, Capacity, Utilization, Events, Worked Hours, Billed Hours, Concurrency; Daily / Weekly Pattern aggregation toggle; cross-lens overlay comparison with delta KPI cards
- **Rolling 8-Week Forecast** — recency-weighted DOW forecast engine (hyperbolic decay), emerald dashed line overlay, configurable history window and confidence levels
- **Scenario Toggle** — Baseline vs. +10% Demand multiplier; utilization recomputed; lens overlays never scaled
- **Gap Analysis** — surplus / deficit / balanced / tight classification; diverging bar "Gap" view mode; gap KPI card
- **Per-Customer Attribution** — event attribution engine; KPI strip shows top 3 customers by event count when Events lens is active
- **Cross-Lens Comparison** — any second lens as overlay; delta KPI cards; comparison column in summary table
- **Monthly Roll-Up** — monthly aggregate view engine + chart toggle
- **Contract MH Pipeline** — 4-level MH resolution chain: manual override → WP `TotalMH` → contract PER_EVENT → system default (3.0); `mhSource` tag per WP in API responses; Flight Board tooltip + drawer label for contract-sourced MH
- **Staffing-Derived Shift Routing** — non-operating shifts derived from rotation aggregation map (replaces static `operatingDays` column); demand redistributes to nearest operating shift via circular distance fallback; three routing modes (Staffing / Headcount / None); `shiftRouting` debug object in overview API
- **Timezone Support** — IANA timezone field on shift definitions; engines read timezone internally
- **Flight Events** — record and attribute external maintenance events per shift/date with aircraft type and planned status + recurring schedules
- **Worked Hours** — log actual mechanic hours worked per shift
- **Billed Hours** — track billable hours per customer/shift
- **Rate Forecast** — configurable demand growth rate forecasting
- **Concurrency Pressure** — concurrent WP overlap analysis with visual KPI
- **Projection Overlay** — per-customer-per-shift MH projection with autocomplete customer inputs; weekly MH projections view
- **By Customer Toggle** — customer-breakdown view in forecast pattern chart
- **Compute Mode Badge** — shows active model: "Rotation | Config Name" or "Headcount Plan"
- **Today Reference Line** — dashed "Today" vertical line + future-date shading on daily chart
- **Warnings Bell** — badge indicator in `TopMenuBar` for active capacity warnings with dismiss support
- Rotation preset system; seed data relocated to `public/seed`
- 2 new Import Hub schemas for capacity: `rotation-patterns`, `staffing-shifts`; 3 more for `capacity-shifts`, `headcount-plans`, `headcount-exceptions`
- 4+ new database tables: `rotation_patterns`, `staffing_configs`, `staffing_shifts`, `capacity_shifts`, `capacity_assumptions`, `headcount_plans`, `headcount_exceptions`, `demand_contracts`, `demand_allocation_lines`

#### Mobile-First UX (Phase 4)
- **Collapsible Sidebar** — expanded / icon-only / hidden modes with localStorage persistence; Radix Tooltip labels in icon-only mode
- **Bottom Tab Bar** — fixed bottom navigation for mobile (< `sm` breakpoint)
- **Mobile Header Touch Targets** — all interactive header elements raised to `h-11` / `min-h-[44px]`
- **Flight Board List View** — mobile card stack with lazy pagination + TanStack sortable table for desktop; toggle persisted to localStorage
- **PWA Manifest** — `site.webmanifest` with standalone display, 5 icon sizes, theme-color meta tags
- Admin data grids — horizontal scroll on small screens; capacity pie charts — responsive `grid-cols-1 md:grid-cols-3`

#### Flight Board Enhancements
- **Sticky Time Axis Headers** — fixed date + hour headers remain visible during vertical scroll
- **Shift Column** — visual shift action lane with background shading per active shift
- **Responsive View Panel** — vertical popover on narrow screens for View/Filter controls
- **List View Integration** — Gantt / List toggle in view panel; list mode auto-selects on mobile

#### Dashboard Enhancements
- **NOW Time Indicator** — live vertical reference line on the combined daily chart

#### Print Support
- **Dashboard Print Layout** — optimized print stylesheet; chart re-renders at print dimensions
- **Flight Board Print Layout** — landscape print; ECharts canvas resizes to fit paper width; tick density and overflow corrections

#### Admin Enhancements
- **Application & Runtime Info** — new section on `/admin/server` showing app version, Node.js version, platform, memory usage, uptime, and environment
- **Database Backup Cron Job** — scheduled automatic database backups

#### Auth & Registration
- **Username field** — required on the registration form with server-side validation

#### Config & Infrastructure
- **YAML-primary config resolution** — `server.config.yml` is authoritative; env vars are fallback only
- **Unified base URL** — `baseUrl` / `BASE_URL` replaces the former `AUTH_URL` split (D-037)
- **Server-side facet extraction** — filter dropdowns (Operator, Aircraft, Type) populated from server queries rather than client-side scan
- **Migration consolidation** — M003–M021 merged into canonical `createTables()` (single authoritative schema definition)

#### Docker
- **Configurable UID/GID** — `PUID` / `PGID` build args and runtime env vars for file permission control

### Changed
- Admin navigation: 9 items → 7 items (Data Hub consolidation)
- Import history moved to unified `unified_import_log` (all data types in one view)
- Demand model: MH now **distributed** across ground-time slots, not duplicated per day
- Capacity model defaults: Day = 5.20 MH/person, Night = 4.42 MH/person (was flat 6.5)
- `paidToAvailable` reframed as headcount reduction factor in admin UI
- `/capacity` page layout redesigned — 2-column grid; summary chart; 3 pie charts replacing sunburst
- `operatingDays` field removed from `CapacityShift` — scheduling now derived from rotation data

### Removed
- `demand_allocations` API endpoint removed — use `demand_contracts` (see Migration Notes)
- Static `operating_days` column removed from `capacity_shifts` (M021)

### Fixed
- Import Hub: 6-bug fix pass post-launch + follow-up code review fix pass
- System user cannot be deleted or demoted via Admin UI (OI-061)
- Self-service profile editing now permitted; user form fields correctly pre-populated (OI-062, OI-063)
- Dashboard Aircraft & Turns card date range mismatch with global FilterBar (OI-074)
- Flight board chart colors reset to defaults on rapid customer color updates (OI-079)
- Capacity "below minimum" false warnings on non-operating shifts (OI-081)
- Flight board ECharts chart not updating on theme switch (CSS variable race + dispose/reinit cycle) (OI-083)
- Flight board sticky header layout misalignment and time axis offset with scrollbar
- Hydration mismatches: TotalAircraftCard date range, print timestamp, flight board condensed view button
- Capacity zero-capacity bug and false coverage gap positives for overnight shifts
- Contract MH delta not propagating into `wpContributions` breakdown
- M017 migration for `aircraft_type` column missing from schema init
- Docker: prod image reduced from 1.77 GB to 355 MB (80% reduction)
- Docker: `data/seed` directory missing in builder stage

### Security
- Role-based access control (admin/superadmin) enforced on all import and capacity admin endpoints
- Confirmed records (customers, aircraft) protected from overwrite by re-import
- Superadmin role blocked from bulk user creation via import (must use Admin UI)
- Idempotency key support on import commits to prevent duplicate submissions

### Migration Notes (v0.1.x → v0.2.0)
- **`demand_allocations` endpoint removed** — migrate to `demand_contracts` API. The hierarchical model is documented in `.claude/SPECS/REQ_DataImport.md`.
- **Database auto-migrates** — `instrumentation.ts` → `bootstrap.ts` applies all migrations on startup. No manual steps needed.
- **Old import URLs redirect** — `/admin/customers` and `/admin/aircraft-types` redirect to Data Hub equivalents automatically.

---

## [0.1.1] - 2026-02-23

### Fixed
- Resolved 9 session and authentication bugs (token version mismatch, session invalidation on password change, role elevation edge cases)

---

## [0.1.0] - 2025-12-15

Initial release. See `.claude/PROD_RELEASE_PLAN.md` for v0.1.0 release notes.

[Unreleased]: https://github.com/gh4-io/dts-dash/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/gh4-io/dts-dash/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/gh4-io/dts-dash/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/gh4-io/dts-dash/releases/tag/v0.1.0
