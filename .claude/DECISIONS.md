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
