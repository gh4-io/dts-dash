# Roadmap

> **What changed and why (2026-02-13):** Full rebuild in PASS 2 re-plan. Consolidated from M0–M9 (prior) into M0–M8 with clearer acceptance criteria, explicit MVP vs vNext labeling, and dependency chains. Aircraft types + import merged into M7. Admin analytics folded into M8 (polish). Removed stale hour estimates — replaced with scope-based sizing (S/M/L).
> See [PLAN.md](PLAN.md) for detailed tasks per milestone.

---

## Current Focus

**Milestone 8**: Complete ✅
**Milestone 0**: Complete ✅
**Milestone 1**: Complete ✅
**Milestone 2**: Complete ✅
**Milestone 3**: Complete ✅
**Milestone 4**: Complete ✅
**Milestone 5**: Complete ✅
**Milestone 6**: Complete ✅
**Milestone 7**: Complete ✅

**All base milestones (M0–M8) complete. Project is production-ready.**

**Current Focus: Capacity Phase 2** — Advanced capacity lenses on `feat/capacity-layout` branch.

### Post-M8 Enhancements
- [x] Configurable allowed hostnames + trustHost (D-027, OI-037) — 2026-02-16
- [x] Cron job management: code defaults + YAML overrides + Admin UI (D-030) — 2026-02-17

### Capacity Phase 1 (Complete)
- [x] WS-1 through WS-5: Core capacity engine, demand distribution, shifts, assumptions — 2026-02-20
- [x] WS-6: Integration, import schemas, docs — 2026-02-20
- [x] WS-7: Rotation-based staffing system — 2026-02-21
- [x] WS-8: Staffing-driven capacity mode — 2026-02-21

### Capacity Phase 2 (Complete)
- [x] P2-6: Demand Allocations — 2026-02-21
- [x] P2-1: Flight Events — 2026-02-21
- [x] P2-5: Rate Forecast — 2026-02-21
- [x] P2-2: Worked Hours — 2026-02-21
- [x] P2-4: Concurrency — 2026-02-21
- [x] P2-3: Billed Hours — 2026-02-21
- [x] P2-7: Multi-Lens UI — 2026-02-21

### Demand Contracts Redesign (Complete ✅ — `feat/demand-contracts`)
- [x] Parent/child model (demand_contracts + demand_allocation_lines) — M015 — 2026-02-21
- [x] Sanity check projection (SHORTFALL/OK/EXCESS) — 2026-02-21
- [x] Collapsible admin grid + inline line editing — 2026-02-21
- [x] PER_EVENT period type (D-048) — 2026-02-21
- [x] Capacity documentation (concepts, API reference, admin guide, getting started, lenses, examples, FAQ) — 2026-02-21

### Capacity Enhancements E-05–E-06 (Complete ✅ — `feat/capacity-layout`)
- [x] E-05: Compute mode badge (Rotation | Config Name / Headcount Plan) — 2026-02-24
- [x] E-06: Today reference line + future-date shading on daily chart — 2026-02-24

### Gap Fixes — G-01 (Complete ✅ — `feat/capacity-layout`)
- [x] G-01: Decouple aggregation level from lens selection — 2026-02-24
  - New `AggregationToggle` component (Daily / Weekly Pattern)
  - Any lens works with either aggregation mode
  - ForecastPatternChart receives scenario-adjusted demand
  - Behavioral change: "Forecast" lens no longer auto-switches chart

### Capacity Enhancements E-01–E-06 + G-01 (Complete ✅ — `feat/capacity-layout`)
- [x] E-01: Rolling 8-week demand forecast (recency-weighted DOW pattern) — 2026-02-24
- [x] E-02: Scenario toggle (Baseline vs +10% demand multiplier) — 2026-02-24
- [x] E-03: Gap analysis engine + diverging bar gap view mode + gap KPI card — 2026-02-24
- [x] E-04: Scenario UI integration (selector + KPI strip + data routing) — 2026-02-24
- [x] E-05: Compute mode badge (Rotation | Config Name / Headcount Plan) — 2026-02-24
- [x] E-06: Today reference line + future-date shading — 2026-02-24
- [x] G-01: Decouple aggregation from lens (AggregationToggle) — 2026-02-24
- [x] Bug fix: Capacity showing 0 on days without work packages — 2026-02-24
- 9 new files, 5 modified, 36 new tests (557 total). Zero API changes.

### Gap Fix G-10: Per-Customer Event Attribution (Complete ✅ — `feat/capacity-layout`)
- [x] G-10: Event attribution engine — `aggregateCoverageByCustomer`, `summarizeEventsByCustomer`, `buildCustomerCoverageMap` — 2026-02-24
  - 3 pure functions, 2 new types (`CustomerCoverageAggregate`, `CustomerEventSummary`)
  - KPI strip shows top 3 customers by event count + "+N more" badge (Events lens)
  - No schema migration (customer field already existed on `flight_events` + `EventCoverageWindow`)
  - 2 new files, 4 modified, 17 new tests (574 total)

### Gap Fix G-07: Cross-Lens Comparison (Complete ✅ — `feat/capacity-layout`)
- [x] G-07 Session 1: CompareSelector dropdown + secondary lens overlay on CapacitySummaryChart — 2026-02-24
  - New `CompareSelector` component (dropdown + dismissible chip)
  - Secondary overlay: muted style (1.5px, "8 4" dash, 60% opacity) — distinct from primary
  - 4 eligible secondary lenses: allocated, forecast, worked, billed
  - Supports total + byShift + byCustomer modes; hidden in gap mode
  - Auto-clears secondary when primary changes to match
  - 1 new file, 2 modified. Zero API/engine/Zustand changes
