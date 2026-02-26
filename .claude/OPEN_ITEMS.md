# Open Items

> Tracked questions, decisions needed, and unresolved issues.
> Format: `OI-###` with priority, status, and owner.
> **Restructured 2026-02-26** — open items at top; resolved items archived in compact tables below.

---

## Active Bugs

### OI-043 | Chunked Upload Location Header Returns Localhost Behind Proxy

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** — fix committed, not yet deployed/verified |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |

When Power Automate initiates a chunked upload, the server returns a `Location` header pointing to `https://localhost:5015/api/ingest/chunks/{sessionId}`. PA rejects this. Fix applied (use `X-Forwarded-Host` / `X-Forwarded-Proto` headers) but not deployed.

**Verification needed**: (1) Confirm Cloudflare Tunnel sends `X-Forwarded-Host` + `X-Forwarded-Proto`. (2) Deploy to Braxton and restart. (3) Test chunked upload — Location header should read `https://cvg.gh4.io/...`.

**Files**: `src/app/api/ingest/route.ts` (lines 140–145)
**Links**: OI-034, OI-037, [REQ_DataImport.md](SPECS/REQ_DataImport.md)

---

### OI-083 | Flight Board ECharts Chart Does Not Update on Theme Switch

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-26 |

Switching between light and dark mode does not cause the ECharts Gantt chart to re-render or refresh its color palette. The chart retains stale theme colors until the page is manually reloaded. All other Recharts-based charts (Dashboard, Capacity) update correctly because they are React-rendered and respond to CSS variable changes automatically. ECharts uses a canvas renderer that must be explicitly told to re-initialize its theme.

**Root cause**: The `flight-board-chart.tsx` likely does not observe the `next-themes` resolved theme value, so the ECharts instance never receives a `setOption` call or `dispose`+`reinit` cycle when the theme changes.

**Proposed fix**: Consume the `resolvedTheme` value from `useTheme()` (next-themes) in `flight-board-chart.tsx` and add it as a dependency to the ECharts initialization `useEffect`. When theme changes, dispose and reinitialize the chart instance with updated colors.

**Files**: `src/components/flight-board/flight-board-chart.tsx`
**Links**: [REQ_Themes.md](SPECS/REQ_Themes.md), OI-047

---

### OI-047 | Flight Board Chart Color Reset on Rapid Clicks

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Customer colors on the flight board Gantt occasionally revert to defaults after rapid clicks. Likely: ECharts state mutation during rapid updates, or Zustand customer store not syncing across re-renders.

**Investigation**: Debug ECharts chart update flow; verify Zustand customer store invalidates correctly; consider key-based cache invalidation for series colors.

**Files**: `src/components/flight-board/flight-board-chart.tsx`, `src/lib/hooks/use-customers.ts`

---

### OI-074 | Dashboard Aircraft & Turns Section Date Mismatch

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-25 |

Aircraft & Turns section on `/dashboard` does not reflect date selection from the global FilterBar. Investigate filter state propagation to dashboard data fetching.

**Files**: `src/app/(authenticated)/dashboard/page.tsx`, `src/components/dashboard/total-aircraft-card.tsx`
**Links**: [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md)

---

### OI-079 | Staffing Peak Day Calculations Overflow

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-26 |

"Peak Day" values on `/admin/capacity/staffing` display unrounded decimals that overflow cells. Round to 2 decimal places.

**Files**: `src/components/admin/capacity/staffing-grid.tsx` (or relevant staffing display component)

---

### OI-081 | Server Settings: Cleanup Grace Period Duplicated

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-02-26 |

"Cleanup Grace Period" setting appears twice on the Admin Settings page. Remove the duplicate entry.

**Files**: `src/app/(authenticated)/admin/settings/page.tsx` or `src/components/admin/server-tab.tsx`

---

## Open Enhancements

### OI-042 | Dashboard Chart Issues — PARTIALLY RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug + Enhancement |
| **Status** | **Partially Resolved** |
| **Priority** | P2 |
| **Resolved** | Items 1, 2, 4, 5 — 2026-02-18 |

Items 1 (pie tooltip), 2 (cross-filter timeline), 4 (timezone in header), 5 (aircraft & turns card) fixed.

**Still open — deferred to v0.3.0+:**
- **Item 3**: Pie chart popout vs single-pick interaction
- **Item 6**: Interactive chart brush selection + customer cross-filter (ECharts brush + Zustand state)

**Files**: `dashboard/page.tsx`, `customer-donut.tsx`, `combined-chart.tsx`
**Links**: [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md)

---

