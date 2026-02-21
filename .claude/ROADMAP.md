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

**Current Focus: Capacity Phase 2** — Advanced capacity lenses on `feat/capacity-mvp` branch.

### Post-M8 Enhancements
- [x] Configurable allowed hostnames + trustHost (D-027, OI-037) — 2026-02-16
- [x] Cron job management: code defaults + YAML overrides + Admin UI (D-030) — 2026-02-17

### Capacity Phase 1 (Complete)
- [x] WS-1 through WS-5: Core capacity engine, demand distribution, shifts, assumptions — 2026-02-20
- [x] WS-6: Integration, import schemas, docs — 2026-02-20
- [x] WS-7: Rotation-based staffing system — 2026-02-21
- [x] WS-8: Staffing-driven capacity mode — 2026-02-21

### Capacity Phase 2 (In Progress)
- [x] P2-6: Demand Allocations — 2026-02-21
- [ ] P2-1: Flight Events — **NEXT**
- [ ] P2-5: Rate Forecast
- [ ] P2-2: Worked Hours
- [ ] P2-3: Billed Hours
- [ ] P2-4: Concurrency (blocked by P2-1)
- [ ] P2-7: Multi-Lens UI (blocked by P2-1 through P2-6)

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

> **Branch:** `feat/capacity-mvp`
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
| P2 | **P2-5** | Rate Forecast | **Next** 🔜 | `forecast_models`, `forecast_rates` | — |
| P2 | **P2-2** | Worked Hours | Planned | `time_bookings` | — |
| P2 | **P2-3** | Billed Hours | Planned | `billing_entries` | — |
| P3 | **P2-4** | Concurrency | Planned (needs P2-1) | 0 new | — |
| P3 | **P2-7** | Multi-Lens UI | Planned (needs all) | 0 new | — |

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

## P2-5: Rate Forecast — NEXT 🔜

> **Priority:** P2 (independent) | **Effort:** 1-2 sessions

### What It Adds
`forecast_models` + `forecast_rates` tables. Rate projection algorithm based on historical demand patterns. "Forecast" lens on capacity page.

### User Value
"Project future demand based on history" — helps staffing decisions weeks ahead.

---

## P2-2: Worked Hours — Planned

> **Priority:** P2 (independent) | **Effort:** 1-2 sessions

### What It Adds
`time_bookings` table tracking actual man-hours spent per work package. "Worked" lens compares planned vs actual.

### User Value
"Actual MH spent vs planned" — reveals estimation accuracy and productivity gaps.

---

## P2-3: Billed Hours — Planned

> **Priority:** P2 (independent) | **Effort:** 1-2 sessions

### What It Adds
`billing_entries` table tracking invoiced/billable hours. "Billed" lens shows revenue recognition.

### User Value
"Revenue recognition + billing reconciliation" — compares worked vs billed hours.

---

## P2-4: Concurrency — Planned

> **Priority:** P3 (requires P2-1) | **Effort:** 1 session

### What It Adds
Concurrency pressure index computed from P2-1 flight events. No new tables — derived metric from overlapping aircraft windows.

### User Value
"How many aircraft overlap?" — workload intensity beyond just MH totals.

---

## P2-7: Multi-Lens UI — Planned

> **Priority:** P3 (requires P2-1 through P2-6) | **Effort:** 1-2 sessions

### What It Adds
- Unified `/api/capacity/lenses` endpoint combining all lens data
- Lens selector UI (tabs or dropdown on capacity page)
- "Switch lenses: Planned → Allocated → Events → Worked → Billed → Forecast → Concurrent"

### User Value
Single capacity page that can show any operational perspective.
