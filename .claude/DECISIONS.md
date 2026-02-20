# Decision Log

Append-only. Each entry records a confirmed choice with date, decision, rationale, and links.

---

## D-001 | 2026-02-13 | First Baseline — Tech Stack Locked

**Decision**: Lock the following tech stack for the project.

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15+ (App Router, TypeScript) |
| UI | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| Theme | next-themes (dark default) |
| Charts | Recharts (via shadcn/ui Charts) |
| Gantt | SVAR React Gantt (MIT) |
| Icons | Font Awesome (self-hosted, primary) + Lucide (supplementary) |
| Tables | TanStack Table (via shadcn/ui) |
| State | Zustand |
| Data | File-based JSON for v0 |

**Rationale**: Best-in-class OSS stack with full local-first support. All MIT/permissive licensed.
**Links**: [CLAUDE.md](/CLAUDE.md), [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)

---

## D-002 | 2026-02-13 | Station Locked to CVG

**Decision**: The Station filter field is always "CVG", displayed but not editable.
**Rationale**: All maintenance in this system occurs at CVG. Confirmed by HAR analysis — STNCOD always "CVG" in CargoJet's Tasks page.
**Links**: [REQ_Filters.md](SPECS/REQ_Filters.md), [REQ_DataSources.md](SPECS/REQ_DataSources.md)

---

## D-003 | 2026-02-13 | Default Timezone = UTC (Supersedes America/New_York)

**Decision**: Default timezone is UTC, not America/New_York.
**Rationale**: Aviation convention — schedules are typically in UTC/Zulu. Source data is UTC. Eliminates DST confusion.
**Supersedes**: Original FINAL-PLAN.md Section 3.4 which defaulted to America/New_York.
**Links**: [REQ_Filters.md](SPECS/REQ_Filters.md)

---

## D-004 | 2026-02-13 | Global FilterBar on All Data Pages

**Decision**: Flight Board, Dashboard, and Capacity pages all share a global FilterBar component. Settings page does not.
**Fields**: Start Date/Time, End Date/Time, Station (locked), Timezone, Operator, Aircraft, Type.
**Rationale**: Users need consistent filtering across views. URL params enable deep-linking and cross-page persistence.
**Links**: [REQ_Filters.md](SPECS/REQ_Filters.md), [PLAN-AMENDMENT-001](/plan/PLAN-AMENDMENT-001-FILTER-BAR.md)

---

## D-005 | 2026-02-13 | Filters Use URL Query Params

**Decision**: Filter state serialized to URL search params for deep-linking and back/forward navigation.
**Format**: `?start=ISO&end=ISO&tz=TZ&op=CSV&ac=CSV&type=CSV`
**Rationale**: Enables sharing links, bookmarking views, browser history support.
**Links**: [REQ_Filters.md](SPECS/REQ_Filters.md)

---

## D-006 | 2026-02-13 | HAR Files Analyzed — CargoJet Reference Data Captured

**Decision**: Document CargoJet's APEX flight board (page 92) and tasks page (page 45) as reference architecture.
**Key findings**: 4 filter fields (Start, End, Airport, UTC/Local), 41 aircraft rows, 99 flight tasks, fleet numbering format NNN-RRRR.
**Links**: [REQ_DataSources.md](SPECS/REQ_DataSources.md)

---

## D-007 | 2026-02-13 | Knowledge Base Restructured to .claude/ Atomic Docs

**Decision**: Replace monolithic CLAUDE_MEMORY.md with structured `.claude/` directory of atomic spec documents.
**Rationale**: Better discoverability, no duplication, easier to maintain, supports linking from CLAUDE.md.
**Structure**: See [README.md](README.md)

---

## D-008 | 2026-02-13 | Flight Board Gantt: Apache ECharts (Replaces SVAR)