### OI-044 | Generic db:cleanup + Data Retention Policy

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Partially Resolved** |
| **Priority** | P2 |
| **Resolved** | Cron management system — 2026-02-17 (D-030) |

Built-in `cleanup-canceled` cron job with configurable `graceHours` works. **Remaining**: data retention policy (auto-delete WPs older than N days) not yet implemented. Can be added as a built-in job in `src/lib/cron/index.ts`.

**Links**: [REQ_Cron.md](SPECS/REQ_Cron.md), D-030

---

### OI-055 | Sticky Time Headers on Flight Board

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Time header scrolls out of view during horizontal pan on the Gantt. Keep time axis visible during scroll. **Challenge**: ECharts uses canvas — CSS `position: sticky` won't work. Likely requires custom container wrapper or ECharts gridIndex positioning.

**Files**: `src/components/flight-board/flight-board-chart.tsx`

---

### OI-056 | Shift Highlighting with Visual Time Separators

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Render subtle background sections for Day (07–15) / Swing (15–23) / Night (23–07) shifts on the Gantt. ECharts `markArea` for background fill + `markLine` for boundaries. Optional shift name labels. Shift times from `server.config.yml`.

**Files**: `src/components/flight-board/flight-board-chart.tsx`, `src/lib/config/loader.ts`

---

### OI-057 | Integrate react-to-print for Print/Export

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-20 |

Add print/export to Flight Board, Capacity, and Analytics. `react-to-print` uses browser native print dialog (local-first, simple hook API, reuses existing CSS). Add "Print" buttons per page; hide UI chrome with `@media print`.

**Steps**: Install `react-to-print` → print wrappers per page (`FlightBoardPrint`, `CapacityReportPrint`, `AnalyticsDashboardPrint`) → `@media print` CSS → test PDF save in Chrome/Safari.

**Files**: `src/components/flight-board/`, `src/components/capacity/`, `src/components/dashboard/`

---

### OI-038 | Interactive Fuzzy Match Resolution

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |

Aircraft/customer imports with <70% confidence auto-rejected with no UI to confirm/override (e.g., "Singapore" → "Singapore Airlines" at 22%). Admin import validation step should show a mapping table with dropdowns per row — accept/skip/override. Also: CSV export shows operator FK IDs instead of human-readable names.

**Workarounds**: Lower threshold; add substring detection boost; pre-clean import data.

**Files**: `src/lib/utils/fuzzy-match.ts`, `src/lib/data/aircraft-import-utils.ts`
**Links**: [REQ_DataImport.md](SPECS/REQ_DataImport.md)

---

### OI-040 | System Settings Configuration File

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Updated** — partially complete |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |

Timeline defaults migrated to `server.config.yml` ✅. **Remaining**: `ingestRateLimitSeconds`, `ingestMaxSizeMB`, `allowedHostnames`, `masterDataConformityMode` still in `app_config` DB — migrate to `server.config.yml` as file-based settings.

**Links**: `src/lib/config/loader.ts`, `server.config.yml`, OI-048, OI-049

---

### OI-048 | Rate Limiting as System Preference

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Move `ingestRateLimitSeconds` + `ingestMaxSizeMB` from `app_config` DB to `server.config.yml`. Expose in Admin Settings under API Integration section.

**Related**: OI-040
**Files**: `server.config.yml`, `src/lib/config/loader.ts`, admin settings page

---

### OI-049 | Admin Settings Tab Layout Redesign

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Admin Settings mixes DB-stored preferences with file-based system config under inconsistent save patterns. Split into two distinct sections: **System Configuration** (server.config.yml — requires restart) and **Database Preferences** (auto-save). Add visual distinction between the two.

**Files**: `src/app/(authenticated)/admin/settings/page.tsx`, `src/components/admin/server-tab.tsx`
**Related**: OI-040

---

### OI-050 | AOG Aircraft Condition & Visual Tracking

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Track AOG (Aircraft on Ground — unscheduled maintenance) separately from canceled flights. Needs discovery on data source (WP JSON? admin-entered? inferred from status?). Visual treatment on flight board similar to canceled (D-034). Future: dedicated AOG analytics.

**Files**: `src/lib/db/schema.ts`, `flight-board-chart.tsx`, `reader.ts`
**Links**: D-034

---

### OI-080 | Shift Matrix Definition Missing Effective End Date

| Field | Value |
|-------|-------|
| **Type** | Feature Request |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-26 |

Shift definitions have no end date — impossible to sunset or replace over time. Add nullable `effectiveEndDate` field; query logic excludes expired shifts.

**Acceptance Criteria**: (1) Schema has `effectiveEndDate` (nullable). (2) Admin UI allows setting end date. (3) Query excludes `effectiveEndDate < today`. (4) Migration created.