- [x] G-07 Session 2: ForecastPatternChart secondary overlay, KPI comparison delta card, detail table column — 2026-02-25
  - ForecastPatternChart: `SECONDARY_LINE_STYLE` + secondary data in chartData useMemo (total + per-shift)
  - CapacityKpiStrip: `comparisonKpi` — avg daily MH delta between primary/secondary lenses
  - CapacityTable: `SECONDARY_LENS_COLUMN` config map + secondary column + CSV export
  - 4 files modified. Zero API/engine/type changes

### Gap Fix G-09: Monthly Roll-Up Aggregation (Complete ✅ — `feat/capacity-layout`)
- [x] G-09: Monthly roll-up aggregation — new engine + chart — 2026-02-25
  - New pure engine `monthly-rollup-engine.ts` — `aggregateMonthlyRollup()` buckets daily data into calendar months
  - New `MonthlyRollupChart` component with 4 view modes (Total/By Shift/By Customer/Gap)
  - `AggregationToggle` extended to 3 options (Daily / Weekly Pattern / Monthly)
  - Lens-aware overlays (allocated, forecast, worked, billed) + secondary comparison (G-07)
  - Scenario-adjusted data, utilization line, tooltip with day count
  - 3 new files, 4 modified, 16 new tests (590 total). Zero API changes.

### All Capacity Tier 3 Gaps Complete ✅

### Capacity Phase 3 — Contract MH Pipeline (Planned)
- [ ] Contract MH fallback in effectiveMH pipeline (OI-065)
- [ ] Null WP MH support in data import
- [ ] New MHSource "contract" in all views
- [ ] Flight board, dashboard, statistics show contract-resolved MH

## Milestones

| ID | Name | Scope | Status | Size | Dependencies |
|----|------|-------|--------|------|-------------|
| M0 | Scaffold + Database + Auth | Foundation | **Done** ✅ | L | None |
| M1 | Data Layer + API Routes | Data foundation | **Done** ✅ | M | M0 |
| M2 | FilterBar + Flight Board | First visual page | **Done** ✅ | L | M1 |
| M3 | Statistics Dashboard | Second visual page | **Done** ✅ | M | M1 |
| M4 | Capacity Modeling | Third visual page | **Done** ✅ | M | M1 |
| M5 | Account + Settings + Theming | User-facing config | **Done** ✅ | M | M0 |
| M6 | Admin Core (Customers + Users) | Admin features | **Done** ✅ | M | M5 |
| M7 | Admin Data Tools (Types + Import) | Admin data management | **Done** ✅ | M | M1, M6 |
| M8 | Admin Analytics + Polish + Responsive | Finishing | **Done** ✅ | L | M2–M7 |

## Dependency Graph

```
M0 ──┬── M1 ──┬── M2 (FilterBar + Flight Board)
     │        ├── M3 (Dashboard)
     │        ├── M4 (Capacity)
     │        └──────── M7 (Admin Data Tools)
     │
     └── M5 ──── M6 ──── M7
                          │
     M2+M3+M4+M5+M6+M7 ── M8 (Polish)
```

M2, M3, M4 can be worked on in parallel after M1. M5 can start in parallel with M1. M6 requires M5. M7 requires M1 + M6. M8 is the final integration/polish milestone.

---

## M0: Scaffold + Database + Auth

**Goal**: Bootable app with auth, base layout, and all infrastructure.

### Acceptance Criteria
- [x] `npm run dev` serves app on localhost:3000
- [x] `npm run build` passes clean
- [x] SQLite database created at `data/dashboard.db` with all tables
- [x] Seed data loaded (2 users, 6 customers, default type mappings)
- [x] Login page renders; auth flow works (login/logout)
- [x] Protected routes redirect to `/login` when not authenticated
- [x] Admin routes return 403 for non-admin users *(implemented in M6 — admin layout + role guard)*
- [x] Base layout renders (sidebar, header with user menu, theme toggle)
- [x] Font Awesome icons render correctly
- [x] Dark theme is default; light mode toggle works

### Key Tasks
1. `create-next-app` + dependencies (shadcn/ui, ECharts, Zustand, Auth.js, Drizzle, etc.)
2. Tailwind v4 config + CSS custom properties for theme
3. Font Awesome self-hosted setup (`public/vendor/fontawesome/`)
4. SQLite + Drizzle schema (users, sessions, customers, config, mh_overrides, aircraft_type_mappings, import_log, analytics_events, user_preferences)
5. Seed script (default users, customers with colors, aircraft type mappings)
6. Auth.js configuration (credentials provider, database sessions)
7. Login page + middleware for route protection
8. Base layout: sidebar navigation, header with user menu, mobile nav
9. Theme toggle (next-themes, dark default)
10. TypeScript types (all interfaces from REQ_DataModel.md)

### Files Created (~30)
See [PLAN.md](PLAN.md) M0 section for complete file list.

---

## M1: Data Layer + API Routes

**Goal**: All data endpoints operational. Event tracking infrastructure in place.

### Acceptance Criteria
- [x] `/api/work-packages?page=1&pageSize=30` returns paginated data
- [x] `/api/work-packages/all` returns full filtered dataset
- [x] `/api/hourly-snapshots` returns time-series data
- [x] `/api/capacity` returns demand + capacity + utilization
- [x] `/api/config` GET/PUT works
- [x] `effectiveMH` respects priority chain (override > WP MH > default 3.0)
- [x] Aircraft type normalization resolves raw types to canonical
- [x] `trackEvent()` utility writes to `analytics_events` table
- [x] `TotalGroundHours` string parsing handles all edge cases (no NaN)
- [x] Records with null `TotalMH` default to 3.0

### Key Tasks
1. Work package reader (`data/input.json` → parsed array)
2. Transformer (SharePointWorkPackage → WorkPackage)
3. Aircraft type normalization service (D-015)
4. effectiveMH computation with MH override lookups
5. Hourly snapshot engine
6. Capacity computation engine
7. API routes: work-packages (paginated + all), hourly-snapshots, capacity, config
8. Pagination utility
9. Event tracking utility (`trackEvent()` + POST /api/analytics/events)