**Decision**: Use Apache ECharts (`echarts` + `echarts-for-react`) for the Flight Board Gantt chart. Replaces SVAR React Gantt from the original plan.
**Evaluated**: SVAR React Gantt, Apache ECharts, D3.js + React (custom), SciChart.js, react-calendar-timeline, Planby, FullCalendar.
**Rationale**:
- ECharts has an official `custom-gantt-flight` example that closely matches our flight board use case
- Canvas-rendered with polished visuals, smooth zoom/scroll via built-in `dataZoom`
- 1.3M npm downloads/week, Apache-2.0 license, massive community
- ~19-30h dev time vs ~40-58h for D3 custom build
- Built-in dark theme, HTML tooltips, legend
- Coexists with Recharts (dashboard charts) without conflict
- SVAR had known issues: horizontal scroll freeze on Next.js 15 (GitHub #10), per-task colors needed CSS workarounds, 89 GitHub stars
- CargoJet uses Oracle JET `ojGantt` — proprietary, not usable. ECharts recreates the same visual pattern.
- SciChart.js eliminated: $1,350/dev/yr, 4-5MB bundle, SVG-only tooltips, 13K weekly downloads
**Supersedes**: FINAL-PLAN.md Appendix D (SVAR config), D-001 tech stack table (Gantt row)
**Links**: [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), [RISKS.md](DEV/RISKS.md) R11-R13

---

## D-009 | 2026-02-13 | Authentication Added — Auth.js + SQLite

**Decision**: Add authentication and role-based authorization. Stack: Auth.js (NextAuth v5), SQLite (better-sqlite3), Drizzle ORM, bcrypt.
**Rationale**: User requested admin-only customer color management and user accounts. Auth is prerequisite. SQLite is local-first consistent. Drizzle is lightweight and type-safe.
**Supersedes**: REQ_Permissions.md "no auth for v0" — that file is now superseded by [REQ_Auth.md](SPECS/REQ_Auth.md).
**Links**: [REQ_Auth.md](SPECS/REQ_Auth.md), [REQ_Account.md](SPECS/REQ_Account.md)

---

## D-010 | 2026-02-13 | Customer Colors Admin-Configurable via SQLite

**Decision**: Customer colors stored in SQLite `customers` table, managed via `/admin/customers`. Replace hardcoded `CUSTOMER_COLORS` constant with a `useCustomers()` Zustand store that fetches from API.
**Rationale**: User requires admin-configurable colors with WCAG contrast auto-calculation. Central store ensures consistency across all views.
**Supersedes**: Hardcoded `CUSTOMER_COLORS` in `lib/constants.ts` (FINAL-PLAN.md Appendix C)
**Links**: [REQ_Admin.md](SPECS/REQ_Admin.md), [REQ_DataModel.md](SPECS/REQ_DataModel.md)

---

## D-011 | 2026-02-13 | SQLite as Primary Data Store (Accelerated from "Later")

**Decision**: Use SQLite (`data/dashboard.db`) for users, sessions, customers, config, and MH overrides. Work packages remain file-based JSON (read-only import).
**Rationale**: Auth requires persistent user/session storage. Customer colors need a mutable store. SQLite is local-first, zero-config, and was already planned for later. Now needed for auth.
**Supersedes**: D-001 "File-based JSON for v0" — JSON still used for work package import, but all mutable config/state moves to SQLite.
**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md) Data Storage section

---

## D-012 | 2026-02-13 | Gantt Row Grouping: One Row Per Registration

**Decision**: Flight Board Gantt uses one row per aircraft registration (57 rows in sample data).
**Rationale**: Closest match to CargoJet's reference (41 rows by fleet number). Type/customer grouping deferred to M5 polish phase.
**Links**: [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md)

---

## D-013 | 2026-02-13 | MH Override Storage: SQLite `mh_overrides` Table

**Decision**: Manual MH overrides stored in SQLite `mh_overrides` table with `(work_package_id, override_mh, updated_by, updated_at)`. Survives re-import because it's keyed by work package ID, not by row position.
**Rationale**: Must persist across restarts and survive data re-imports. Separate table avoids mutating the imported work package data.
**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), [REQ_OtherPages.md](SPECS/REQ_OtherPages.md)

---

## D-014 | 2026-02-13 | Timezone UI: UTC + Eastern Only; Code Supports All IANA

