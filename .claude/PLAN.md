# Implementation Plan (PASS 2)

> **What changed and why (2026-02-13):** Full re-plan rebuilding milestones, tasks, and file lists from scratch based on all canonical specs. Replaces `/plan/FINAL-PLAN.md` as the authoritative build plan. Prior plan files remain as reference but this document governs.
> Generated from: CLAUDE.md + all .claude/ specs + DECISIONS D-001–D-019 + OPEN_ITEMS OI-001–OI-018.

---

## Architecture Overview

```
                    ┌──────────────────────────────────┐
                    │          Next.js App Router        │
                    │     (TypeScript, SSR, API routes)  │
                    └──────┬───────────────┬────────────┘
                           │               │
              ┌────────────┘               └────────────┐
              ▼                                         ▼
     ┌──────────────┐                         ┌──────────────┐
     │  Client-Side  │                         │  Server-Side  │
     │               │                         │               │
     │ React Pages   │  ◄── JSON responses ──  │ API Routes    │
     │ Zustand Stores│                         │ Data Engines  │
     │ ECharts/      │                         │ Auth.js       │
     │   Recharts    │                         │ Drizzle ORM   │
     │ shadcn/ui     │                         │               │
     └──────────────┘                         └──────┬────────┘
                                                      │
                                              ┌───────┴───────┐
                                              │               │
                                        ┌─────┴─────┐  ┌─────┴─────┐
                                        │ SQLite DB  │  │ JSON File │
                                        │ dashboard  │  │ input.json│
                                        │   .db      │  │ (read)    │
                                        └───────────┘  └───────────┘
```

### Major Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Pages | `src/app/` | Next.js App Router pages (login, flight-board, dashboard, capacity, settings, account, admin) |
| UI Components | `src/components/` | shadcn/ui + custom components |
| Layout | `src/components/layout/` | Sidebar, header, user menu, mobile nav, theme toggle |
| Shared | `src/components/shared/` | FilterBar, DateTimePicker, MultiSelect, FaIcon, etc. |
| Zustand Stores | `src/lib/hooks/` | Client-side state (filters, customers, preferences, config) |
| Data Layer | `src/lib/data/` | Reader, transformer, engines (capacity, hourly-snapshot) |
| Auth | `src/lib/auth.ts` | Auth.js configuration |
| Database | `src/lib/db/` | SQLite connection, Drizzle schema, seed, migrations |
| Analytics | `src/lib/analytics/` | Event tracking utility |
| Utils | `src/lib/utils/` | Date, format, aircraft-type, contrast, filter helpers |
| Types | `src/types/` | TypeScript interfaces |
| Middleware | `src/middleware.ts` | Route protection (auth + role checks) |

### Data Flow

```
User Action → Zustand Store → URL Sync → API Fetch → Data Engines → Response → Store → UI Render
                                              │
                                              ├── data/input.json (work packages, read-only)
                                              ├── data/dashboard.db (config, users, colors, events)
                                              └── effectiveMH = override > WP MH > default 3.0
```

---

## M0: Scaffold + Database + Auth

