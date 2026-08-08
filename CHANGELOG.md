# Changelog

All notable changes to DTS Dashboard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Work landed on `feat/flight-event-enhancements` after the `[0.3.0]` version bump of 2026-03-04.
> **The `[0.3.0]` entry below is incomplete** — it predates everything in this section. Fold these
> into `[0.3.0]`, or split them into `[0.3.1]`, when the release boundary is decided.

### Changed — BREAKING

- **Deprecated `headcount` field removed from the staffing-matrix response** (OI-109) — `WeeklyMatrixCell` carried `headcount` as an alias for `effectiveHeadcount`, kept for backwards compatibility when OI-109 split roster from effective headcount, and marked for removal on the next MAJOR. This is that MAJOR. Consumers of `/api/admin/capacity/staffing-matrix` read `rosterHeadcount` for people-counts and `effectiveHeadcount` for the MH basis
- **`work_packages.title` remapped to `workpackage_no`** (OI-086) — inbound SharePoint `Title` carries the work package *number* (`AALA/L-201125-2`, `782CK-DAILY-TS-11-20-2025`), not a display label, but since v0.1.1 it was written to a column called `title` while `workpackage_no` was fed from an inbound `WorkpackageNo` no export ever sends — leaving the identifier under the wrong name and `workpackage_no` NULL on all 10,080 production rows. The two are now one column. **The `title` column and the `WorkPackage.title` / `SerializedWorkPackage.title` fields are gone**; consumers read `workpackageNo`. Import maps `WorkpackageNo ?? Title`, so the explicit field still wins if a source ever supplies it, and `Title` is now an alias on the `workpackageNo` import field. Existing databases are carried over by `npm run db:upgrade-v1` (Step 3): the value is copied into any empty `workpackage_no`, then `title` is dropped. Copy-then-drop rather than `RENAME COLUMN` because both columns have coexisted since v0.1.1 and SQLite cannot rename onto an occupied name. Allowed only because v1.0.0 is a MAJOR (D-028)

### Added

- **Click-to-hide chart legend** (OI-121, D-065) — the capacity charts' legend is now interactive and has two rows: shifts (or customers) above, series roles below. Clicking **Days** hides the Day bar, its capacity line and its utilization line together; clicking **Capacity** hides that role across every shift. Applies to the daily, weekly-pattern and monthly charts. Previously the legend was inert and, worse, labelled five entries for nine drawn series. The dashboard's **Arrivals / Departures / On Ground** chart toggles the same way; hiding a series there also removes it from the printed chart
- **Filter exclusions are first-class** (OI-117) — `!=` / `not in` on Operator, Aircraft and Type now live in the filter state and the URL (`nop` / `nac` / `ntype`) instead of being client-side only, so they reach the server, survive a reload and carry between pages. Shown as `≠ Value` chips
- **Productivity chain explainer** (OI-116) — `/admin/capacity/assumptions` now states the formula `HC x HOURS x ATT x PROD [x NIGHT] = Productive MH`, with a worked example on live values, each stage named (Paid → Available → Productive) and the combined efficiency spelled out. The two factors multiply (0.89 x 0.65 = 57.9%), which read as a single ratio before and made the resulting MH look wrong. A one-line form sits in the staffing weekly matrix
- **Click-to-edit productivity percentages** (OI-116) — the three Productivity Factor values accept typed entry; Enter or blur commits, Escape cancels, values clamp to range. The 0.01 slider step was too coarse for precise entry
- **Overlapping shift version detection** (OI-108) — `findShiftOverlaps()` flags two versions of one shift effective on the same date, which the engine silently sums into a doubled roster. Surfaced as a banner and a per-row badge
- **Prod DB snapshot skill** — `.claude/skills/prod-db-snapshot/` pulls a consistent production snapshot (`sqlite3 .backup` over SSH, WAL included) and restores it into dev with verification, a pre-restore backup and an automatic migrate. Developer tooling, deliberately outside the application


- **Flight event comments + ground event markers** (OI-092, OI-093) — comments per flight event; unique markers for AOG, BTB and similar ground events
- **In-app notification system** with auto-triggers (OI-094)
- **Rotation pattern versioning** (OI-101, M026) — patterns carry an effective window plus a `group_id` giving stable identity across versions. Editing the pattern string auto-versions instead of overwriting, so past dates keep the definition that was actually in force. Shifts need no repointing; resolution follows the group
- **Shift pattern anchor** (OI-102, M025) — `staffing_shifts.pattern_anchor_date` separates the date a version takes effect from the date the 21-day pattern is indexed from. A headcount change now takes effect on the save date without rotating the pattern phase or restating earlier days

### Fixed