### Files Created (~15)
See [PLAN.md](PLAN.md) M1 section.

---

## M2: FilterBar + Flight Board

**Goal**: First visual milestone — interactive Gantt with full filtering.

### Acceptance Criteria
- [x] FilterBar renders 7 fields (Start, End, Station, TZ, Operator, Aircraft, Type)
- [x] URL query param sync works (bidirectional)
- [x] Filters persist across page navigation
- [x] Reset button restores defaults
- [ ] Date validation: end < start auto-swaps, max 30-day range *(deferred to polish — M8)*
- [x] ECharts Gantt renders aircraft registrations on Y-axis, time on X-axis
- [x] Bars colored by customer (from `useCustomers()` store)
- [x] Tooltip shows all 9 fields on hover
- [x] Zoom toolbar works (6h/12h/1d/3d/1w presets)
- [x] Filters reduce visible aircraft in Gantt
- [x] Mobile: FilterBar collapses to Sheet *(implemented in M8)*

### Key Tasks
1. FilterBar component (7 fields, responsive layout)
2. DateTimePicker (Popover + Calendar + time input)
3. MultiSelect (searchable, with color dots for Operator)
4. Zustand filter store + URL sync hook
5. ECharts Gantt component (dynamic import, ssr: false)
6. Custom `renderItem` for flight bars
7. HTML tooltip formatter
8. Zoom toolbar
9. Flight board page assembly

### Files Created (~12)
See [PLAN.md](PLAN.md) M2 section.

---

## M3: Statistics Dashboard

**Goal**: KPI cards + charts showing operational analytics.

### Acceptance Criteria
- [x] KPI cards render: Total Aircraft, Avg Ground Time (<24h/>=24h), By Type, Peak Concurrent, Total MH
- [x] Combined bar+line chart (arrivals/departures/on-ground per hour)
- [x] MH by Operator horizontal bar chart
- [x] Aircraft by Customer donut chart
- [x] Operator Performance section (comparison table + share charts) — see OI-015
- [x] Data freshness badge in header
- [x] All charts use customer colors from `useCustomers()` store
- [x] Charts update when filters change

### Key Tasks
1. KPI card component
2. Combined bar+line chart (Recharts ComposedChart)
3. MH by Operator chart
4. Aircraft by Customer donut
5. Operator Performance table (KPI-09, KPI-10, KPI-18, KPI-19)
6. Data freshness badge
7. Dashboard page assembly

### Files Created (~8)
See [PLAN.md](PLAN.md) M3 section.

---

## M4: Capacity Modeling

**Goal**: Demand vs capacity visualization with configuration controls.

### Acceptance Criteria
- [x] Configuration panel: Default MH slider, WP include/exclude toggle, shift headcounts
- [x] Daily utilization chart (color-coded bars: green/yellow/red)
- [x] Detail table with pagination (TanStack Table)
- [x] Expandable rows (by Customer, by Shift)
- [x] CSV export downloads all rows
- [x] Config changes recalculate (apply button triggers refetch)
- [x] Filters affect demand only; capacity unchanged by customer/aircraft/type filters

### Key Tasks
1. Configuration panel (sliders, toggles)
2. Utilization chart (Recharts BarChart)
3. Detail table (TanStack Table, paginated)
4. CSV export utility
5. Capacity page assembly

### Files Created (~6)
See [PLAN.md](PLAN.md) M4 section.

---

## M5: Account + Settings + Theming

**Goal**: User-facing configuration and personalization.

### Acceptance Criteria
- [x] Settings page: demand model, capacity model, shifts, display
- [x] Account page: Profile tab (display name editing)
- [x] Account page: Preferences tab (color mode, theme preset, accent, timezone, date range, page size)
- [x] Account page: Security tab (change password + vNext stubs)
- [x] Theme presets work: all 11 Fumadocs presets (Neutral, Ocean, Purple, Black, Vitepress, Dusk, Catppuccin, Solar, Emerald, Ruby, Aspen)
- [x] Each preset works in Light, Dark, and System color modes
- [x] Accent color override applies on top of preset
- [x] Notification toggles present as MVP UI (disabled stubs with "Coming Soon")
- [x] vNext security stubs clearly marked "Coming Soon" (Passkeys, 2FA, Active Sessions)
- [x] Preferences persist across sessions (SQLite + Zustand + localStorage for FOUC prevention)

### Key Tasks
1. Settings page (5 sections)
2. Account page with 3 tabs
3. Profile form
4. Preferences form (appearance, notifications, data display)
5. Security panel (change password + stubs)
6. Theme preset CSS (4 presets × 3 modes)
7. Preferences Zustand store

### Files Created (~12)
See [PLAN.md](PLAN.md) M5 section.

---

## M6: Admin Core (Customers + Users)

**Goal**: Admin section with customer color management and user CRUD.

### Acceptance Criteria
- [x] Admin layout with sub-navigation (7 tabs) + role guard
- [x] Customer color editor with color picker + hex input
- [x] WCAG contrast auto-calculation
- [x] Reset Defaults restores seed colors
- [x] Color changes propagate to all views (via Zustand invalidate)
- [x] User management: list, create, edit, deactivate
- [x] Password reset for users
- [x] System settings page (mirrors /settings for admin scope)
- [x] Audit log stub (Coming Soon)

### Key Tasks
1. Admin layout + sub-navigation
2. Customer color editor component
3. Contrast calculation utility
4. User management table + form
5. Admin API routes (customers, users)
6. System settings page
7. Audit log stub page

### Files Created (~14)
See [PLAN.md](PLAN.md) M6 section.

---

## M7: Admin Data Tools (Aircraft Types + Import)

**Goal**: Admin-controlled data management tools.