### Task 0.1: Project Initialization
- [ ] Run `npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- [ ] Configure `next.config.js`: `transpilePackages: ['echarts', 'zrender']`, `serverComponentsExternalPackages: ['better-sqlite3']`
- [ ] Configure `tsconfig.json`: strict mode, path aliases

**Files**: `next.config.js`, `tsconfig.json`, `package.json`

### Task 0.2: Dependencies
- [ ] Install UI: `shadcn@latest init` + components (button, card, badge, select, table, tabs, tooltip, dropdown-menu, sheet, dialog, switch, slider, chart, popover, command, calendar)
- [ ] Install core: `zustand`, `next-themes`, `recharts`, `@tanstack/react-table`
- [ ] Install Gantt: `echarts`, `echarts-for-react`
- [ ] Install auth/db: `next-auth@beta`, `drizzle-orm`, `better-sqlite3`, `bcrypt`
- [ ] Install dev: `drizzle-kit`, `@types/better-sqlite3`, `@types/bcrypt`

**Files**: `package.json`, `package-lock.json`

### Task 0.3: Tailwind v4 + Theme
- [ ] Set up `src/styles/globals.css` with `@import "tailwindcss"`
- [ ] Define CSS custom properties for neutral dark theme (Classic preset)
- [ ] Set up `next-themes` provider in root layout
- [ ] Add `suppressHydrationWarning` on `<html>`

**Files**: `src/styles/globals.css`, `src/app/layout.tsx`, `src/components/layout/theme-provider.tsx`

### Task 0.4: Font Awesome
- [ ] Create `public/vendor/fontawesome/css/` and `public/vendor/fontawesome/webfonts/`
- [ ] Add `<link>` to FA stylesheet in root layout head
- [ ] Create `FaIcon` helper component
- [ ] Verify icons render in dev server

**Files**: `public/vendor/fontawesome/**`, `src/components/shared/fa-icon.tsx`

### Task 0.5: TypeScript Types
- [ ] `src/types/sharepoint.ts` — SharePointWorkPackage (raw input)
- [ ] `src/types/work-package.ts` — WorkPackage (normalized)
- [ ] `src/types/filters.ts` — FilterState, FilterQueryParams, TimezoneOption
- [ ] `src/types/capacity.ts` — DailyDemand, DailyCapacity, DailyUtilization, HourlySnapshot, ShiftDefinition
- [ ] `src/types/customer.ts` — Customer
- [ ] `src/types/user.ts` — User, UserRole, UserPreferences
- [ ] `src/types/aircraft-type.ts` — AircraftType, AircraftTypeMapping, NormalizedAircraftType
- [ ] `src/types/pagination.ts` — PaginationParams, PaginatedResponse
- [ ] `src/types/config.ts` — AppConfig
- [ ] `src/types/analytics.ts` — AnalyticsEvent, ImportLogEntry

**Files**: 10 type files in `src/types/`

### Task 0.6: SQLite + Drizzle Schema
- [ ] Create `src/lib/db/index.ts` — SQLite connection (better-sqlite3)
- [ ] Create `src/lib/db/schema.ts` — Drizzle schema for all tables:
  - `users` (id, email, displayName, passwordHash, role, isActive, timestamps)
  - `sessions` (id, userId, token, expiresAt, ipAddress, userAgent, timestamps)
  - `user_preferences` (userId, colorMode, themePreset, accentColor, compactMode, defaultTimezone, defaultDateRange, tablePageSize, notification toggles)
  - `customers` (id, name, displayName, color, colorText, isActive, sortOrder, timestamps)
  - `config` (key, value JSON)
  - `mh_overrides` (workPackageId, overrideMH, updatedBy, updatedAt)
  - `aircraft_type_mappings` (id, pattern, canonicalType, description, priority, isActive, timestamps)
  - `import_log` (id, userId, source, recordCount, customerCount, aircraftCount, dateRangeStart, dateRangeEnd, warnings, timestamp)
  - `analytics_events` (id, eventName, userId, role, sessionId, station, timezone, page, props, timestamp)
- [ ] Create `drizzle.config.ts`

**Files**: `src/lib/db/index.ts`, `src/lib/db/schema.ts`, `drizzle.config.ts`

### Task 0.7: Seed Data
- [ ] Create `src/lib/db/seed.ts`:
  - Seed 2 default users (superadmin + user)
  - Seed 6 customers with default colors
  - Seed default aircraft type mapping rules
  - Seed default app config

**Files**: `src/lib/db/seed.ts`

### Task 0.8: Auth.js Configuration
- [ ] Create `src/lib/auth.ts` — Auth.js config (credentials provider, database session strategy)
- [ ] Create `src/app/api/auth/[...nextauth]/route.ts` — Auth.js API routes
- [ ] Create `.env.local` with `NEXTAUTH_SECRET`

**Files**: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `.env.local`

### Task 0.9: Middleware
- [ ] Create `src/middleware.ts`:
  - Public routes: `/login`, `/api/auth`
  - Protected routes: all others → redirect to `/login`
  - Admin routes: `/admin/*` → 403 if role is `user`

**Files**: `src/middleware.ts`

### Task 0.10: Login Page
- [ ] Create `src/app/login/page.tsx`:
  - Email + password form
  - "Remember me" checkbox
  - Generic error message ("Invalid credentials")
  - Redirect to `/flight-board` on success
  - Font Awesome icons (envelope, lock, right-to-bracket)

**Files**: `src/app/login/page.tsx`

### Task 0.11: Base Layout
- [ ] Create `src/app/layout.tsx` — Root layout (html, body, theme provider, FA link)
- [ ] Create `src/components/layout/sidebar.tsx` — Navigation sidebar (5 items + admin)
- [ ] Create `src/components/layout/header.tsx` — Top bar with user menu trigger
- [ ] Create `src/components/layout/user-menu.tsx` — Dropdown: Account / Admin (if admin) / Logout
- [ ] Create `src/components/layout/mobile-nav.tsx` — Sheet-based nav for mobile
- [ ] Create `src/components/layout/theme-toggle.tsx` — Dark/light switch

**Files**: 6 layout files

### Task 0.12: Placeholder Pages
- [ ] Create stub `page.tsx` for: `/flight-board`, `/dashboard`, `/capacity`, `/settings`, `/account`, `/admin`
- [ ] Each shows page name + "Coming in M{N}" text

**Files**: 6 page stubs

### Task 0.13: Verification
- [ ] `npm run build` passes
- [ ] `npm run lint` clean
- [ ] `npm run dev` renders login, login works, layout shows after auth
- [ ] Copy `data/input.json` from `.claude/assets/`

---

## M1: Data Layer + API Routes

### Task 1.1: Work Package Reader
- [ ] Create `src/lib/data/reader.ts`:
  - Read `data/input.json`, parse OData format
  - Module-level cache with invalidation flag
  - Handle both `{ value: [...] }` and bare array formats

**Files**: `src/lib/data/reader.ts`

### Task 1.2: Aircraft Type Normalization Service
- [ ] Create `src/lib/utils/aircraft-type.ts`:
  - `normalizeAircraftType(rawType, mappings)` → NormalizedAircraftType
  - Load mappings from SQLite on first call, cache
  - Resolution: exact → pattern (descending priority) → Unknown

**Files**: `src/lib/utils/aircraft-type.ts`

### Task 1.3: Transformer
- [ ] Create `src/lib/data/transformer.ts`:
  - `transformWorkPackages(raw[])` → WorkPackage[]
  - Parse `TotalGroundHours` string → number (NaN → 0)
  - Parse `IsNotClosedOrCanceled` string → boolean
  - Call `normalizeAircraftType()` for inferredType
  - Compute `effectiveMH`: override > WP MH (if include) > default 3.0
  - Lookup MH overrides from SQLite `mh_overrides`

**Files**: `src/lib/data/transformer.ts`

### Task 1.4: Computation Engines
- [ ] Create `src/lib/data/engines/hourly-snapshot.ts`:
  - Compute arrivals/departures/on-ground per hour boundary
- [ ] Create `src/lib/data/engines/capacity.ts`:
  - Compute daily demand, capacity, utilization
  - Apply shift headcounts from config
  - Demand filtered by customer/aircraft/type; capacity is NOT filtered

**Files**: `src/lib/data/engines/hourly-snapshot.ts`, `src/lib/data/engines/capacity.ts`

### Task 1.5: API Routes
- [ ] `src/app/api/work-packages/route.ts` — GET with filters + pagination (D-017)
- [ ] `src/app/api/work-packages/all/route.ts` — GET with filters, no pagination
- [ ] `src/app/api/hourly-snapshots/route.ts` — GET with filters
- [ ] `src/app/api/capacity/route.ts` — GET with filters
- [ ] `src/app/api/config/route.ts` — GET/PUT

**Files**: 5 API route files

### Task 1.6: Pagination Utility
- [ ] Create `src/lib/utils/pagination.ts`:
  - `paginate<T>(items, params)` → PaginatedResponse<T>
  - Validate page/pageSize bounds (min 1, max 200)

**Files**: `src/lib/utils/pagination.ts`

### Task 1.7: Filter Helpers
- [ ] Create `src/lib/utils/filter-helpers.ts`:
  - Parse filter query params from URL
  - Validate dates, operators, aircraft, types
  - Apply filter predicate to work package array

**Files**: `src/lib/utils/filter-helpers.ts`

### Task 1.8: Date Utilities
- [ ] Create `src/lib/utils/date-helpers.ts`:
  - Format dates in arbitrary IANA timezone
  - ISO 8601 parsing/formatting
  - Duration formatting (H:MM)
  - Hour boundary generation for snapshots

**Files**: `src/lib/utils/date-helpers.ts`

### Task 1.9: Event Tracking
- [ ] Create `src/lib/analytics/track.ts`:
  - Client-side `trackEvent(eventName, props?)` — POST to API
  - Fire-and-forget (never blocks UI)
- [ ] Create `src/app/api/analytics/events/route.ts`:
  - POST: attach common props (user_id, role, session_id, timestamp), write to SQLite
  - GET: query events (admin only, paginated)

**Files**: `src/lib/analytics/track.ts`, `src/app/api/analytics/events/route.ts`

### Task 1.10: Verification
- [ ] All API routes return correct data for sample input.json
- [ ] Pagination works: `?page=1&pageSize=10` returns 10 records + correct meta
- [ ] effectiveMH formula tested with known values
- [ ] Aircraft type normalization tested with non-standard inputs

---

## M2: FilterBar + Flight Board

### Task 2.1: Zustand Filter Store
- [ ] Create `src/lib/hooks/use-filters.ts`:
  - State: FilterState (start, end, station, timezone, operators, aircraft, types)
  - Actions: setStart, setEnd, setOperators, etc., reset
  - `skipHydration: true`

**Files**: `src/lib/hooks/use-filters.ts`

### Task 2.2: URL Sync Hook
- [ ] Create `src/lib/hooks/use-filter-url-sync.ts`:
  - Bidirectional sync: URL → store on mount, store → URL on change
  - 300ms debounce on store → URL
  - `router.replace()` (no history push)

**Files**: `src/lib/hooks/use-filter-url-sync.ts`

### Task 2.3: Customers Store
- [ ] Create `src/lib/hooks/use-customers.ts`:
  - Fetch from `/api/admin/customers` on mount
  - `getColor(customerName)` helper
  - Cache until invalidated

**Files**: `src/lib/hooks/use-customers.ts`

### Task 2.4: Custom Filter Components
- [ ] Create `src/components/shared/datetime-picker.tsx` — Popover + Calendar + time input
- [ ] Create `src/components/shared/multi-select.tsx` — Searchable multi-check with color dots
- [ ] Create `src/components/shared/customer-badge.tsx` — Color dot + name

**Files**: 3 component files

### Task 2.5: FilterBar Component
- [ ] Create `src/components/shared/filter-bar.tsx`:
  - 7 fields: Start, End, Station (badge), TZ (select), Operator, Aircraft, Type
  - Responsive: 2 rows desktop, 2×2 tablet, sheet mobile
  - Reset button
  - Integrate URL sync hook

**Files**: `src/components/shared/filter-bar.tsx`

### Task 2.6: ECharts Gantt
- [ ] Create `src/components/flight-board/flight-board-chart.tsx`:
  - `dynamic(() => import(...), { ssr: false })`
  - Custom series with `renderItem`
  - Y-axis: registrations, X-axis: time
  - Bars colored by customer from `useCustomers()`
  - `dataZoom` for zoom/scroll
- [ ] Create `src/components/flight-board/flight-tooltip.tsx`:
  - HTML formatter with 9 fields
- [ ] Create `src/components/flight-board/gantt-toolbar.tsx`:
  - Zoom presets: 6h/12h/1d/3d/1w

**Files**: 3 flight board component files

### Task 2.7: Work Packages Hook
- [ ] Create `src/lib/hooks/use-work-packages.ts`:
  - Fetch from API on filter change
  - Transform to ECharts data format

**Files**: `src/lib/hooks/use-work-packages.ts`

### Task 2.8: Flight Board Page
- [ ] Create `src/app/flight-board/page.tsx`:
  - FilterBar + Gantt + Legend
  - Wire page_view, filter_change, gantt_zoom, gantt_bar_click events

**Files**: `src/app/flight-board/page.tsx`

### Task 2.9: Verification
- [ ] FilterBar 7 fields render
- [ ] URL params sync bidirectionally
- [ ] Gantt renders with colored bars
- [ ] Tooltip shows on hover
- [ ] Zoom works
- [ ] Filters reduce visible aircraft

---

## M3: Statistics Dashboard

### Task 3.1: KPI Card Component
- [ ] Create `src/components/dashboard/kpi-card.tsx` — Reusable card with icon, value, label

### Task 3.2: Dashboard Charts
- [ ] Create `src/components/dashboard/arrivals-departures-chart.tsx` — Recharts ComposedChart (bar+line)
- [ ] Create `src/components/dashboard/mh-by-operator-chart.tsx` — Horizontal bar chart
- [ ] Create `src/components/dashboard/aircraft-by-customer-chart.tsx` — Donut (PieChart)

### Task 3.3: Operator Performance Section
- [ ] Create `src/components/dashboard/operator-performance.tsx`:
  - Comparison table (KPI-09, KPI-10, KPI-18, KPI-19)
  - Customer MH share chart
  - Type mix per operator chart

### Task 3.4: Data Freshness Badge
- [ ] Create `src/components/shared/data-freshness-badge.tsx`:
  - Query `import_log` for latest timestamp
  - Color: green (<24h), yellow (<72h), red (>72h)

### Task 3.5: Dashboard Page
- [ ] Create `src/app/dashboard/page.tsx`:
  - KPI cards row + charts + operator performance section
  - Wire page_view, filter_change events

**Files**: ~8 files total

---

## M4: Capacity Modeling

### Task 4.1: Configuration Panel
- [ ] Create `src/components/capacity/config-panel.tsx`:
  - Default MH slider (0.5–10.0)
  - WP MH include/exclude switch
  - Shift headcount editor

### Task 4.2: Utilization Chart
- [ ] Create `src/components/capacity/utilization-chart.tsx`:
  - Daily bars, color-coded (green <80%, yellow 80-100%, red >100%)

### Task 4.3: Detail Table
- [ ] Create `src/components/capacity/capacity-table.tsx`:
  - TanStack Table with pagination (D-017)
  - Columns: Date, Demand MH, Capacity MH, Utilization %, Surplus/Deficit, Flags
  - Expandable rows by customer/shift

### Task 4.4: CSV Export
- [ ] Create `src/lib/utils/csv-export.ts` — Download table data as CSV

### Task 4.5: Capacity Hook
- [ ] Create `src/lib/hooks/use-capacity.ts` — Fetch + store demand/capacity/utilization

### Task 4.6: Capacity Page
- [ ] Create `src/app/capacity/page.tsx`:
  - FilterBar + config panel + chart + table
  - Wire page_view, filter_change, capacity_config_change, csv_export events

**Files**: ~6 files total

---

## M5: Account + Settings + Theming

### Task 5.1: Theme Presets CSS
- [ ] Add CSS classes `.theme-classic`, `.theme-ocean`, `.theme-lavender`, `.theme-midnight` to `globals.css`
- [ ] Each overrides `--accent`, `--surface`, and related custom properties
- [ ] Each works in both `:root` (light) and `.dark` (dark) mode

### Task 5.2: Preferences Store
- [ ] Create `src/lib/hooks/use-preferences.ts`:
  - Fetch from API on login, cache
  - Apply theme preset + color mode on mount

### Task 5.3: Settings Page
- [ ] Rewrite `src/app/settings/page.tsx`:
  - Demand model, capacity model, shifts, display, data sections
  - Persist to SQLite via `PUT /api/config`

### Task 5.4: Account Page
- [ ] Create `src/app/account/page.tsx` + `layout.tsx`
- [ ] Create `src/components/account/profile-form.tsx` — Edit display name
- [ ] Create `src/components/account/preferences-form.tsx` — Appearance + notifications + data display
- [ ] Create `src/components/account/security-panel.tsx` — Change password + vNext stubs
- [ ] Create `src/components/account/change-password-form.tsx`

### Task 5.5: Account API Routes
- [ ] Create `src/app/api/account/profile/route.ts` — PUT profile
- [ ] Create `src/app/api/account/preferences/route.ts` — GET/PUT preferences
- [ ] Create `src/app/api/account/password/route.ts` — PUT password

**Files**: ~12 files total

---

## M6: Admin Core (Customers + Users)

### Task 6.1: Admin Layout
- [ ] Create `src/app/admin/layout.tsx` — Sub-navigation (7 tabs) + role guard
- [ ] Create `src/app/admin/page.tsx` — Redirect to `/admin/customers`

### Task 6.2: Customer Color Editor
- [ ] Create `src/app/admin/customers/page.tsx`
- [ ] Create `src/components/admin/customer-color-editor.tsx` — Color picker + hex input
- [ ] Create `src/lib/utils/contrast.ts` — WCAG contrast auto-calculation

### Task 6.3: Customer API Routes
- [ ] Create `src/app/api/admin/customers/route.ts` — GET/PUT/POST/DELETE

### Task 6.4: User Management
- [ ] Create `src/app/admin/users/page.tsx`
- [ ] Create `src/components/admin/user-table.tsx` — List with actions
- [ ] Create `src/components/admin/user-form.tsx` — Create/edit dialog

### Task 6.5: User API Routes
- [ ] Create `src/app/api/admin/users/route.ts` — CRUD

### Task 6.6: System Settings + Stubs
- [ ] Create `src/app/admin/settings/page.tsx` — Admin system config
- [ ] Create `src/app/admin/audit/page.tsx` — "Coming Soon" stub

**Files**: ~14 files total

---

## M7: Admin Data Tools (Aircraft Types + Import)

### Task 7.1: Aircraft Type Editor
- [ ] Create `src/app/admin/aircraft-types/page.tsx`
- [ ] Create `src/components/admin/aircraft-type-editor.tsx` — Rule table + test input
- [ ] Create `src/app/api/admin/aircraft-types/route.ts` — CRUD
- [ ] Create `src/app/api/admin/aircraft-types/test/route.ts` — Test endpoint

### Task 7.2: Data Import
- [ ] Create `src/app/admin/import/page.tsx`
- [ ] Create `src/components/admin/data-import.tsx` — File upload + paste JSON + preview
- [ ] Create `src/app/api/admin/import/validate/route.ts`
- [ ] Create `src/app/api/admin/import/commit/route.ts`
- [ ] Create `src/app/api/admin/import/history/route.ts`

**Files**: ~8 files total

---

## M8: Admin Analytics + Polish + Responsive

### Task 8.1: Admin Analytics Page
- [ ] Create `src/app/admin/analytics/page.tsx`
- [ ] Create `src/components/admin/analytics-dashboard.tsx`:
  - Active users, page views, events by type cards
  - Page views over time line chart
  - Top pages bar chart
  - Recent events table (paginated, filterable)

### Task 8.2: Loading & Empty States
- [ ] Create `src/components/shared/loading-skeleton.tsx` — Skeleton cards/charts
- [ ] Create `src/components/shared/empty-state.tsx` — FA icon + message + action

### Task 8.3: Error Boundaries
- [ ] Create `src/app/flight-board/error.tsx`
- [ ] Create `src/app/dashboard/error.tsx`
- [ ] Create `src/app/capacity/error.tsx`
- [ ] Create `src/app/admin/error.tsx`

### Task 8.4: Responsive Polish
- [ ] Verify sidebar: expanded (xl) → collapsed (md) → sheet (sm)
- [ ] Verify FilterBar: 2-row → 2×2 grid → sheet
- [ ] Verify all charts resize correctly
- [ ] Test touch interactions on mobile

### Task 8.5: Theme Testing
- [ ] Test all 4 presets × 3 color modes = 12 combinations
- [ ] Verify accent color override in each preset
- [ ] Verify no FOUC on page load

### Task 8.6: Final Verification
- [ ] Run full TEST_PLAN.md manual checklist
- [ ] `npm run build` + `npm run lint` clean
- [ ] All pages render in dev + production

**Files**: ~6 files total

---

## Complete File Inventory (~110 files)

### Types (10)
```
src/types/sharepoint.ts
src/types/work-package.ts
src/types/filters.ts
src/types/capacity.ts
src/types/customer.ts
src/types/user.ts
src/types/aircraft-type.ts
src/types/pagination.ts
src/types/config.ts
src/types/analytics.ts
```

### Database (4)
```
src/lib/db/index.ts
src/lib/db/schema.ts
src/lib/db/seed.ts
drizzle.config.ts
```

### Auth (2)
```
src/lib/auth.ts
src/app/api/auth/[...nextauth]/route.ts
```

### Data Layer (7)
```
src/lib/data/reader.ts
src/lib/data/transformer.ts
src/lib/data/engines/hourly-snapshot.ts
src/lib/data/engines/capacity.ts
src/lib/utils/aircraft-type.ts
src/lib/utils/filter-helpers.ts
src/lib/utils/date-helpers.ts
```

### Analytics (2)
```
src/lib/analytics/track.ts
src/app/api/analytics/events/route.ts
```

### Utils (3)
```
src/lib/utils/pagination.ts
src/lib/utils/csv-export.ts
src/lib/utils/contrast.ts
```

### Zustand Stores (6)
```
src/lib/hooks/use-filters.ts
src/lib/hooks/use-filter-url-sync.ts
src/lib/hooks/use-work-packages.ts
src/lib/hooks/use-capacity.ts
src/lib/hooks/use-customers.ts
src/lib/hooks/use-preferences.ts
```

### Layout (7)
```
src/app/layout.tsx
src/components/layout/sidebar.tsx
src/components/layout/header.tsx
src/components/layout/user-menu.tsx
src/components/layout/mobile-nav.tsx
src/components/layout/theme-toggle.tsx
src/components/layout/theme-provider.tsx
```

### Shared Components (7)
```
src/components/shared/filter-bar.tsx
src/components/shared/datetime-picker.tsx
src/components/shared/multi-select.tsx
src/components/shared/fa-icon.tsx
src/components/shared/customer-badge.tsx
src/components/shared/loading-skeleton.tsx
src/components/shared/empty-state.tsx
src/components/shared/data-freshness-badge.tsx
```

### Pages (12)
```
src/app/login/page.tsx
src/app/flight-board/page.tsx
src/app/dashboard/page.tsx
src/app/capacity/page.tsx
src/app/settings/page.tsx
src/app/account/page.tsx
src/app/account/layout.tsx
src/app/admin/page.tsx
src/app/admin/layout.tsx
src/app/admin/customers/page.tsx
src/app/admin/aircraft-types/page.tsx
src/app/admin/import/page.tsx
src/app/admin/users/page.tsx
src/app/admin/settings/page.tsx
src/app/admin/analytics/page.tsx
src/app/admin/audit/page.tsx
```

### Page-Specific Components (16)
```
src/components/flight-board/flight-board-chart.tsx
src/components/flight-board/flight-tooltip.tsx
src/components/flight-board/gantt-toolbar.tsx
src/components/dashboard/kpi-card.tsx
src/components/dashboard/arrivals-departures-chart.tsx
src/components/dashboard/mh-by-operator-chart.tsx
src/components/dashboard/aircraft-by-customer-chart.tsx
src/components/dashboard/operator-performance.tsx
src/components/capacity/config-panel.tsx
src/components/capacity/utilization-chart.tsx
src/components/capacity/capacity-table.tsx
src/components/account/profile-form.tsx
src/components/account/preferences-form.tsx
src/components/account/security-panel.tsx
src/components/account/change-password-form.tsx
src/components/admin/customer-color-editor.tsx
src/components/admin/aircraft-type-editor.tsx
src/components/admin/data-import.tsx
src/components/admin/user-table.tsx
src/components/admin/user-form.tsx
src/components/admin/analytics-dashboard.tsx
```

### API Routes (16)
```
src/app/api/auth/[...nextauth]/route.ts
src/app/api/work-packages/route.ts
src/app/api/work-packages/all/route.ts
src/app/api/hourly-snapshots/route.ts
src/app/api/capacity/route.ts
src/app/api/config/route.ts
src/app/api/analytics/events/route.ts
src/app/api/account/profile/route.ts
src/app/api/account/preferences/route.ts
src/app/api/account/password/route.ts
src/app/api/admin/customers/route.ts
src/app/api/admin/users/route.ts
src/app/api/admin/aircraft-types/route.ts
src/app/api/admin/aircraft-types/test/route.ts
src/app/api/admin/import/validate/route.ts
src/app/api/admin/import/commit/route.ts
src/app/api/admin/import/history/route.ts
```

### Error Boundaries (4)
```
src/app/flight-board/error.tsx
src/app/dashboard/error.tsx
src/app/capacity/error.tsx
src/app/admin/error.tsx
```

### Config & Static (5+)
```
next.config.js
tsconfig.json
.env.local
src/styles/globals.css
src/middleware.ts
public/vendor/fontawesome/**
data/input.json
```

---

## MVP vs vNext Summary

### MVP (M0–M8)
- All 3 core views (Flight Board, Dashboard, Capacity)
- Global FilterBar with 7 fields + URL sync
- Auth with email/password, role-based access
- Customer colors (admin-configurable)
- Aircraft type normalization (admin-editable)
- Data import (file upload + paste JSON)
- Account page (profile, preferences, change password)
- Admin section (customers, users, aircraft types, import, settings)
- Admin analytics (usage tracking)
- 4 theme presets + accent color override
- Responsive layout (desktop/tablet/mobile)
- Pagination on table views

### vNext (stubs/documented only)
- Passkeys (WebAuthn)
- TOTP 2FA
- OAuth providers
- Password reset via email
- Active sessions management
- Full audit log with previous/new values
- Power Automate POST endpoint (`/api/ingest`)
- Notification delivery (email/push/SMS)
- Bulk user import
- Mini Gantt on Dashboard
- KPI-20 (Busiest Aircraft), KPI-21 (Avg Turnaround by Type)
- Materialized KPI views for scale (>2000 records)