- **Capacity dropped a day of demand and lied about its clock** (OI-119) — the day grid was built by slicing `YYYY-MM-DD` off the UTC start/end instants while the demand, coverage and concurrency engines bucket on the timezone stored on the shift rows (D-049), which is `America/New_York` in production. The grid and the buckets therefore disagreed by five hours: demand landing on the operational day *before* the grid's first date was silently clamped away. The grid is now resolved on the same operational clock (`buildDayGrid`), and the Status/Ground Time/Arrival/Departure/Shift column rules — which resolve against real shift windows — read that clock too instead of the viewer's display preference. Alongside this the FilterBar timezone selector, which could never move these numbers, is shown **locked** on `/capacity` with a tooltip naming the operational timezone and where to change it (Admin → Capacity → Shift Timezone); the date pickers follow the same clock, so the window you type is the window that is computed
- **Every filter now works on the capacity page** (OI-117) — filters did nothing on `/capacity` for three separate reasons: the Operator/Aircraft/Type value lists were empty there (the picker sourced them from a store only the flight board and dashboard populated), `!=` / `not in` rules never left the browser, and the remaining rules (Status, Ground Time, Arrival, Departure, Man-Hours, Shift) never reached the API at all. Demand contracts, flight events, time bookings and billing entries were also loaded unfiltered, so an operator filter could not remove that customer from the allocated/worked/billed lenses, the KPI strip or the pies. Verified against production data: excluding one operator moves Total Demand 471 → 442 MH
- **Date and overnight-shift column filters matched nothing** (OI-118) — ordering comparisons ran through `parseFloat`, which reads `"2026-08-07T12:00:00Z"` as `2026`, so every Arrival/Departure rule compared 2026 against 2026. Separately, the overlapping-shift walk started at the arrival day's midnight and so missed the Night window that contains an early-morning arrival — a 02:00 arrival reported as Day-only. Both also affected the flight board
- **Capacity data raced itself on a deep link** (OI-117) — `useCapacityV2` did not wait for URL → store hydration and had no abort controller, so opening a filtered link fired two overlapping requests and the stale one could win
- **Capacity demand and capacity used different windows** (OI-117) — work packages were filtered on the raw sub-day timestamps while the capacity grid used whole days, giving partial demand against full-day capacity for any window not starting at midnight
- **Shift colours drifted between components** (D-065) — Day and Swing were two near-identical oranges, and the palette was copy-pasted into six components, so a change in one chart left the heatmap, pies, drilldown drawer and admin grids behind. There is now a single `shift-colors.ts`; Swing moved to pink, validated for colour-vision deficiency against both themes
- **Shift edits rewrote history instead of versioning** (OI-107) — the edit dialog saved via `PUT`, mutating the current version in place, so changing a shift's hours or rotation silently restated every date that version already covered. This was the OI-100 failure returning through a different door. The dialog now routes headcount, hours, rotation, breaks, MH override and category through the versioning path; name, description and dates still amend in place
- **Weekly matrix headcount was silently discounted** (OI-109) — the "HC" column rendered `roster x paidToAvailable` rounded to an integer, showing 59 for a roster of 66, while `totalConfigHeadcount` in the same panel was undiscounted. `WeeklyMatrixCell` now carries `rosterHeadcount` and `effectiveHeadcount` separately. The ambiguous `headcount` field is retained as a deprecated alias for API compatibility (D-028)
- **Paid/Available/Productive MH chain was collapsed** (OI-110) — `paidToAvailable` was applied at the *paid* stage and `availableMH` was set equal to `paidMH`, understating Paid MH by that factor and making Available MH a duplicate. The three stages are now distinct. **`productiveMH` is algebraically unchanged**, so utilization, gap analysis and every capacity chart are unaffected
- **Weekly matrix clipped values at every screen size** (OI-112) — the table sat in an `overflow-hidden` wrapper narrower than its content (277px vs 433px), cutting the Saturday and Tot columns with no way to reach them. The three-panel grid also pinned the matrix at 320px for every width from 1024px up, so a 4K display was as cramped as a laptop
- **Responsive panel priority** (OI-114) — the sidebar auto-collapses to icons below 1536px on non-touch viewports (escapable, and it does not overwrite the stored preference), the rotations panel condenses, and the shift grid has a 420px floor with the matrix stacking beneath rather than squeezing the working surface. Editing a shift is now reachable by clicking its row, not only the hover-revealed icon buttons
- **Cross-origin dev assets blocked from the Windows host** — `allowedDevOrigins` held origin URLs (`http://localhost:3000`) where Next.js expects bare hostnames, so every entry was inert and JS chunks 403'd for a browser reaching the dev server as `127.0.0.1`. The page rendered but never hydrated

### Removed

- **Legacy capacity engine and its settings** (OI-115) — the app carried two unrelated capacity models. Engine A (`headcount x realCapacityPerPerson`, ignoring shift length) had **no live consumers**, yet its `realCapacityPerPerson` / `theoreticalCapacityPerPerson` / `shifts` fields were still editable in Admin → Settings, so configuring them changed nothing. Deleted `engines/capacity.ts`, `/api/capacity`, `use-capacity.ts`, `utilization-chart.tsx`, `config-panel.tsx`, the three `app_config` keys and their **Capacity Model** and **Shift Configuration** sections, plus five orphaned types. Capacity is modelled solely by `capacity_assumptions` + `capacity_shifts`. The **Demand Model** section is retained — `defaultMH` and `wpMHMode` are live