### Acceptance Criteria
- [x] Aircraft type mapping editor with pattern/canonical/description columns
- [x] Test input shows real-time match result
- [x] Reset Defaults restores seed mappings
- [x] File upload accepts valid OData JSON
- [x] Paste-JSON validates and shows preview
- [x] Preview shows record count, customer count, aircraft count, date range, warnings
- [x] Import commits data and logs to `import_log` table
- [x] Import history displayed on page
- [x] vNext Power Automate endpoint implemented (D-026: `/api/ingest` with Bearer auth, idempotency, rate limiting, admin UI)

### Key Tasks
1. Aircraft type editor component + test input
2. Aircraft type API routes
3. Data import component (file upload + paste JSON + preview)
4. Import validation + commit API routes
5. Import history display

### Files Created (~8)
See [PLAN.md](PLAN.md) M7 section.

---

## M8: Admin Analytics + Polish + Responsive

**Goal**: System usage analytics, responsive design, and final polish.

### Acceptance Criteria
- [x] `/admin/analytics` page: active users, page views, events by type, recent events table
- [x] Responsive: desktop (expanded sidebar), tablet (collapsed), mobile (sheet)
- [x] Mobile nav sheet, mobile FilterBar sheet
- [x] Loading skeletons for all data areas
- [x] Empty states with FA icons
- [x] Error boundaries per page
- [ ] All theme presets tested against all components *(manual QA)*
- [ ] No FOUC on page load *(manual QA)*
- [ ] All pages render without console errors *(manual QA)*

### Key Tasks
1. Admin analytics page (usage charts + tables)
2. Responsive layout adjustments (all pages)
3. Loading skeleton components
4. Empty state components
5. Error boundaries
6. Final theme preset testing
7. Cross-browser smoke test

### Files Created (~6)
See [PLAN.md](PLAN.md) M8 section.

---

## Build Order (Recommended)

| Phase | Milestones | Focus |
|-------|-----------|-------|
| Phase 1 | M0 | Foundation: scaffold, DB, auth, layout |
| Phase 2 | M1 + M5 (parallel) | Data layer + user config |
| Phase 3 | M2 | Hero page: Flight Board + FilterBar |
| Phase 4 | M3 + M4 (parallel) | Dashboard + Capacity |
| Phase 5 | M6 | Admin core |
| Phase 6 | M7 | Admin data tools |
| Phase 7 | M8 | Analytics, polish, responsive |

## Detailed Plans

- Implementation task plan: `.claude/PLAN.md`
- FilterBar integration: `/plan/PLAN-AMENDMENT-001-FILTER-BAR.md`
- Analytics spec: `.claude/SPECS/REQ_Analytics.md`
- Auth spec: `.claude/SPECS/REQ_Auth.md`
- Admin spec: `.claude/SPECS/REQ_Admin.md`
- Account spec: `.claude/SPECS/REQ_Account.md`
- Aircraft types spec: `.claude/SPECS/REQ_AircraftTypes.md`
- Data import spec: `.claude/SPECS/REQ_DataImport.md`

---

# Capacity Phase 2 — Advanced Operational Lenses

> **Branch:** `feat/capacity-layout`
> **Started:** 2026-02-21
> **Builds on:** Phase 1 capacity engine (WS-1 through WS-8, 175 tests)
>
> Phase 2 extends the capacity page from a single "Planned Capacity" view into **multiple operational lenses**. Each lens adds a new dimension of analysis — contractual obligations, flight events, actual hours, billing, concurrency, and forecasting — unified through a lens selector UI.

## Lens Concept

| Lens | Source WS | Description |
|------|-----------|-------------|
| **Planned** | Phase 1 | Capacity vs WP-based demand (done) |
| **Allocated** | P2-6 | Plus contractual minimum hours per customer |
| **Events** | P2-1 | Plus guaranteed capacity windows around arrivals/departures |
| **Worked** | P2-2 | Plus actual man-hours recorded |
| **Billed** | P2-3 | Plus invoiced/billable hours |
| **Concurrent** | P2-4 | Plus overlapping aircraft pressure index |
| **Forecast** | P2-5 | Plus projected demand based on historical patterns |
| **Unified** | P2-7 | Switch between all lenses via single endpoint + UI tabs |

## Workstream Tracker

| Priority | WS | Feature | Status | DB Tables | Key Files |
|----------|-----|---------|--------|-----------|-----------|
| **P1** | **P2-6** | Demand Allocations | **Done** ✅ | `demand_allocations` | See P2-6 section below |
| **P1** | **P2-1** | Flight Events | **Done** ✅ | `flight_events` | See P2-1 section below |
| **P2** | **P2-5** | Rate Forecast | **Done** ✅ | `forecast_models`, `forecast_rates` | See P2-5 section below |
| **P2** | **P2-2** | Worked Hours | **Done** ✅ | `time_bookings` | See P2-2 section below |
| **P2** | **P2-3** | Billed Hours | **Done** ✅ | `billing_entries` | See P2-3 section below |
| **P3** | **P2-4** | Concurrency | **Done** ✅ | 0 new (computed) | See P2-4 section below |
| **P3** | **P2-7** | Multi-Lens UI | **Done** ✅ | 0 new (UI only) | See P2-7 section below |

### Priority Legend
- **P1** = Start here — no dependencies on other Phase 2 work
- **P2** = Independent of each other, builds on Phase 1
- **P3** = Integration — requires earlier Phase 2 workstreams

### Dependency Graph

```
Phase 1 (WS-1..WS-8) ────┬── P2-6 Demand Allocations ✅
                          ├── P2-1 Flight Events ──── P2-4 Concurrency
                          ├── P2-5 Rate Forecast           │
                          ├── P2-2 Worked Hours             │
                          └── P2-3 Billed Hours             │
                                                            ▼
                          P2-1+P2-2+P2-3+P2-5+P2-6 ── P2-7 Multi-Lens UI
```

