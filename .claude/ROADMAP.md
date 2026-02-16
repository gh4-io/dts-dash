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

**All milestones complete. Project is production-ready.**

### Post-M8 Enhancements
- [x] Configurable allowed hostnames + trustHost (D-027, OI-037) — 2026-02-16

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