**Decision**: UI timezone selector shows only `UTC` and `America/New_York` (displayed as "Eastern"). Internal code, APIs, and preference storage accept any valid IANA timezone string.
**Rationale**: User confirmed only two TZ options needed for operational use (aviation UTC + local Eastern). Code flexibility preserved for future expansion without UI clutter. Resolves OI-005.
**Supersedes**: REQ_Filters.md original 4-option TZ list (UTC, Eastern, Central, Pacific)
**Links**: [REQ_Filters.md](SPECS/REQ_Filters.md), [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-005

---

## D-015 | 2026-02-13 | Aircraft Type Normalization Service (Admin-Editable)

**Decision**: Aircraft types normalized via an admin-editable mapping table in SQLite (`aircraft_type_mappings`). A `normalizeAircraftType()` service resolves raw type strings to canonical types (B777/B767/B747/B757/B737) using prioritized pattern matching. Both canonical and raw type are retained.
**Rationale**: Inbound data contains non-standard type strings (e.g., `747-4R7F`, `737-200`, bare `777`). Hardcoded inference rules (OI-003/R4) are fragile. Admin-editable mapping with a test tool gives operators control. Updates OI-003.
**Canonical types**: B777, B767, B747, B757, B737, Unknown
**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), [REQ_Admin.md](SPECS/REQ_Admin.md), [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-003

---

## D-016 | 2026-02-13 | Data Import MVP: File Upload + Paste JSON; vNext: Power Automate

**Decision**: MVP data import via two mechanisms on `/admin/import`: (1) file upload (drag-drop JSON), (2) paste-JSON textarea. Both use validate → preview → confirm workflow. vNext: secure POST endpoint at `/api/ingest` for Power Automate HTTP requests with bearer token auth + rate limiting. Resolves OI-004.
**Rationale**: File-based import is simplest for v0. Paste-JSON enables quick one-off imports without file management. Power Automate endpoint deferred until auth infrastructure is battle-tested.
**Links**: [REQ_Admin.md](SPECS/REQ_Admin.md), [REQ_Logging_Audit.md](SPECS/REQ_Logging_Audit.md), [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-004

---

## D-017 | 2026-02-13 | Pagination Default 30, Configurable Per User

**Decision**: All list/table API endpoints support optional server-side pagination (`?page=N&pageSize=N`). Default 30 rows/page, max 200. Configurable per user via `tablePageSize` preference. Chart and Gantt endpoints return full datasets (no pagination). Omitting params returns all records for backward compatibility.
**Rationale**: With 86 records, pagination isn't strictly needed yet, but the pattern must be in place for when data grows. Per-user configurability (10/25/30/50/100) respects different workflows.
**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), [REQ_DataSources.md](SPECS/REQ_DataSources.md), [REQ_UI_Interactions.md](SPECS/REQ_UI_Interactions.md)

---

## D-018 | 2026-02-13 | Named Theme Presets (Classic, Ocean, Lavender, Midnight)

**Decision**: Add 4 named theme presets alongside Light/Dark/System color mode. Each preset defines a coordinated palette (accent, surface tone) applied via CSS custom properties on `<html>`. Optional accent color override per user. Default: Classic (current neutral dark).
**Rationale**: User requested richer theming. Named presets provide curated looks without requiring users to manually pick colors. Accent override gives power users fine control.
**Links**: [REQ_Account.md](SPECS/REQ_Account.md), [REQ_UI_Interactions.md](SPECS/REQ_UI_Interactions.md)

---

## D-019 | 2026-02-13 | Analytics: Two-Layer Model (Operational + Usage Tracking)

**Decision**: Analytics has two distinct layers. (1) **Operational KPIs** — 24 metrics computed on-the-fly from work package data, displayed on `/dashboard` and `/capacity` for all authenticated users. (2) **Usage tracking** — lightweight event logging to SQLite `analytics_events` table, displayed on `/admin/analytics` for admin/superadmin only. No third-party trackers, no cloud telemetry.
**Rationale**: Operational metrics are the core product — real decision-support data for line maintenance. Usage tracking is a local-first self-awareness layer so admins know if people actually use the tool. Separating the two layers keeps the architecture clean and access controls distinct.
**Key details**:
- 24 KPIs (KPI-01 through KPI-24) with formulas, cadence, dimensions
- 20 event types tracked via fire-and-forget `trackEvent()` function
- 90-day event retention with auto-prune (assumption, see OI-014)
- Capacity is never filtered by customer/aircraft/type — only demand is
**Links**: [REQ_Analytics.md](SPECS/REQ_Analytics.md), [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-014 through OI-017, [RISKS.md](DEV/RISKS.md) R17-R19

---

## D-020 | 2026-02-13 | PASS 2 Re-Plan — Milestones Consolidated M0–M8

**Decision**: Full re-plan of implementation milestones and task breakdown. Consolidated from M0–M9 (prior) into M0–M8. Aircraft types + data import merged into M7 (Admin Data Tools). Admin analytics folded into M8 (Polish). Standalone specs extracted for aircraft types (REQ_AircraftTypes.md) and data import (REQ_DataImport.md). `.claude/PLAN.md` replaces `/plan/FINAL-PLAN.md` as the authoritative build plan.
**Rationale**: Prior plan had stale line counts, unclear scope boundaries, and missing acceptance criteria. PASS 2 integrates all 19 decisions, all spec files, and all open items into a cohesive build plan with MVP vs vNext labels and explicit dependency chains.
**Supersedes**: `/plan/FINAL-PLAN.md` (retained as reference), `/plan/PLAN-AMENDMENT-001-FILTER-BAR.md` (FilterBar now integrated into PLAN.md M2)
**Links**: [PLAN.md](PLAN.md), [ROADMAP.md](ROADMAP.md)

---

## D-021 | 2026-02-13 | Comprehensive User Management + Security Scope

**Decision**: User management in the admin section should provide full-featured server-grade capabilities:
- **User CRUD**: create, edit, enable/disable, soft-delete users
- **Role management**: assign user/admin/superadmin roles; allow creation of additional super users
- **Auth control**: password reset, force password change on next login, session revocation
- **Feature control**: admin can manage auth requirements and feature access per user/role
- **Account security (user-facing)**: Change Password is **v1 (functional)**. Passkeys (WebAuthn), 2FA (TOTP), and Active Sessions are **vNext stubs** — UI cards present with "Coming Soon" badges.
- **Reactive Operator Performance**: Dashboard Operator Performance section supports click-to-focus — clicking an operator name cross-filters the dashboard to that operator. Filterable via global FilterBar.

**Rationale**: User wants "all features of a high-end server." MVP delivers the core admin controls (user lifecycle, roles, passwords). vNext layers on advanced auth (passkeys, 2FA, sessions). Operator Performance ships with M3, data-limited to what input.json provides (OI-019).
**Links**: [REQ_Account.md](SPECS/REQ_Account.md), [REQ_Admin.md](SPECS/REQ_Admin.md), [REQ_Auth.md](SPECS/REQ_Auth.md), [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-018, OI-019

---

## D-022 | 2026-02-13 | Theme System: All 11 Fumadocs Presets (Expands D-018)

**Decision**: Expand the theme system from 4 named presets (D-018) to all 11 Fumadocs theme presets: Neutral (=Classic), Ocean, Purple (=Lavender), Black (=Midnight), Vitepress, Dusk, Catppuccin, Solar, Emerald, Ruby, Aspen. Each preset supports both light and dark color modes (22 theme modes total). Optional accent color override per user.
**Rationale**: User requested "bring over ALL themes + BOTH dark/light variants" from Fumadocs. Fumadocs uses CSS custom properties compatible with shadcn/ui, making integration straightforward. The 11 presets provide rich personalization without requiring users to manually pick colors.
**Supersedes**: D-018 (4 presets) — D-018 presets mapped to Fumadocs equivalents (Classic→Neutral, Ocean→Ocean, Lavender→Purple, Midnight→Black). 7 new presets added.
**Links**: [REQ_Themes.md](SPECS/REQ_Themes.md), [REQ_Account.md](SPECS/REQ_Account.md)

---

## D-023 | 2026-02-13 | Dashboard Layout: CVG Line Maintenance Reference as Canonical

**Decision**: The `/dashboard` page layout is derived from the actual CVG Line Maintenance dashboard screenshots (160608.png, 160647.png). Layout: KPI cards (left column stacked) + combined bar+line chart (center) + donut chart (top right) + Operator Performance table (below charts). Gantt timeline on the Flight Board page, NOT duplicated on Dashboard.
**Rationale**: The reference screenshots show the user's current operational dashboard. Replicating this layout ensures familiarity. The Gantt section visible in the reference images maps to our separate `/flight-board` page — the dashboard focuses on KPIs and charts.
**Links**: [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md), [UI_REFERENCE_MAP.md](UI/UI_REFERENCE_MAP.md)

---

## D-024 | 2026-02-13 | Instant Filtering on Desktop, Apply-on-Close for Mobile

**Decision**: Desktop FilterBar applies changes immediately (no "Apply" button). Mobile FilterBar (Sheet) batches changes and applies on close. Active non-default filters displayed as dismissible pills below the FilterBar.
**Rationale**: CargoJet reference (image 1) shows a compact filter row with no Apply button, confirming instant filtering. Mobile batching prevents excessive re-renders during multi-field changes. Active filter pills give clear visibility into current filter state (inspired by CargoJet filter chips, images 8-10).
**Links**: [REQ_Filters.md](SPECS/REQ_Filters.md), [UI_FILTER_PATTERNS.md](UI/UI_FILTER_PATTERNS.md)

---

## D-025 | 2026-02-13 | Flight Board Bars: Information-Dense + Click-to-Detail

**Decision**: Flight board Gantt bars are information-dense. Wide bars show arrival time (left), registration + flight ID (center), departure time (right). Progressive disclosure: medium bars show reg+flight, narrow bars show reg only, very narrow bars rely on hover tooltip. Hovering shows a rich tooltip with full aircraft/schedule/work package info. Clicking a bar opens a detail drawer (Sheet) with all linked information and navigation links (filter by aircraft, flight ID, or customer).
**Rationale**: User direction — "bars should contain as much information as possible." The Gantt is the primary operational view; maximizing at-a-glance information reduces the need to hover/click. The click-to-detail drawer provides a drill-down path to related data without leaving the Flight Board.
**Key details**:
- Progressive disclosure: >150px (full), 100-150px (reg+flight), 50-100px (reg), <50px (tooltip only)
- Tooltip: 4 sections (Header, Schedule, Work Package, Notes) + "Click for full details" hint
- Detail drawer: Aircraft section, Schedule section, Work Package section (with WP assets link), Notes, Linked Information (filter shortcuts)
- External links to SharePoint WP assets open in new tab
**Links**: [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md)

---

## D-026 | 2026-02-15 | HTTP Ingest Endpoint Implemented (`/api/ingest`)

**Decision**: Implement the vNext secure POST endpoint at `/api/ingest` for external automation (Power Automate). Previously documented as "vNext stub" in D-016.

**Key design choices:**
- **API key storage**: `app_config` table in SQLite — admin-rotatable via Admin Settings without restart
- **Rate limiting**: In-memory Map keyed by `sha256(apiKey)` — per-key buckets, raw key never stored in limiter
- **Idempotency**: `Idempotency-Key` header → stored in `importLog.idempotencyKey` column — 24h dedup window prevents duplicate imports on Power Automate retries
- **Size limit**: Configurable via `app_config` (`ingestMaxSizeMB`), default 50MB
- **Auth comparison**: `crypto.timingSafeEqual` — prevents timing attacks
- **Import attribution**: System user (UUID `00000000-0000-0000-0000-000000000000`, email `system@internal`, inactive) satisfies `importLog.importedBy` FK constraint
- **Admin UI**: New "API Integration" section in Admin Settings — masked key display, generate/revoke, rate limit + size limit controls
- **Shared utilities**: Extracted `import-utils.ts` (validate + commit) from admin import routes — DRY between admin import and ingest endpoint

**Rationale**: Power Automate retries on failure, so idempotency is essential. Self-hosted deployment requires rate limiting and configurable size limits. Admin-rotatable key (not env var) enables key rotation without restarting the server. Per-key-hash rate limiting future-proofs for multiple keys.

**Supersedes**: D-016 vNext section ("no implementation in v1" → now implemented)
**Links**: [REQ_DataImport.md](SPECS/REQ_DataImport.md), [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-034

---

## D-027 | 2026-02-16 | Configurable Allowed Hostnames + trustHost

**Decision**: Replace hardcoded `AUTH_URL=http://localhost:3000` with `trustHost: true` in Auth.js config, and add a configurable allowed hostnames registry stored in `app_config` (SQLite). Admin UI section for add/edit/toggle/delete hostnames. Enabled hostnames feed `allowedDevOrigins` in `next.config.ts` at startup.

**Key design choices:**
- **trustHost: true**: Auth.js derives callback URLs from the request `Host` header — works for localhost and LAN IPs without configuration
- **Hostname storage**: JSON array in `app_config` key `"allowedHostnames"` (consistent with `shifts` pattern)
- **Each entry**: `{ id, hostname, port, protocol, enabled, label }`
- **next.config.ts**: Synchronous `better-sqlite3` read at dev server startup via `read-hostnames.ts` helper
- **Admin UI**: New "Allowed Hostnames" section in Admin Settings (replaced "Authentication" Coming Soon stub)
- **No middleware enforcement**: Local-first app on trusted LAN — hostname validation would add brittleness without security gain

**Rationale**: With `AUTH_URL` hardcoded, accessing the app from any non-localhost address (e.g., LAN IP) caused auth callbacks to redirect to `localhost:3000`. `trustHost: true` is the correct Auth.js setting for trusted network environments. The hostname registry provides admin visibility and drives `allowedDevOrigins` for Next.js dev-mode cross-origin support.

**Links**: [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-037

---

## D-028 | 2026-02-16 | Semantic Versioning with Backwards Compatibility Rules

**Decision**: Adopt strict Semantic Versioning 2.0.0 with explicit backwards compatibility contracts for API endpoints, database schema, environment variables, and configuration. Claude Code must detect and notify on breaking changes before implementing them.

**Key rules:**
- **PATCH** (0.1.x): bug fixes, security patches, cosmetic fixes — no behavior change
- **MINOR** (0.x.0): new features, new endpoints, new nullable/defaulted DB columns — backwards-compatible
- **MAJOR** (x.0.0): breaking changes to API, schema, env vars, auth — requires migration guide
- **Breaking Change Protocol**: Claude Code stops and notifies before implementing any backwards-incompatible change, suggests alternatives, requires explicit approval and MAJOR version bump
- **Version lives in `package.json`**, updated on release branch only, never on `dev`

**Rationale**: v0.1.0 is now deployed. Future changes must not break existing deployments without explicit version signaling and migration documentation.

**Links**: [REQ_Versioning.md](SPECS/REQ_Versioning.md), [PROD_RELEASE_PLAN.md](PROD_RELEASE_PLAN.md)

---

## D-029 | 2026-02-16 | Work Packages Move to SQLite (Supersedes D-011 partial)

**Decision**: Work package data moves from file-based `data/input.json` to a `work_packages` SQLite table. All runtime data now flows through the database. Import writes UPSERT by GUID into the DB instead of overwriting a JSON file.

**Key changes:**
- New `work_packages` table with auto-increment PK, GUID as unique key, SharePoint ID as alternate unique key
- `mh_overrides` FK now correctly references `work_packages.id` (was broken, keyed by non-existent SP ID)
- Reader queries DB instead of reading `data/input.json`
- Import UPSERTs into DB by GUID (idempotent re-import)
- New `db:import` CLI script for file/stdin import
- Health check queries `work_packages` count instead of checking file existence
- Seed data includes sample work packages for development workflow

**Supersedes**: D-011 partial ("Work packages remain file-based JSON") — now ALL data is SQLite-backed.
**Version impact**: MINOR (backwards-compatible — no API shape changes, internal storage change only)
**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), [REQ_DataImport.md](SPECS/REQ_DataImport.md)

---

## D-031 | 2026-02-17 | DB Performance: PRAGMAs, Batch UPSERTs, Indexes, Aircraft Type Resolution

**Decision**: Apply four categories of database performance improvements:

1. **SQLite PRAGMAs** (`src/lib/db/client.ts`): Added `synchronous=NORMAL`, `cache_size=-65536` (64MB), `temp_store=MEMORY`, `mmap_size=268435456` (256MB). WAL + busy_timeout were already set. These are safe for WAL mode with no durability risk.

2. **Batch UPSERTs** (`src/lib/data/import-utils.ts`): Replaced per-record UPSERT loop (3,770 individual `.run()` calls) with chunked multi-row INSERT using `BATCH_SIZE=250` and `sql\`excluded.col\`` conflict resolution. Expected 5–15× speedup on full imports.

3. **Compound indexes**: Added `idx_wp_arrival_departure`, `idx_wp_customer_arrival` on `work_packages`; `idx_ae_user_created` on `analytics_events`; `idx_sessions_expires` on `sessions`. All added to both `schema.ts` and `schema-init.ts` with M002b migration guard.

4. **Aircraft type resolution priority chain** in `transformer.ts`: (1) `aircraft` master data table (`aircraft.aircraft_type`, populated from ac.json `field_5` during aircraft import) → (2) WP `Aircraft.field_5` → (3) WP `Aircraft.AircraftType` → (4) normalizer (`aircraft_type_mappings` rules). Static import replacing dynamic `await import()`. Cache bug fixed: `invalidateTransformerCache()` now calls `invalidateMappingsCache()`.

**Rationale**: Import of 3,770 WP records was the bottleneck. Batch UPSERTs address it. PRAGMAs reduce I/O. Compound indexes accelerate date-range and customer-filtered queries (most common access patterns). Aircraft type resolution uses master data as truth source — types now show real values instead of "Unknown" when `aircraft_type_mappings` is empty.

**Version impact**: MINOR (additive only — new nullable columns, new indexes, no API shape changes)
**Links**: [REQ_DataImport.md](SPECS/REQ_DataImport.md), [REQ_AircraftTypes.md](SPECS/REQ_AircraftTypes.md), [REQ_DataModel.md](SPECS/REQ_DataModel.md)

---

## D-032 | 2026-02-17 | Raw Type Fallback: Return Raw String, Not "Unknown"

**Decision**: When `normalizeAircraftType()` finds no matching rule in `aircraft_type_mappings`, return the raw string with `confidence: "raw"` instead of returning `"Unknown"` with `confidence: "fallback"`.

**Effect**: With an empty mappings table, types show as the actual raw strings from data (e.g., `"767-200(F)"`, `"777F"`), which are filterable and countable. `"Unknown"` is now reserved exclusively for genuinely absent type data (null/empty raw value). When admin adds mapping rules, raw types are normalized to canonical names (e.g., `"B767"`, `"B777"`).

**Type change**: `ConfidenceLevel = "exact" | "pattern" | "raw" | "fallback"` — added `"raw"`.

**Rationale**: `"Unknown"` was misleading — the data had type information, it just wasn't mapped yet. Returning the raw string makes the type field useful immediately without requiring the admin to populate mapping rules. Mapping rules are now an optional refinement, not a blocker.

**Links**: [REQ_AircraftTypes.md](SPECS/REQ_AircraftTypes.md), `src/lib/utils/aircraft-type.ts`, `src/types/index.ts`

---

## D-033 | 2026-02-17 | SP ID Linking: aircraft.sp_id + customers.sp_id + aircraft_sp_id FK

**Decision**: Add `sp_id` columns to `aircraft` and `customers` tables to store SharePoint record IDs from source data. Extend `work_packages.aircraft_sp_id` to join to `aircraft.sp_id` (column existed but had no matching FK target). Add `work_packages.customer_sp_id` as a stub (no source in current WP data; WP JSON only has customer name string, not ID).

**SP ID map:**
```
work_packages.aircraft_sp_id  →  aircraft.sp_id      (populated from Aircraft.ID in wp.json)
work_packages.customer_sp_id     stub — no source in current wp.json
aircraft.sp_id                   populated from ID field in ac.json during aircraft import
customers.sp_id                  populated from ID field in cust.json during customer import
```

**Also added**: `aircraft.aircraft_type` column — raw model string from ac.json `field_5` (e.g., `"767-200(F)"`) stored directly on the aircraft master record, used as truth source in transformer type resolution.

**WP import field fix**: `Aircraft.ID` (nested) replaces top-level `AircraftId` (old field name) for `work_packages.aircraft_sp_id` population.

**Rationale**: The dead-end `aircraft_sp_id` on work packages now has a target (`aircraft.sp_id`), enabling join-based queries linking WPs to aircraft master records. Customer SP ID is a stub pending future WP data format changes.

**Version impact**: MINOR (new nullable columns — backwards-compatible; all new columns have `ALTER TABLE ADD COLUMN` migrations)
**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), [REQ_DataImport.md](SPECS/REQ_DataImport.md)

---

## D-030 | 2026-02-17 | Cron Jobs: Code Defaults + YAML Override Pattern

**Decision**: Cron job definitions use a two-tier model: built-in jobs are hardcoded in `src/lib/cron/index.ts` with sensible defaults, and `server.config.yml` acts as the override layer. The old `cron_jobs` DB table (which mixed config and runtime state) is replaced by a slim `cron_job_runs` table for runtime state only. Custom jobs can be added via YAML with a `script` path to a `.ts` module exporting `execute()`. Admin UI provides full CRUD + schedule builder + manual trigger.

**Rationale**: Consistent with the existing `server.config.yml` override pattern (see password security). Built-in jobs are always present in code, human-readable config in YAML is versionable and diffable, and runtime state is cleanly separated. DB no longer stores configuration that belongs in code/YAML.

**Version impact**: MINOR (new feature — admin cron management UI + API routes; backwards-compatible)
**Links**: [REQ_Cron.md](SPECS/REQ_Cron.md), [REQ_Admin.md](SPECS/REQ_Admin.md)

---

## D-034 | 2026-02-18 | Hide Canceled Flights System Preference

**Decision**: Add system-level preferences in `server.config.yml` to control canceled flight visibility and cleanup grace period. Canceled flights are hidden by default with no visual indication — completely excluded at the DB query level.

**Key design choices:**
- **`flights.hideCanceled`** (default: `true`): When true, `readWorkPackages()` adds `WHERE status NOT LIKE 'Cancel%'` at the DB level. All downstream consumers (flight board, dashboard, capacity) never see canceled WPs.
- **`flights.cleanupGraceHours`** (default: `6`): Top-level system setting for how long canceled WPs survive before the cleanup cron job deletes them. Feeds the cron job as its base default (cron YAML overrides still take priority).
- **Admin UI toggle**: Admin Settings > Server tab > "Flight Display" section with Switch toggle and grace period input. Writes to `server.config.yml` via PUT `/api/admin/server/flights`.
- **Not a filter**: This is a background system preference, not a FilterBar control. No UI indication when flights are hidden.
- **Cache coherency**: API route invalidates reader + transformer caches on save. Reader also tracks `cachedHideCanceled` as a safety net for config drift.
- **Visual treatment preserved**: When `hideCanceled: false`, existing stripe/opacity rendering for canceled bars activates automatically.

**Rationale**: Operators reported canceled flights cluttering the flight board after cleanup ran. The cron cleanup has a grace period, so recently-imported canceled WPs persist. Hiding at the query level is the simplest, most efficient approach. Admin toggle provides control without requiring YAML edits.

**Version impact**: MINOR (new system setting, new API route, no API shape changes — backwards-compatible)
**Links**: [OPEN_ITEMS.md](OPEN_ITEMS.md) OI-045, `src/lib/config/loader.ts`, `src/lib/data/reader.ts`, `src/app/api/admin/server/flights/route.ts`, `src/components/admin/server-tab.tsx`

---

## D-035 | 2026-02-18 | Bootstrap Layer + Self-Registration System

**Context:** The app required manual `db:seed` or CLI steps before first use. The system user (needed by `/api/ingest`) was only created during full seed. User creation was admin-only with no self-registration path.

**Decision:**
1. **Bootstrap layer** (`src/lib/db/bootstrap.ts`) auto-initializes schema, system user, and default config on every server startup (idempotent). Called from `instrumentation.ts`.
2. **First-user registration** (`/register`) — when zero real users exist, the first registration creates a superadmin (no invite code needed).
3. **Invite-code self-registration** — admin-gated: toggle `registrationEnabled` in Admin Settings, create invite codes with max uses and optional expiry. Self-registered users get `user` role.
4. **SYSTEM_AUTH_ID constant** extracted to `src/lib/constants.ts` (DRY — was duplicated in 4 files).

**Impact:** All additive — new files, new table (`invite_codes`), new endpoints, new config key. No existing behavior modified. MINOR increment per D-028.
**Links**: [REQ_Auth.md](SPECS/REQ_Auth.md), [REQ_Admin.md](SPECS/REQ_Admin.md), `src/lib/db/bootstrap.ts`, `src/lib/constants.ts`

---

## D-036 | 2026-02-18 | Active Filter Chips: Only Show User Overrides, Never System Defaults

**Context:** Active filter chips (pills below the filter bar) were displaying system-default values as if the user had explicitly set them. Examples: date range chip always appeared, timezone chip showed "Eastern" even though Eastern was the system default, zoom chip showed "3d" even though that was the default zoom level. This made the UI noisy and confusing — users saw pills they never set.

**Decision:**
1. **Never show a chip for a value that matches the system default.** Chips indicate user overrides only.
2. **Date range chip removed entirely** — dates are already visible in the Start/End picker fields. A chip is redundant.
3. **Timezone chip** compares against `getTimelineFromWindow().defaultTimezone` (from `server.config.yml`), not hardcoded `"UTC"`.
4. **Zoom chip** (flight board) compares against user's `defaultZoom` preference / system default, not hardcoded `"all"`.
5. **Clear All** resets to system defaults, not hardcoded fallback values.
6. **Rule for future chips:** Any new chip added to `TopMenuBar` or page-level `formatChips` must compare against the relevant system/user default before rendering. If the current value equals the default, no chip.

**Rationale:** Chips signal intentional user actions. Showing defaults as chips creates noise, confuses "active filtering" state, and makes "Clear All" semantics unclear. System defaults are the baseline — invisible until changed.
**Links**: OI-057 (resolved), OI-059, `src/components/shared/top-menu-bar.tsx`, `src/app/(authenticated)/flight-board/page.tsx`

---

## D-037 | 2026-02-19 | Unified Base URL: `baseUrl` / `BASE_URL` (replaces AUTH_URL)

**Context:** The app had two overlapping, confusingly-named ways to set the public base URL: `AUTH_URL` (Auth.js native env var — name suggests security/auth) and `app.baseUrl` in `server.config.yml` (bridged to `AUTH_URL` at startup). No input validation — malformed values (missing protocol, literal quotes) caused cryptic `TypeError: Invalid URL` crashes in Auth.js.

**Decision:**
1. **Single concept: `baseUrl`** — `app.baseUrl` in `server.config.yml` is the primary source; `BASE_URL` env var is the override (env beats YAML).
2. **`AUTH_URL` removed** from all user-facing configuration, documentation, env templates, and compose files. Internally, the resolved base URL is still injected into `process.env.AUTH_URL` at runtime for Auth.js (hidden implementation detail).
3. **Normalization** added in `instrumentation.ts`: strips surrounding quotes, prepends `https://` if no protocol, validates with `new URL()`, logs clear messages on failure (falls back to trustHost auto-detection).
4. **Resolution order**: `BASE_URL` env → `app.baseUrl` YAML → `trustHost` auto-detection from request Host header.

**Rationale:** `AUTH_URL` was misleading — it's not an auth setting, it's the app's public URL. `server.config.yml` is the canonical system config file; base URL belongs there alongside other infrastructure settings. The env var override (`BASE_URL`) provides Docker/deployment flexibility without touching the config file. Normalization prevents the most common deployment mistakes (Docker quote handling, omitted protocol).

**Version impact:** MINOR (renamed env var, added normalization — backwards-compatible in behavior; old `AUTH_URL` env var no longer read)
**Links**: OI-060 (resolved), `src/instrumentation.ts`, `server.config.dev.yml`, `docker/.env.example`, `DEPLOYMENT.md`