## Established Patterns (Set by P2-6)

Every Phase 2 workstream follows this file structure:

| Layer | File Pattern | Example (P2-6) |
|-------|-------------|-----------------|
| Types | `src/types/index.ts` | `DemandAllocation`, `AllocationMode` |
| Schema | `src/lib/db/schema.ts` | `demandAllocations` table + relations |
| Migration | `src/lib/db/schema-init.ts` | `M010_demand_allocations` |
| Engine | `src/lib/capacity/{name}-engine.ts` | `allocation-engine.ts` (pure functions, zero DB) |
| Data | `src/lib/capacity/{name}-data.ts` | `allocation-data.ts` (Drizzle CRUD) |
| Barrel | `src/lib/capacity/index.ts` | Export engine + data functions |
| API Collection | `src/app/api/admin/capacity/{feature}/route.ts` | GET (list) + POST (create) |
| API Single | `src/app/api/admin/capacity/{feature}/[id]/route.ts` | GET + PUT + DELETE |
| Admin Page | `src/app/(authenticated)/admin/capacity/{feature}/page.tsx` | Client component, CRUD handlers |
| Grid | `src/components/admin/capacity/{name}-grid.tsx` | Table + actions + delete dialog |
| Editor | `src/components/admin/capacity/{name}-editor.tsx` | Dialog form (create/edit) |
| Tests | `src/__tests__/capacity/{name}-engine.test.ts` | ~30+ vitest tests |
| Hub Card | `src/app/(authenticated)/admin/capacity/page.tsx` | Add to `CAPACITY_SECTIONS` array |
| Overview | `src/app/api/capacity/overview/route.ts` | Load data → apply → include in response |

**Key constraints:**
- All DB access through `*-data.ts` layer — never import `db` in engines
- All compute logic in pure `*-engine.ts` files — testable without DB
- Semantic versioning (D-028): no breaking changes without notification
- Auth: all admin API routes check `["admin", "superadmin"]` role
- Next.js 15: `await params` in dynamic routes

---

## P2-6: Demand Allocations — DONE ✅

> **Completed:** 2026-02-21 | **Tests:** 35 new (210 total) | **Migration:** M010

### What It Does
Admin-configurable per-customer minimum hours that adjust demand calculations. Two modes:
- **MINIMUM_FLOOR**: `effective = max(normalMH, allocatedMH)` — guarantees a floor
- **ADDITIVE**: `effective = normalMH + allocatedMH` — adds on top

Allocations can be scoped by customer, shift, day-of-week, and date range.

### Design Decisions
- `dayOfWeek` is single integer (not bitmask) — matches headcount plans pattern. For Mon-Thu, create 4 rows.
- No separate preview endpoint — allocations integrated into `/api/capacity/overview` response.
- Hard delete (not soft) — `isActive` toggle for deactivation, delete for permanent removal.
- No FK cascade on customer delete — admin must remove allocations first.
- Customer bridging: demand engine uses name strings, allocations use customerId integers, bridged via `loadCustomerNameMap()`.

### Files Created
| File | Purpose |
|------|---------|
| `src/lib/capacity/allocation-engine.ts` | `findMatchingAllocations`, `computeAllocatedMH`, `applyAllocations`, `validateAllocation` |
| `src/lib/capacity/allocation-data.ts` | CRUD: `loadDemandAllocations`, `createDemandAllocation`, `updateDemandAllocation`, `deleteDemandAllocation`, `loadCustomerNameMap` |
| `src/app/api/admin/capacity/demand-allocations/route.ts` | GET (list) + POST (create) |
| `src/app/api/admin/capacity/demand-allocations/[id]/route.ts` | GET + PUT + DELETE |
| `src/app/(authenticated)/admin/capacity/allocations/page.tsx` | Admin page with CRUD handlers |
| `src/components/admin/capacity/allocation-grid.tsx` | Table with mode badges (amber=Floor, blue=Additive) |
| `src/components/admin/capacity/allocation-editor.tsx` | Dialog form with mode selector cards |
| `src/__tests__/capacity/allocation-engine.test.ts` | 35 tests: matching, compute, apply, validate |

### Files Modified
| File | Change |
|------|--------|
| `src/types/index.ts` | Added `AllocationMode`, `DemandAllocation`; optional `allocatedDemandMH` on `ShiftDemandV2`; `totalAllocatedDemandMH` on `DailyDemandV2`; `allocations?` on `CapacityOverviewResponse` |
| `src/lib/db/schema.ts` | Added `demandAllocations` table (13 cols, 3 indexes) + relations; updated `capacityShiftsRelations`, `customersRelations` |
| `src/lib/db/schema-init.ts` | Added `M010_demand_allocations` migration |
| `src/lib/capacity/index.ts` | Added allocation engine + data exports |
| `src/app/api/capacity/overview/route.ts` | Loads active allocations → `applyAllocations()` → uses adjusted demand for utilization |
| `src/app/(authenticated)/admin/capacity/page.tsx` | Added "Demand Allocations" hub card (fa-handshake, amber) |

### DB Schema: `demand_allocations`
```
id              INTEGER PK AUTOINCREMENT
customer_id     INTEGER NOT NULL FK(customers.id)
shift_id        INTEGER FK(capacity_shifts.id)  -- null = all shifts
day_of_week     INTEGER                          -- 0-6 or null = all days
effective_from  TEXT NOT NULL                     -- YYYY-MM-DD
effective_to    TEXT                              -- null = indefinite
allocated_mh    REAL NOT NULL
mode            TEXT NOT NULL                     -- ADDITIVE | MINIMUM_FLOOR
reason          TEXT
is_active       INTEGER NOT NULL DEFAULT 1
created_by      INTEGER FK(users.id)
created_at      TEXT NOT NULL
updated_at      TEXT NOT NULL

Indexes: idx_da_customer, idx_da_effective, idx_da_shift
```