**Files**: `src/lib/db/schema.ts`, `src/components/admin/capacity/shifts-editor.tsx`

---

## Backlog

### OI-046 | Customer SP ID in Work Packages

| Field | Value |
|-------|-------|
| **Type** | Limitation / Stub |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-17 |

`work_packages.customer_sp_id` is a stub (D-033). WP JSON only provides `Customer` name — no SP ID. After master data import populates `customers.sp_id`, add post-import backfill:
```sql
UPDATE work_packages SET customer_sp_id = (SELECT sp_id FROM customers WHERE name = work_packages.customer) WHERE customer_sp_id IS NULL
```
**Links**: D-033

---

### OI-051 | iPad Quick Info Panel (Long Press / Tap)

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-18 |

On iPad, tapping a flight bar should show a fixed floating info card (not hover tooltip or full-screen drawer). Tap elsewhere to dismiss. Use Radix Popover anchored to the ECharts element.

**Files**: `flight-detail-drawer.tsx`, `flight-board-chart.tsx`

---

### OI-059 | Time/Date Indicator Needs Better Display Area

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-18 |

Active filter pills are the wrong area for date/timezone context. Consider: subtitle under page title (`Dashboard · Feb 18–21 · Eastern`), muted badge near date pickers, or breadcrumb-style context strip.

**Files**: `src/components/shared/top-menu-bar.tsx`

---

### OI-066 | Capacity Dev Overview — Temporary Debug Tool

| Field | Value |
|-------|-------|
| **Type** | Temporary |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-22 |

Admin-only debug page at `/admin/capacity/dev-overview` — shows capacity pipeline intermediate values (headcount, MH formulas, overlays, per-day WP attribution). Remove when capacity model is production-stable (~4–8 weeks).

**Removal**: Delete `dev-overview/` folder + remove hub card from `capacity/page.tsx`. Zero residual impact.

---

### OI-067 | Weekly MH Projections — TEMPORARY FIXTURE

| Field | Value |
|-------|-------|
| **Type** | Temporary |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-22 |

Customer MH target matrix (7 customers × 7 days × 3 shifts) as pink overlay on Forecast Pattern Chart. Self-contained `weekly_mh_projections` table (no FKs for easy removal). Remove when replaced by a proper forecasting pipeline.

**Removal checklist**: Delete 7 new files (`projection-engine.ts`, `projection-data.ts`, API routes, page, grid, test) → revert chart toggle + hub card + barrel changes → add `DROP TABLE weekly_mh_projections` migration. M018 stays (append-only).

---

## Acknowledged / Informational

| OI | Title | Notes |
|----|-------|-------|
| OI-006 | CargoJet HAR — No Auth Tokens | Session-based auth not captured. No action for v0; revisit if live API integration is attempted. |
| OI-007 | Pagination Not in HAR | No pagination in 86-record dataset. Revisit if data exceeds 500 records. |

---

## Summary

| Priority | Open | Partial | In Progress | Acknowledged | Resolved |
|----------|------|---------|-------------|-------------|----------|
| P0 | 0 | 0 | 0 | 0 | 16 |
| P1 | 4 | 2 | 0 | 0 | 20 |
| P2 | 10 | 2 | 0 | 0 | 20 |
| P3 | 4 | 0 | 0 | 2 | 5 |
| **Total** | **18** | **4** | **0** | **2** | **61** |

**Latest update (2026-02-26)**: Phase 4 Mobile-First UX complete — 5 workstreams (P4-1 through P4-5). PWA manifest, collapsible sidebar, bottom tab bar, flight board list view, mobile polish pass. 646 tests passing.

---

## Archived — Resolved Items

> Compressed summaries. Full context was preserved in git history (pre-2026-02-26 OPEN_ITEMS.md).

### Foundation Decisions (OI-001–OI-021)