- **Security: 24 dependency advisories** resolved via `npm audit fix` — 27 → 3 (all criticals and highs cleared; remaining 3 are transitive and need a major bump of their parent). Lockfile-only; `package.json` unchanged. Notable: `next-auth` 5.0.0-beta.30 → beta.32, `@auth/core` 0.41.0 → 0.41.3, `next` 16.1.6 → 16.3.0, `drizzle-orm` 0.45.1 → 0.45.2, `js-yaml` 4.1.1 → 4.3.1, `undici` 7.22.0 → 7.29.0, `sharp` 0.34.5 → 0.35.3
- **Build gate restored** — type errors in three test files had been failing `next build` and CI's `tsc --noEmit` since roughly February. Compilation succeeded and all tests passed, so the failure went unnoticed. Fixtures were missing `CapacityShift.timezone` (D-049) and `DemandContract.priority` (D-052/M019), `wpContributions` entries had a string `wpId` and were missing `aircraftReg`/`mhSource`, and `transformer-mh.test.ts` was the only test file relying on vitest globals. `npm run validate` now exits 0
- **Historical capacity is now stable** (OI-100) — the staffing engine honours shift effective dates. Archived versions apply to the dates they covered instead of vanishing, and the current version no longer applies to all of history. **Behaviour change:** dates before a shift's `rotationStartDate` report zero headcount rather than a backwards-projected roster
- Flight board: dismiss tooltip on tap; eliminate 60s re-render cycle
- Flight board: fix auto-load on server restart; improve ground event markers
- Import: infer `hasWorkpackage` from `TotalMH`/`WorkpackageNo` when the source field is absent

### Known Issues

- `versionStaffingShift()` and `versionRotationPattern()` — the archive-and-create transactions — remain untested (OI-103). No capacity test currently mocks the database, so this needs a new fixture pattern. `versionStaffingShift()` was since exercised end-to-end against the dev database, but that is manual verification, not coverage
- Production currently runs `0.2.0-rc1`, which predates OI-080 entirely. Upgrading applies M022, M025 and M026
- **Production data carries the OI-108 defect** — duplicate `13SMD` shift rows are effective simultaneously and double-count that roster. Needs correcting on upgrade
- `staffing_shifts` has no `group_id` lineage (OI-111), so overlap detection matches on shift name; renaming a shift hides an overlap
- Admin capacity pages collapse at phone width — the content region measures ~103px at 390px (OI-113)

---

## [0.3.0] - 2026-03-04

> **MINOR release** — all changes are backwards-compatible; all new functionality is additive.

### Added

#### Capacity — Staffing Shifts
- **Rotation end date** — `rotationEndDate` (nullable) on `staffing_shifts` provides a historical timeline of headcount changes (M022 migration)
- **Shift auto-versioning** — editing headcount archives the current shift and creates a new version; rotation start dates auto-align to Sunday (pattern[0] = Sunday)
- **Archive section** — collapsible archive panel in Shift Definitions grid shows expired shifts with a "Reactivate" button; no-gap safety check warns before archiving the last active shift in a category
- New engine functions: `alignRotationStartToSunday()`, `canArchiveShift()`, `archiveStaffingShift()`, `versionStaffingShift()`

#### System
- **Sub-build tracking** (D-063) — `build.json` (git-tracked) auto-increments on every commit via a pre-commit hook; build number surfaces in `/api/health`, Admin → Server page, and git tags

#### Mobile & PWA
- **Redesigned app icons** — B777-inspired artwork across all sizes (192, 512, maskable-192, maskable-512, Apple touch icon)
- **iOS install prompt** — A2HS banner for iOS users on first visit
- **Floating popup menu** — replaced bottom-sheet overflow menu with a right-aligned floating popup on mobile

### Fixed

#### Flight Board
- Disable `viewMode` (Gantt/List) persistence across page loads — view resets to Gantt on navigation
- Default sort by arrival time when no user sort is active in List view
- Fall back to `title` field for WP number display in tooltip and detail drawer when `workpackageNo` is absent
- Superscript date separators + semibold registration labels in List card header; timezone-aware date formatting
- Suppress ECharts `axisBuilder` race condition warnings in console
- Date format changed to `m/d/yyyy` in filter bar; Gantt date label alignment improved

#### Dashboard
- Average Ground Time card layout now matches Aircraft & Turns card proportions

#### Mobile & PWA
- Move `themeColor` to Next.js `Viewport` export — eliminates duplicate `<meta>` tags
- Scoped mobile CSS globals to prevent overflow into desktop layouts; removed desktop font overrides
- Mobile phone UX polish: card layout redesign, section reorder, tab bar refinements

---

## [0.2.0] - 2026-02-28

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

[Unreleased]: https://github.com/gh4-io/dts-dash/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/gh4-io/dts-dash/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/gh4-io/dts-dash/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/gh4-io/dts-dash/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/gh4-io/dts-dash/releases/tag/v0.1.0