---

## P2-1: Flight Events — Done ✅

> **Priority:** P1 (no dependencies) | **Effort:** 1 session | **Migration:** M011
> **Completed:** 2026-02-21

### What It Adds
`flight_events` table tracking scheduled vs actual arrivals and departures. Coverage engine computes guaranteed capacity windows (e.g., arrival+30min, departure-60min). Foundation for P2-4 Concurrency.

### Files Created/Modified
- `src/types/index.ts` — FlightEvent, EventCoverageWindow, ConcurrencyBucket types
- `src/lib/db/schema.ts` — flightEvents table + relations
- `src/lib/db/schema-init.ts` — M011_flight_events migration
- `src/lib/capacity/flight-events-engine.ts` — computeEventWindows, computeAllEventWindows, computeCoverageRequirements, computeConcurrencyPressure, validateFlightEvent
- `src/lib/capacity/flight-events-data.ts` — CRUD (loadFlightEvents, loadFlightEvent, create, update, delete)
- `src/lib/capacity/index.ts` — barrel exports
- `src/app/api/admin/capacity/flight-events/route.ts` — GET/POST
- `src/app/api/admin/capacity/flight-events/[id]/route.ts` — GET/PUT/DELETE
- `src/app/(authenticated)/admin/capacity/flight-events/page.tsx` — admin page
- `src/components/admin/capacity/flight-events-grid.tsx` — grid component
- `src/components/admin/capacity/flight-events-editor.tsx` — editor dialog
- `src/__tests__/capacity/flight-events-engine.test.ts` — 33 tests
- `src/app/(authenticated)/admin/capacity/page.tsx` — hub card (sky, fa-plane-arrival)
- `src/app/api/capacity/overview/route.ts` — optional flightEvents + coverageWindows in response

### Design Decisions
- **workPackageId — no FK constraint.** Stored as nullable integer, logical reference only (avoids cascade/import-order issues)
- **Coverage windows as absolute time ranges.** Stored as ISO datetime start/end. `resolveShiftForHour()` maps to shifts when needed
- **Effective time = actual if available, else scheduled.** Mirrors real-world ops
- **Overview integration is read-only.** Events and coverage windows appended as optional fields; demand/capacity unchanged

### Automated Tests (33 passing)
| Suite | Tests | Covers |
|-------|-------|--------|
| `computeEventWindows` | 10 | arrival/departure windows, actual-over-scheduled precedence, cancelled/inactive exclusion, custom durations, zero durations, overnight, eventId propagation |
| `computeAllEventWindows` | 4 | batch processing, date range filtering, empty input, cancelled exclusion |
| `computeConcurrencyPressure` | 8 | empty, single aircraft, overlapping, sequential, cancelled exclusion, missing times, date filter, peak detection |
| `validateFlightEvent` | 10+1 | required fields, enum validation, negative windows, bad datetimes, departure<=arrival, null allowance, multi-error collection |

### Manual Testing Expectations
1. **Hub card** — Navigate to `/admin/capacity`. Verify "Flight Events" card appears with sky color and `fa-plane-arrival` icon. Clicking navigates to `/admin/capacity/flight-events`.
2. **Empty state** — `/admin/capacity/flight-events` shows airplane icon with "No flight events configured" message and helper text.
3. **Create** — Click "Add Event". Fill in Aircraft Reg (`N12345`), Customer (`DHL`), status=Scheduled, source=Manual, Scheduled Arrival (any datetime), Scheduled Departure (later datetime). Save. Event appears in table with correct badges (blue "scheduled", slate "manual").
4. **Edit** — Click pencil icon on existing event. Change status to "actual", add an actual arrival time. Save. Row updates — status badge turns green "actual".
5. **Delete** — Click trash icon. Confirmation dialog appears with event details. Confirm. Row removed.
6. **Active/Inactive** — Edit an event, uncheck "Active". Save. Row appears dimmed (opacity-50).
7. **Window display** — Table shows "+30m / -60m" by default. Create an event with custom windows (e.g., 45/90). Verify display shows "+45m / -90m".
8. **Status badges** — Scheduled=blue, Actual=green, Cancelled=muted.
9. **Source badges** — Work Package=violet "WP", Manual=slate "manual", Import=amber "import".
10. **Cancelled exclusion** — Create a cancelled event. Check `/api/capacity/overview` — the event should appear in `flightEvents` array but NOT generate any `coverageWindows`.
11. **Overview integration** — With active events, call `/api/capacity/overview`. Response includes `flightEvents` array and `coverageWindows` array. With no events, those fields are absent (not empty arrays).
12. **Breadcrumb** — "Capacity > Flight Events" breadcrumb at top. "Capacity" links back to hub.

### User Value
"Guaranteed capacity windows: arrival+30min, departure-60min" — ensures staffing coverage during critical flight events.

---

## P2-5: Rate Forecast — Done ✅

> **Priority:** P2 (independent) | **Completed:** 2026-02-21

### What It Adds
`forecast_models` + `forecast_rates` tables (M012 migration). Three forecasting algorithms (moving average, weighted average, linear trend). Admin CRUD for models and rates. Generate endpoint to compute rates from historical demand. Overview integration with `forecastedDemandMH` overlay.