| OI | Title | Resolution | Decision | Date |
|----|-------|------------|----------|------|
| OI-001 | SVAR Gantt Package Name | Replaced entirely by Apache ECharts | D-008 | 2026-02-13 |
| OI-002 | SVAR Gantt MIT Limitations | ECharts provides all features natively; SVAR had Next.js 15 scroll freeze | D-008 | 2026-02-13 |
| OI-003 | Aircraft Type Normalization | Wildcard patterns in seed data; all 57 aircraft resolve correctly | D-015 | 2026-02-14 |
| OI-004 | Data Import Mechanism | File upload + paste-JSON (D-016); `/api/ingest` POST with Bearer auth (D-026) | D-016, D-026 | 2026-02-13 |
| OI-005 | Additional Timezone Options | UTC + America/New_York only in UI; all IANA supported internally | D-014 | 2026-02-13 |
| OI-008 | Manual MH Override Storage | SQLite `mh_overrides` table keyed by WP ID (D-013); survives re-imports | D-013 | 2026-02-13 |
| OI-009 | Shift Schedule Customization | MVP: headcount only; shift time editing deferred to vNext | — | 2026-02-13 |
| OI-010 | Flight Board Row Grouping | One row per registration (D-012) | D-012 | 2026-02-13 |
| OI-011 | Auth.js v5 Beta Stability | Proceed with pinned v5; tested in M1.5 | — | 2026-02-13 |
| OI-012 | Drizzle + better-sqlite3 Compat | `serverComponentsExternalPackages: ['better-sqlite3']` in next.config | — | 2026-02-13 |
| OI-013 | vNext Feature Stubs Scope | Passkeys/2FA/Sessions as "Coming Soon" cards on Account > Security | — | 2026-02-13 |
| OI-014 | Analytics Event Retention | 365-day retention | — | 2026-02-13 |
| OI-015 | Operator Performance Priority | Ships with M3; click-to-focus cross-filtering | — | 2026-02-13 |
| OI-016 | Materialized KPI Views | On-the-fly at current scale; revisit at 500+ records / >200ms | — | 2026-02-13 |
| OI-017 | Event Tracking Batching | Immediate writes (one POST per event) | — | 2026-02-13 |
| OI-018 | Change Password v1 vs Stub | Change Password stays v1 functional | D-021 | 2026-02-13 |
| OI-019 | Operator KPIs Limited by Data | Available-data KPIs only; aspirational marked [Future] in REQ_Analytics.md | — | 2026-02-13 |
| OI-020 | Dashboard Gantt Duplication | No duplication — Gantt on `/flight-board` only | D-023 | 2026-02-13 |
| OI-021 | Theme CSS Size (11 Presets × 2) | All 22 sets enabled; <5KB CSS | D-022 | 2026-02-13 |

### Milestones (OI-022–OI-030)

| OI | Title | Summary | Date |
|----|-------|---------|------|
| OI-022 | M1 Complete | Data layer, reader, transformer, 6 API routes | 2026-02-13 |
| OI-023 | M2 Complete | FilterBar, Zustand stores, Flight Board Gantt | 2026-02-13 |
| OI-024 | M3 Complete | Statistics Dashboard, KPI cards, Operator Performance | 2026-02-13 |
| OI-025 | M4 Complete | Capacity Modeling page, utilization chart, detail table, CSV export | 2026-02-14 |
| OI-026 | M5 Complete | Account page, Settings, 11 Fumadocs theme presets | 2026-02-14 |
| OI-027 | M6 Complete | Admin Core: Customer color editor, User CRUD, Admin settings | 2026-02-14 |
| OI-028 | M7 Complete | Aircraft Type editor, Data Import with validate→preview→confirm | 2026-02-14 |
| OI-029 | M8 Complete | Admin Analytics dashboard, mobile nav, mobile FilterBar sheet | 2026-02-14 |
| OI-030 | Project Steward Skill | `PROJECT_STEWARD.md`, `AUTO_COMMIT_POLICY.md`, `phase_commit.sh` | 2026-02-14 |

### Post-MVP Fixes & Features