### Files Created
1. `src/types/index.ts` — ForecastModel, ForecastRate, GeneratedForecastRate, ForecastMethod, ForecastGranularity types + optional forecastedDemandMH on DailyDemandV2/ShiftDemandV2
2. `src/lib/db/schema.ts` — forecastModels + forecastRates tables with relations (CASCADE delete)
3. `src/lib/db/schema-init.ts` — M012_forecast_models_rates migration
4. `src/lib/capacity/forecast-engine.ts` — 8 pure functions: extractHistoricalSeries, computeMovingAverage, computeWeightedAverage, fitLinearRegression, generateForecast, applyForecastRates, validateForecastModel, validateForecastRate
5. `src/lib/capacity/forecast-data.ts` — Full CRUD for models + rates, bulkInsertForecastRates, clearGeneratedRates, loadActiveForecastModel
6. `src/lib/capacity/index.ts` — Barrel exports for engine + data
7. `src/app/api/admin/capacity/forecast-models/route.ts` — GET list + POST create
8. `src/app/api/admin/capacity/forecast-models/[id]/route.ts` — GET + PUT + DELETE
9. `src/app/api/admin/capacity/forecast-models/[id]/generate/route.ts` — POST generate rates
10. `src/app/api/admin/capacity/rate-forecasts/route.ts` — GET list + POST create manual
11. `src/app/api/admin/capacity/rate-forecasts/[id]/route.ts` — GET + PUT + DELETE
12. `src/components/admin/capacity/forecast-model-editor.tsx` — Dialog form for models
13. `src/components/admin/capacity/forecast-rate-editor.tsx` — Dialog form for manual rates
14. `src/components/admin/capacity/forecast-grid.tsx` — Two-section grid (models + rates)
15. `src/app/(authenticated)/admin/capacity/rate-forecasts/page.tsx` — Admin page
16. `src/app/(authenticated)/admin/capacity/page.tsx` — Hub card added
17. `src/app/api/capacity/overview/route.ts` — Forecast integration
18. `src/__tests__/capacity/forecast-engine.test.ts` — 43 tests

### Design Decisions
- **D-040**: CASCADE delete on forecast_rates FK — rates are wholly owned by model
- **D-041**: Forecast overlay (forecastedDemandMH) is informational — does NOT change core utilization calc
- **D-042**: Only first active model used for overview (mirrors loadActiveStaffingConfig pattern)
- **D-043**: bulkInsertForecastRates preserves manual overrides when regenerating

### User Value
"Project future demand based on history" — helps staffing decisions weeks ahead.

---

## P2-2: Worked Hours — Done ✅

> **Priority:** P2 (independent) | **Completed:** 2026-02-21

### What It Adds
`time_bookings` table tracking actual man-hours per task with multi-entry per event support. Five task types: routine, non_routine, aog, training, admin. M013 migration. Engine computes aggregated worked hours overlay on demand (`workedMH` / `totalWorkedMH`). Informational only — does not change utilization calculation (D-044).

### Files Created
1. `src/types/index.ts` — TimeBooking, TimeBookingTaskType, TimeBookingSource; optional workedMH on ShiftDemandV2; totalWorkedMH on DailyDemandV2; timeBookings on CapacityOverviewResponse
2. `src/lib/db/schema.ts` — timeBookings table + timeBookingsRelations
3. `src/lib/db/schema-init.ts` — M013_time_bookings migration
4. `src/lib/capacity/time-bookings-engine.ts` — aggregateWorkedHours, applyWorkedHours, computeVariance, validateTimeBooking
5. `src/lib/capacity/time-bookings-data.ts` — CRUD (loadTimeBookings, loadTimeBooking, create, update, delete)
6. `src/lib/capacity/index.ts` — barrel exports for engine + data
7. `src/app/api/admin/capacity/time-bookings/route.ts` — GET/POST
8. `src/app/api/admin/capacity/time-bookings/[id]/route.ts` — GET/PUT/DELETE
9. `src/app/(authenticated)/admin/capacity/time-bookings/page.tsx` — admin page
10. `src/components/admin/capacity/time-bookings-grid.tsx` — grid with task type badges
11. `src/components/admin/capacity/time-bookings-editor.tsx` — dialog form
12. `src/__tests__/capacity/time-bookings-engine.test.ts` — 41 tests
13. `src/app/(authenticated)/admin/capacity/page.tsx` — hub card (green, fa-stopwatch)
14. `src/app/api/capacity/overview/route.ts` — time bookings integration

### Design Decisions
- **D-044**: Multi-entry per event with task name/type. workedMH overlay is informational only (mirrors D-041)
- Task types: `routine`, `non_routine`, `aog`, `training`, `admin`
- Source types: `manual`, `import`
- `workPackageId` is optional logical reference (no FK constraint, like flight_events)

### User Value
"Actual MH spent vs planned" — reveals estimation accuracy and productivity gaps.

---

## P2-3: Billed Hours — Done ✅

> **Priority:** P2 (independent) | **Completed:** 2026-02-21

### What It Adds
`billing_entries` table tracking invoiced/billable man-hours per customer/aircraft/date. "Billed" lens enables revenue reconciliation — comparing billed hours against worked hours (P2-2) and planned demand.

### Design Decisions
- **D-046:** Billed hours as informational overlay only — `billedMH`/`totalBilledMH` do NOT change utilization calculation. Simple active/inactive model, hours-only (no rate tracking).
- Mirrors P2-2 (Worked Hours / time_bookings) pattern exactly.

### Files Created
1. `src/lib/capacity/billing-engine.ts` — `aggregateBilledHours`, `applyBilledHours`, `computeBillingVariance`, `validateBillingEntry`
2. `src/lib/capacity/billing-data.ts` — CRUD: `loadBillingEntries`, `loadBillingEntry`, `createBillingEntry`, `updateBillingEntry`, `deleteBillingEntry`
3. `src/app/api/admin/capacity/billing-entries/route.ts` — GET list + POST create
4. `src/app/api/admin/capacity/billing-entries/[id]/route.ts` — GET + PUT + DELETE
5. `src/app/(authenticated)/admin/capacity/billing-entries/page.tsx` — Admin CRUD page
6. `src/components/admin/capacity/billing-grid.tsx` — Table with actions
7. `src/components/admin/capacity/billing-editor.tsx` — Dialog form (create/edit)
8. `src/__tests__/capacity/billing-engine.test.ts` — 39 tests