| OI | Title | Resolution | Date |
|----|-------|------------|------|
| OI-031 | Dashboard Chart Time Responsiveness | `timezone` prop, day separator ReferenceLine, midnight date labels | 2026-02-14 |
| OI-032 | Flight Board Time Filtering / xAxis Error | Overlap detection for date range filter; xAxis init safety checks | 2026-02-15 |
| OI-033 | Flight Board Time Axis Alignment | Filter-based midnights; clean interval ticks (00:00, 06:00…) | 2026-02-15 |
| OI-034 | HTTP Ingest Endpoint | `/api/ingest` POST, Bearer auth, rate limiting, idempotency (D-026) | 2026-02-15 |
| OI-035 | Event Data Reset Tool | `npm run db:event-reset`, admin API + UI with timestamped backup | 2026-02-15 |
| OI-036 | Master Data Import System | 5 tables, 12 API endpoints, fuzzy matching (70%), admin UI | 2026-02-15 |
| OI-037 | Configurable Allowed Hostnames | `trustHost`, hostname registry in app_config, admin UI (D-027) | 2026-02-16 |
| OI-039 | Master Data Imports Not in History | Unified import history with `data_type` column + type filter (v0.2.0) | 2026-02-19 |
| OI-041* | Collapsible Sidebar v1 | **Superseded by OI-075** (Phase 4 P4-1) | — |
| OI-045 | Canceled WP Visual Treatment | `flights.hideCanceled` system pref; admin toggle writes to server.config.yml (D-034) | 2026-02-18 |
| OI-052* | Flight Board Gantt vs List | **Superseded by OI-077** (Phase 4 P4-3) | — |
| OI-054* | Collapsible Sidebar v2 | **Superseded by OI-075** (Phase 4 P4-1) | — |
| OI-057b | System Pref Filters Shown as Active | Removed default date chip; tz chip compares against system default | 2026-02-18 |
| OI-058 | Bootstrap + Self-Registration + Invite Codes | `instrumentation.ts` bootstrap, `/register`, `invite_codes` table (D-035) | 2026-02-18 |
| OI-060 | baseUrl / AUTH_URL Normalization | `BASE_URL` env + `app.baseUrl` YAML; `AUTH_URL` internal only (D-037) | 2026-02-19 |
| OI-061 | System User (system@internal) Read-Only | Filter SYSTEM_AUTH_ID from users API; 403 on edit/delete routes | 2026-02-19 |
| OI-062 | Superuser Self-Service Account | Profile form editable; JWT refreshes displayName/email from DB | 2026-02-19 |
| OI-063 | User Data Not Populated in Admin Edit | `useEffect` sync in `user-form.tsx` on `open` + `initialData` change | 2026-02-19 |
| OI-064 | Universal Import Hub Post-Bugs | 17 fixes: 6 showstoppers, 2 regressions, 8 code review, 1 validation gap | 2026-02-20 |
| OI-065 | Contract MH Pipeline (Phase 3) | 4-level chain, `"contract"` MHSource, `loadContractMap()` cache, priority field (M019, D-052) | 2026-02-25 |
| OI-068 | Capacity Enhancements E-01–E-04 | Rolling forecast, scenario toggle (+10%), gap analysis, UI integration (D-050); 36 tests | 2026-02-24 |
| OI-069 | Capacity Enhancements E-05–E-06 | `ComputeModeBadge`; today reference line + future `ReferenceArea` shading | 2026-02-24 |
| OI-070 | G-01: Decouple Aggregation | `AggregationToggle`; any lens × any aggregation mode | 2026-02-24 |
| OI-071 | G-07: Cross-Lens Comparison | `CompareSelector` + secondary overlays + KPI delta card + CSV column | 2026-02-25 |
| OI-072 | G-09: Monthly Roll-Up Aggregation | `monthly-rollup-engine.ts`, `MonthlyRollupChart` (4 view modes), 16 tests | 2026-02-25 |
| OI-073 | G-10: Per-Customer Event Attribution | `event-attribution-engine.ts`, top-3 customer KPI strip, 17 tests | 2026-02-24 |
| OI-082 | Staffing-Derived Shift Routing | Replaced static `operatingDays` with `deriveNonOperatingFromStaffing()` — staffing map drives shift existence. M021 drops column. 17 new tests. | 2026-02-26 |

### Phase 4 — Mobile-First UX (2026-02-26)

| OI | Title | Resolution | Date |
|----|-------|------------|------|
| OI-053 | PWA Manifest (P4-4) | `site.webmanifest`, 5 icon sizes (192/512 + maskable + apple-touch), `viewport-fit: cover`, theme-color media queries, iOS meta tags | 2026-02-26 |
| OI-075 | Collapsible Sidebar + Bottom Tab Bar (P4-1) | 4-tier nav (D-053): bottom tab `< sm`, hamburger `sm–md`, collapsible sidebar `md–lg`, expanded `lg+`. Zustand + localStorage. `use-sidebar.ts`, `bottom-tab-bar.tsx`, `sidebar-hydrator.tsx` | 2026-02-26 |
| OI-076 | Mobile Touch Targets (P4-2) | Theme toggle `h-11 w-11 md:h-9 md:w-9`, user menu `h-11 md:h-9`. Hamburger `hidden sm:block md:hidden` | 2026-02-26 |
| OI-077 | Flight Board List View (P4-3) | Gantt/List toggle, `flight-board-list-cards.tsx` (mobile), `flight-board-list-table.tsx` (TanStack, desktop). localStorage persistence. D-054, D-056 | 2026-02-26 |
| OI-078 | Mobile Polish Pass (P4-5) | `overflow-x-auto` on 5 admin grids + 1 user table. Pie charts responsive `grid-cols-1 md:grid-cols-3`. Heatmap legend `hidden md:flex`. `h-dvh` layout | 2026-02-26 |

*\* Superseded — planned work reorganized into Phase 4 items.*