### Files Modified
| File | Change |
|------|--------|
| `src/types/index.ts` | Added `BillingEntry`, `BillingEntrySource`; added optional `billedMH` on `ShiftDemandV2`, `totalBilledMH` on `DailyDemandV2`, `billingEntries?` on `CapacityOverviewResponse` |
| `src/lib/db/schema.ts` | `billingEntries` table + relations |
| `src/lib/db/schema-init.ts` | M014 migration |
| `src/lib/capacity/index.ts` | Barrel exports for billing engine + data |
| `src/app/api/capacity/overview/route.ts` | Billing integration (load, aggregate, overlay) |
| `src/app/(authenticated)/admin/capacity/page.tsx` | Hub card (indigo, fa-file-invoice-dollar) |

### Tests
- 39 new tests (aggregateBilledHours: 8, applyBilledHours: 8, computeBillingVariance: 6, validateBillingEntry: 17)
- All 397 tests passing (358 existing + 39 new)

---

## P2-4: Concurrency — Done ✅

> **Priority:** P3 (requires P2-1) | **Completed:** 2026-02-21

### What It Adds
Concurrency pressure index computed from P2-1 flight events. No new tables — purely derived from overlapping aircraft on-ground windows. Four pure engine functions aggregate hourly `ConcurrencyBucket[]` (from P2-1's `computeConcurrencyPressure`) into day/shift summaries and overlay onto demand.

### Files Created
1. `src/lib/capacity/concurrency-engine.ts` — `aggregateConcurrencyByDay`, `aggregateConcurrencyByShift`, `applyConcurrencyPressure`, `computeConcurrencyPressureIndex`
2. `src/__tests__/capacity/concurrency-engine.test.ts` — 31 tests

### Files Modified
| File | Change |
|------|--------|
| `src/types/index.ts` | Added `ConcurrencyDaySummary`, `ConcurrencyShiftSummary`; added optional `peakConcurrency`, `avgConcurrency` on `ShiftDemandV2` and `DailyDemandV2`; added `concurrencyBuckets?` on `CapacityOverviewResponse` |
| `src/lib/capacity/index.ts` | Barrel exports for concurrency-engine |
| `src/app/api/capacity/overview/route.ts` | Computes concurrency buckets from already-loaded flight events, aggregates by day/shift, overlays onto demand, includes `concurrencyBuckets` in response |

### Design Decisions
- **D-045**: Concurrency is informational overlay only — does NOT change utilization calculation (consistent with D-041 forecast, D-044 worked hours)
- No admin CRUD page — concurrency is fully derived from flight events
- No DB table or migration — pure computed metric
- Pressure index (`peak / headcount * 100`) for UI color-coding thresholds (consumed by P2-7)

### Automated Tests (31 passing)
| Suite | Tests | Covers |
|-------|-------|--------|
| `aggregateConcurrencyByDay` | 7 | empty, single/multi day, peak identification, avg rounding, concurrency-hours count, tie-breaking |
| `aggregateConcurrencyByShift` | 7 | empty, empty shifts, DAY/SWING/NIGHT mapping, multi-shift distribution, multi-day, avg rounding |
| `applyConcurrencyPressure` | 6 | empty short-circuit, day-level overlay, shift-level overlay, unmatched days unchanged, immutability, mixed data |
| `computeConcurrencyPressureIndex` | 11 | zero/negative edge cases, below/at/above capacity, rounding |

### User Value
"How many aircraft overlap?" — workload intensity beyond just MH totals.

---

## P2-7: Multi-Lens UI — Done ✅

> **Priority:** P3 (requires P2-1 through P2-6) | **Completed:** 2026-02-21

### What It Adds
- 7 operational lenses: Planned, Allocated, Events, Forecast, Worked, Billed, Concurrent
- Lens selector pill bar on capacity page with color-coded active states
- Lens-aware KPI strip (extra contextual cards per lens)
- Lens-aware heatmap tooltips (overlay line per lens)
- Lens-aware chart (overlay line for MH-compatible lenses)
- V1→V2 table migration + dynamic lens columns + updated CSV export
- Lens-aware drilldown drawer (detail cards per lens)
- `getAvailableLenses()` — auto-detects which lenses have data

### Key Decision
- **D-047**: Client-side view toggle. No new API — reuses `/api/capacity/overview`. Zustand store expanded. Concurrent/Events skip chart overlay (incompatible units).

### Files Created (3)
| File | Purpose |
|------|---------|
| `src/lib/capacity/lens-config.ts` | Lens definitions + `getAvailableLenses()` |
| `src/components/capacity/lens-selector.tsx` | Horizontal pill bar UI |
| `src/__tests__/capacity/lens-config.test.ts` | 15 tests |

### Files Modified (9)
| File | Change |
|------|--------|
| `src/types/index.ts` | `CapacityLensId` type + fix `CapacityOverviewResponse` gap |
| `src/lib/hooks/use-capacity-v2.ts` | Overlay collections + lens state in Zustand |
| `src/lib/capacity/index.ts` | Barrel exports for lens-config |
| `src/components/capacity/capacity-kpi-strip.tsx` | Lens-aware extra KPI cards |
| `src/components/capacity/capacity-heatmap.tsx` | Lens-aware tooltip lines |
| `src/components/capacity/capacity-summary-chart.tsx` | Lens overlay line on chart |
| `src/components/capacity/capacity-table.tsx` | V1→V2 migration + dynamic lens columns |
| `src/components/capacity/shift-drilldown-drawer.tsx` | Lens detail section cards |
| `src/app/(authenticated)/capacity/page.tsx` | Wire all lens state + remove V1 transforms |

### Tests
- 15 new tests (lens-config.test.ts)
- **412 total** (all passing)
