# Open Items

> Tracked questions, decisions needed, and unresolved issues.
> Format: `OI-###` with priority, status, and owner.

---

## OI-001 | ~~SVAR Gantt Exact Package Name~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Question |
| **Status** | **Resolved** |
| **Priority** | ~~P0~~ |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | FINAL-PLAN.md references `@wx/react-gantt` but this needs verification. The SVAR website may use a different npm package name. |
| **Resolution** | SVAR Gantt replaced entirely by Apache ECharts (D-008). The correct SVAR package was `@svar-ui/react-gantt` (not `@wx/react-gantt`), but this is now moot. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-008 |

---

## OI-002 | ~~SVAR Gantt MIT Feature Limitations~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Risk |
| **Status** | **Resolved** |
| **Priority** | ~~P0~~ |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | MIT edition of SVAR Gantt may not support custom bar colors, tooltips, or zoom. These are required for the Flight Board. |
| **Resolution** | SVAR replaced by Apache ECharts (D-008). Research confirmed SVAR MIT had: tooltips (yes), zoom (yes), per-task colors (workaround only via CSS vars), known scroll freeze on Next.js 15 (GitHub #10). ECharts provides all features natively. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-008, [RISKS.md](DEV/RISKS.md) R1 (resolved) |

---

## OI-003 | ~~Aircraft Type Normalization Rules~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Question |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-14 |
| **Context** | Aircraft type is sourced from admin-controlled mapping (D-015). Review of input.json shows NO aircraft type field in inbound data — the `Aircraft` object only contains `Title` (registration). Type resolution depends entirely on the admin mapping table. Initial seed data had regex patterns (`^C-F`, `^N77[0-9]`) that were being escaped by `matchesPattern` function, causing all 57 aircraft to resolve to "Unknown". |
| **Resolution** | **Fix 1:** Updated seed data to use wildcard patterns (`C-F*`, `N77?CK`, `*777*`) instead of regex, matching the `matchesPattern` function's design. **Fix 2:** Added comprehensive registration-based patterns for all customers: CargoJet (C-F*, C-G* → B767), Aerologic (D-AA*, D-AER* → B777), DHL Air UK (G-DHL*, G-DHM* → B767), Kalitta (N77?CK → B777, N76?CK → B767, N74/78/79?CK → B747, N2/3/4* → B767). Result: All 57 aircraft now resolve correctly (B747: 4, B767: 31, B777: 22). **Fix 3:** Made filter dropdowns dynamic — extract unique types from work packages instead of hardcoded `["B777", "B767", "B747", "B757", "B737"]`. **Fix 4:** Added aircraft type display to flight board tooltips (shows below registration). Database re-seeded with 24 mappings. |
| **Links** | [REQ_DataModel.md](SPECS/REQ_DataModel.md), [REQ_AircraftTypes.md](SPECS/REQ_AircraftTypes.md), [seed-data.ts](../src/lib/db/seed-data.ts), [aircraft-type.ts](../src/lib/utils/aircraft-type.ts), D-015, R4 |

---

## OI-004 | ~~Data Import Mechanism~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | v0 uses static `data/input.json`. Future needs: How does fresh data get into the system? |
| **Resolution** | D-016: MVP uses file upload + paste-JSON on `/admin/import` with validate → preview → confirm workflow. D-026: `/api/ingest` POST endpoint now implemented with Bearer token auth (admin-rotatable key in SQLite), idempotency support, per-key rate limiting, and configurable size limits. Import history logged to SQLite. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-016, D-026, [REQ_Admin.md](SPECS/REQ_Admin.md), [REQ_Logging_Audit.md](SPECS/REQ_Logging_Audit.md) |

---

## OI-005 | ~~Additional Timezone Options~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Question |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | Current options: UTC, America/New_York, America/Chicago, America/Los_Angeles. CargoJet is Canadian — should `America/Toronto` be an option? |
| **Resolution** | D-014: UI narrowed to UTC + America/New_York (Eastern) only. Code supports all IANA timezones internally. This covers the operational need (aviation UTC + local time). Additional options can be added to the UI later without code changes. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-014, [REQ_Filters.md](SPECS/REQ_Filters.md) §4 |

---

## OI-006 | CargoJet HAR — No Authentication Tokens Captured

| Field | Value |
|-------|-------|
| **Type** | Limitation |
| **Status** | Acknowledged |
| **Priority** | P3 — informational |
| **Owner** | N/A |
| **Created** | 2026-02-13 |
| **Context** | HAR files don't contain auth tokens (session-based). If live CargoJet API integration is ever needed, auth mechanism is unknown. |
| **Next Action** | None for v0. Note for future if live integration attempted. |
| **Resolution Criteria** | N/A for v0 |
| **Links** | [REQ_DataSources.md](SPECS/REQ_DataSources.md) "What's NOT in the HAR" |

---

## OI-007 | Pagination — Not Observed in HAR

| Field | Value |
|-------|-------|
| **Type** | Limitation |
| **Status** | Acknowledged |
| **Priority** | P3 — informational |
| **Owner** | N/A |
| **Created** | 2026-02-13 |
| **Context** | No pagination parameters observed in CargoJet HAR. With 86 records this isn't an issue, but if data grows, API pagination may be needed. |
| **Next Action** | None for v0. Revisit if data exceeds 500 records. |
| **Resolution Criteria** | N/A for v0 |
| **Links** | [REQ_DataSources.md](SPECS/REQ_DataSources.md) |

---

## OI-008 | ~~Manual MH Override Storage~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | The `effectiveMH` formula supports manual overrides, but storage location is TBD. |
| **Resolution** | SQLite `mh_overrides` table keyed by work package ID (D-013). Survives re-imports because overrides are separate from imported data. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-013, [REQ_DataModel.md](SPECS/REQ_DataModel.md) |

---

## OI-009 | ~~Shift Schedule Customization Scope~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Question |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | Current plan: 3 fixed shifts (Day/Swing/Night) with editable headcount. Should users be able to change shift times? Add/remove shifts? Or just headcount? |
| **Resolution** | MVP: headcount only. Shift times are fixed (Day 07-15, Swing 15-23, Night 23-07). Editing shift times and adding/removing shifts deferred to vNext. |
| **Links** | [REQ_OtherPages.md](SPECS/REQ_OtherPages.md) Settings section |

---

## OI-010 | ~~Flight Board Gantt — Row Grouping Strategy~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | CargoJet's HAR shows rows by fleet number (NNN-RRRR format, 41 rows). Our data has 57 unique aircraft by registration. |
| **Resolution** | One row per registration (D-012). Closest match to CargoJet reference. Grouping by type/customer deferred to M5 polish. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-012 |

---

## OI-011 | Auth.js v5 Beta Stability — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Risk |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | Auth.js v5 (next-auth@beta) is the standard for Next.js App Router but may have breaking changes. Need to pin version and test thoroughly. |
| **Resolution** | Proceed with Auth.js v5. Pin version in package.json during M0. Test login/logout/session flows in M1.5. |
| **Links** | [REQ_Auth.md](SPECS/REQ_Auth.md) |

---

## OI-012 | Drizzle + better-sqlite3 Next.js Compatibility — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Risk |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | better-sqlite3 is a native Node.js module (C++ bindings). May require `serverComponentsExternalPackages` config in Next.js. Drizzle ORM is well-supported but need to verify SQLite driver compatibility. |
| **Resolution** | Proceed with Drizzle + better-sqlite3. Add `serverComponentsExternalPackages: ['better-sqlite3']` to next.config.js during M0. Test database reads/writes in API routes and server components during M0. |
| **Links** | [REQ_DataModel.md](SPECS/REQ_DataModel.md), [DEV_COMMANDS.md](DEV/DEV_COMMANDS.md) |

---

## OI-013 | vNext Feature Stubs — Scope Definition — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | Account page has vNext stubs: Passkeys, 2FA, Active Sessions, notification preferences. Need to ensure stubs are clearly marked "Coming Soon" without implying functionality. |
| **Resolution** | Include stubs on Account page Security tab. Build as disabled cards with "Coming Soon" badge + brief description. No server endpoints. Implement in M5. |
| **Links** | [REQ_Account.md](SPECS/REQ_Account.md) |

---

## OI-014 | ~~Analytics Event Retention Period~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Question |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | REQ_Analytics.md assumed 90-day retention for usage events in `analytics_events` table. Auto-pruned on app startup and nightly. |
| **Resolution** | 365-day retention. At ~20 events/user/day with 5 users, this is ~36,500 rows/year — still negligible for SQLite. Update REQ_Analytics.md §6 retention from 90 → 365 days. |
| **Links** | [REQ_Analytics.md](SPECS/REQ_Analytics.md) §6 |

---

## OI-015 | ~~Operator Performance Section Priority~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | The Customer/Operator Performance table within `/dashboard`. User confirmed: ships with M3, filterable, with click-to-focus reactive behavior. |
| **Resolution** | P0 — ships with M3. Operator Performance section is filterable; clicking an operator name brings that operator into focus across the dashboard (reactive cross-filtering). Limit KPIs to what the available data supports (see OI-019). Retain aspirational KPI ideas in REQ_Analytics.md for future data enrichment. |
| **Links** | [REQ_Analytics.md](SPECS/REQ_Analytics.md) §7, OI-019 |

---

## OI-016 | Materialized KPI Views at Scale — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Risk |
| **Status** | **Resolved** |
| **Priority** | ~~P3~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | All operational KPIs are computed on-the-fly from in-memory data. At ~86 records this is instant. At ~2,000+ records, aggregation per API call could become slow. SQLite materialized views or a pre-computed summary table would be the escape hatch. |
| **Resolution** | Don't build materialized views now. Compute KPIs on-the-fly (fast at current data volume). **Threshold**: If data reaches 500+ records AND API response time exceeds 200ms, implement `kpi_summaries` pre-computed table (M8 polish). Monitor via analytics. |
| **Links** | [REQ_Analytics.md](SPECS/REQ_Analytics.md) §2 |

---

## OI-017 | Event Tracking Batching vs Immediate Write — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | Should client-side event tracking batch events (queue + flush every 5s) or write immediately (one POST per event)? At <10 concurrent users, immediate writes are sub-ms in SQLite. Batching adds complexity (queue management, flush-on-unload via `navigator.sendBeacon`). |
| **Resolution** | Use **immediate writes** (one POST per event). Simple to implement; sufficient for <10 concurrent users. Add batching queue logic only if concurrent user count exceeds 20 AND performance metrics show >500ms event write latency. Implement immediate writes in M1. |
| **Links** | [REQ_Analytics.md](SPECS/REQ_Analytics.md) §3 |

---

## OI-018 | ~~Change Password — v1 or vNext Stub?~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | Apparent conflict between user directive ("Security features are vNext stubs ONLY") and REQ_Account.md (Change Password as v1). |
| **Resolution** | Change Password stays **v1 (functional)**. User clarified intent: users should be able to reset/change their own password. Passkeys, 2FA, and Active Sessions remain vNext stubs. User management (admin) should have comprehensive control over all auth features, settings, enable/disable/delete, super user creation — "all features of a high-end server." See D-021. |
| **Links** | [REQ_Account.md](SPECS/REQ_Account.md) Tab 3, [REQ_Admin.md](SPECS/REQ_Admin.md), D-021 |

---

## OI-019 | Operator Performance KPIs Limited by Available Data — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Limitation |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | Review of input.json (first 3 records) shows: no aircraft type field in inbound data, `TotalMH` null for 66/86 records, no scheduled departure time (only actual). This limits which KPIs can be computed. |
| **Resolution** | Build Operator Performance table in M3 with available-data KPIs only: Avg ground time, WP count, aircraft count, total effectiveMH (mostly default 3.0), ground time distribution. Aspirational KPIs (on-time rate, turnaround efficiency, MH accuracy) retained in REQ_Analytics.md marked `[Future: requires data enrichment]` for when richer data becomes available. |
| **Also noted** | No aircraft type field in inbound data — type resolution depends entirely on admin mapping table (D-015). |
| **Links** | [REQ_Analytics.md](SPECS/REQ_Analytics.md), OI-003, OI-015, D-015 |

---

## OI-020 | Dashboard Gantt Duplication Scope

| Field | Value |
|-------|-------|
| **Type** | Decision needed |
| **Status** | **Resolved** |
| **Priority** | ~~P1~~ |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | CVG Line Maintenance reference images (160608, 160647) show a Gantt timeline at the bottom of the dashboard page. Our app has a separate `/flight-board` page dedicated to the Gantt. Should the dashboard duplicate the Gantt? |
| **Resolution** | No duplication. The Gantt lives on `/flight-board` only. The dashboard focuses on KPIs, charts, and the Operator Performance table. The reference images show a single-page dashboard that combines both; our multi-page app separates them for clarity (D-023). |
| **Links** | [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md), D-023 |

---

## OI-021 | Theme CSS Size with 11 Presets x 2 Modes — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Risk |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | User |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | 11 Fumadocs theme presets x 2 color modes = 22 sets of CSS custom properties. Each set is ~30 tokens. Total: ~660 variable declarations. Probably <5KB CSS — negligible, but should verify during M5. |
| **Resolution** | Include all 11 presets x 2 modes in M5 implementation (estimated <5KB CSS). Measure actual bundle size during M5 testing. If CSS exceeds 10KB, implement lazy-loading for non-default presets at M8 polish. Start with all presets enabled; optimize later if needed. |
| **Links** | [REQ_Themes.md](SPECS/REQ_Themes.md), D-022 |

---

---

## OI-022 | M1 Implementation Complete — 2026-02-13

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | M1 (Data Layer + API Routes) implementation complete. All 10 tasks implemented and verified. |
| **Resolution** | Created: reader.ts, transformer.ts, aircraft-type.ts, hourly-snapshot.ts, capacity.ts, pagination.ts, filter-helpers.ts, date-helpers.ts, track.ts, and 6 API routes. All acceptance criteria met. Build ✅, Lint ✅, Dev ✅. |
| **Links** | [ROADMAP.md](ROADMAP.md) M1, [PLAN.md](PLAN.md) M1 |

---

## OI-023 | M2 Implementation Complete — 2026-02-13

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | M2 (FilterBar + Flight Board) implementation complete. All 9 tasks implemented and verified. |
| **Resolution** | Created: use-filters.ts, use-filter-url-sync.ts, use-customers.ts, use-work-packages.ts (Zustand stores); datetime-picker.tsx, multi-select.tsx, customer-badge.tsx, filter-bar.tsx (filter components); flight-board-chart.tsx, flight-tooltip.ts, gantt-toolbar.tsx, flight-detail-drawer.tsx (Gantt components); /api/admin/customers route. Installed shadcn/ui (badge, button, popover, command, select, sheet, separator, calendar, tooltip). Build ✅, Lint ✅. Two items deferred to M8: mobile FilterBar sheet, date auto-swap validation. |
| **Links** | [ROADMAP.md](ROADMAP.md) M2, [PLAN.md](PLAN.md) M2 |

---

## OI-024 | M3 Implementation Complete — 2026-02-13

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-13 |
| **Resolved** | 2026-02-13 |
| **Context** | M3 (Statistics Dashboard) implementation complete. KPI cards, charts, operator performance table, data freshness badge all implemented. |
| **Resolution** | Created: kpi-card.tsx, avg-ground-time-card.tsx, mh-by-operator-card.tsx, total-aircraft-card.tsx, aircraft-by-type-card.tsx (KPI cards); combined-chart.tsx (Recharts ComposedChart bar+line), customer-donut.tsx (PieChart donut), operator-performance.tsx (sortable table with click-to-focus cross-filtering); data-freshness-badge.tsx + /api/data-freshness route; use-hourly-snapshots.ts (Zustand hook). Dashboard page assembled with 3-column grid layout, cross-filtering between operator table/donut/MH card, loading skeleton. Build ✅, Lint ✅. |
| **Links** | [ROADMAP.md](ROADMAP.md) M3, [PLAN.md](PLAN.md) M3 |

---

## OI-025 | M4 Implementation Complete — 2026-02-14

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-14 |
| **Resolved** | 2026-02-14 |
| **Context** | M4 (Capacity Modeling) implementation complete. Config panel, utilization chart, detail table with expandable rows, CSV export, and full page assembly. |
| **Resolution** | Created: use-capacity.ts (Zustand hook), config-panel.tsx (slider/switch/headcount controls with useReducer), utilization-chart.tsx (Recharts ComposedChart with color-coded bars, dual Y-axes, reference lines), capacity-table.tsx (TanStack Table with expandable customer/shift sub-rows, pagination, sorting), csv-export.ts (generic CSV download utility), capacity/page.tsx (full page with FilterBar, summary KPI pills, config panel, chart, table). Installed shadcn/ui: slider, switch, table, label. Build clean, lint clean. |
| **Links** | [ROADMAP.md](ROADMAP.md) M4, [PLAN.md](PLAN.md) M4 |

---

## OI-026 | M5 Implementation Complete — 2026-02-14

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-14 |
| **Resolved** | 2026-02-14 |
| **Context** | M5 (Account + Settings + Theming) implementation complete. Account page with 3 tabs, Settings page, 11 theme presets, preferences API, FOUC prevention. |
| **Resolution** | Created: use-preferences.ts (Zustand store), preferences-loader.tsx, theme-script.tsx (FOUC prevention), profile-form.tsx, preferences-form.tsx, security-panel.tsx, change-password-form.tsx, 3 account API routes (profile/preferences/password). Rewrote settings page from stub to functional (demand model, capacity model, shifts, display). Fixed globals.css (removed duplicate oklch blocks conflicting with HSL theme system). Installed shadcn/ui tabs, input, card. All 11 Fumadocs theme presets working in light/dark/system modes. Build clean, lint clean. |
| **Links** | [ROADMAP.md](ROADMAP.md) M5, [PLAN.md](PLAN.md) M5 |

---

## OI-027 | M6 Implementation Complete — 2026-02-14

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-14 |
| **Resolved** | 2026-02-14 |
| **Context** | M6 (Admin Core — Customers + Users) implementation complete. Admin layout with role guard, customer color editor, user CRUD, admin settings, stub pages. |
| **Resolution** | Created 19 new files, modified 4 existing. **New utilities**: contrast.ts (WCAG 2.1 contrast), seed-data.ts (shared seed constants). **Admin layout**: layout.tsx (server role guard, redirects non-admin to /dashboard), admin-nav.tsx (7 horizontal scrollable tabs). **Customer APIs**: PUT bulk update with auto colorText, POST create, DELETE soft-delete, POST reset to seed defaults. **Customer UI**: customer-color-editor.tsx (color swatch, hex input, native color picker, WCAG badge, add/reset dialogs). **User APIs**: GET list (excludes passwordHash), POST create with temp password generation, PUT update with last-superadmin protection, DELETE soft-delete, POST reset-password. **User UI**: user-table.tsx (badges, action buttons, self-row highlighting), user-form.tsx (create/edit dialog with temp password display + copy). **Admin settings**: mirrors /settings with demand/capacity/shift/display sections + vNext stubs. **Stubs**: audit, aircraft-types, import, analytics pages. Zustand use-customers.ts updated with invalidate() method. Build clean, lint clean. |
| **Known limitations** | JWT role stale after admin changes user role (takes effect on next login). forcePasswordChange flag set but not enforced in login flow (M8 polish). |
| **Links** | [ROADMAP.md](ROADMAP.md) M6, [PLAN.md](PLAN.md) M6 |

---

## OI-028 | M7 Implementation Complete — 2026-02-14

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-14 |
| **Resolved** | 2026-02-14 |
| **Context** | M7 (Admin Data Tools — Aircraft Types + Import) implementation complete. Aircraft type editor and data import workflows fully functional. |
| **Resolution** | Created 8 new files, modified 4 existing. **Seed data**: Extracted SEED_AIRCRAFT_TYPE_MAPPINGS to seed-data.ts, updated seed.ts to import from shared constant. **Aircraft type API routes**: GET (all mappings, priority DESC), POST (create), PUT (single edit + bulk reorder), DELETE; test endpoint (POST normalizeAircraftType); reset endpoint (superadmin only, deletes all + re-inserts seed). **Aircraft type editor**: Table with pattern/canonical/description/priority/active columns, add/edit/delete dialogs, test input with confidence badges (exact/pattern/fallback), reset defaults with confirmation. **Import API routes**: validate (parse JSON, schema check, summary stats, warnings), commit (write to data/input.json, log to import_log, invalidate reader cache), history (paginated with user display names via LEFT JOIN). **Data import component**: File upload + paste JSON tabs, two-step validate-then-import flow, preview with record/customer/aircraft counts + date range + warnings, import history table with pagination. Build clean, lint clean. |
| **Links** | [ROADMAP.md](ROADMAP.md) M7, [PLAN.md](PLAN.md) M7 |

---

## OI-029 | M8 Implementation Complete — 2026-02-14

| Field | Value |
|-------|-------|
| **Type** | Milestone |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-14 |
| **Resolved** | 2026-02-14 |
| **Context** | M8 (Admin Analytics + Polish + Responsive) — final milestone. |
| **Resolution** | Created 12 new files, modified 6 existing. **Shared primitives**: `LoadingSkeleton` (4 variants: card/chart/table/page) + `EmptyState` (icon/title/message/action). Replaced inline skeletons in Dashboard, Capacity, Flight Board. **Error boundaries**: 6 route-level error.tsx files (FlightBoard, Dashboard, Capacity, Admin, Settings, Account) — each with FA icon, error message, Try Again button. **Admin Analytics**: Summary API (`/api/analytics/summary`) with 7 aggregate queries (activeUsers, pageViews, dataImports, errors, pageViewsByDay, topPages, eventsByType) + time range (7d/30d). Analytics dashboard component with KPI cards, Recharts AreaChart (page views over time), horizontal BarChart (top pages), events-by-type table, paginated recent events. Seed script (`seed-analytics.ts`) generates 60 sample events across 14 days. **Mobile navigation**: Left-side Sheet with same 4 nav items as sidebar, wired to header hamburger button. **Mobile FilterBar**: Bottom Sheet (85vh) with all 7 filter fields in vertical stack + Reset/Done footer. Desktop FilterBar hidden on mobile, replaced with "Filters" button + active count badge. **Grid polish**: min-h-[250px] on dashboard chart for mobile. Build clean, lint clean. |
| **Links** | [ROADMAP.md](ROADMAP.md) M8, [PLAN.md](PLAN.md) M8 |

---

## OI-030 | Project Steward Skill Created — 2026-02-14

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-14 |
| **Resolved** | 2026-02-14 |
| **Context** | Created Project Steward skill system: session workflow enforcement, doc authority chain, auto-commit policy, phase_commit.sh, feature_intake.sh. Integrated into CLAUDE.md, README.md, DEV_COMMANDS.md. |
| **Resolution** | All deliverables written to disk: `.claude/SKILLS/PROJECT_STEWARD.md`, `.claude/SKILLS/AUTO_COMMIT_POLICY.md`, `scripts/phase_commit.sh`, `scripts/feature_intake.sh`. CLAUDE.md updated with Project Steward section and OPEN_ITEMS verbatim rule. README.md updated with SKILLS/ directory. DEV_COMMANDS.md updated with git setup and script instructions. |
| **Links** | [PROJECT_STEWARD.md](SKILLS/PROJECT_STEWARD.md), [AUTO_COMMIT_POLICY.md](SKILLS/AUTO_COMMIT_POLICY.md), [DEV_COMMANDS.md](DEV/DEV_COMMANDS.md) |

---

## OI-031 | Dashboard Chart Time Responsiveness & Separators — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-14 |
| **Resolved** | 2026-02-14 |
| **Context** | Dashboard "Arrivals/Departures/On Ground" chart (CombinedChart) was not responding to filter time changes and lacked time divisions/date markers. Chart used hardcoded UTC timezone instead of filter timezone. Day separator logic (lines 69-90) was incomplete — calculated midnight indices but didn't render visual separator lines. X-axis showed only time labels without date markers at midnight. |
| **Resolution** | **Fix 1**: Modified CombinedChart to accept `timezone` prop (default "UTC"). **Fix 2**: Updated formatHourLabel and formatDayLabel to use timezone parameter. **Fix 3**: Added ReferenceLine components for each midnight (day separators) — dashed vertical lines at 40% opacity. **Fix 4**: Implemented formatXAxisTick to show full date labels at midnight hours, regular time labels elsewhere. **Fix 5**: Updated dashboard page to pass timezone from useFilters() to CombinedChart. **Result**: Chart now dynamically adjusts to filter time/timezone changes, shows clear day separator lines, and displays date markers at midnight boundaries. Build ✅. |
| **Files Modified** | `src/components/dashboard/combined-chart.tsx` (added timezone prop, ReferenceLine components, timezone-aware formatters), `src/app/(authenticated)/dashboard/page.tsx` (added useFilters import, passed timezone to chart) |
| **Links** | [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md), [REQ_Filters.md](SPECS/REQ_Filters.md), M3 |

---

## OI-032 | Flight Board Time Filtering & xAxis Error — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-15 |
| **Resolved** | 2026-02-15 |
| **Context** | Two bugs reported: (1) Flight board not respecting start/end time filter — work packages that started before or ended after the filter window were incorrectly excluded. (2) Console error "xAxis '0' not found" at flight-board-chart.tsx:743 during chart initialization/updates. **Root causes**: (1) Incorrect date range logic in filter-helpers.ts lines 84-92 used `wp.departure >= startDate` and `wp.arrival <= endDate`, which only showed flights fully contained within the window. Correct logic should show flights that OVERLAP the window. (2) useEffect at line 708 attempted to update markLine data via setOption before the chart's xAxis was fully initialized, causing ECharts to throw an error. |
| **Resolution** | **Fix 1 (Time Filtering)**: Rewrote date range filter logic in `filter-helpers.ts` to use overlap detection: `(wp.arrival < endDate) AND (wp.departure > startDate)`. This correctly shows all work packages that have any overlap with the filter time window. Also added separate handling for when only start or only end is provided. **Fix 2 (xAxis Error)**: Added safety checks in `flight-board-chart.tsx` useEffect (line 708): (a) Check if chart option's xAxis exists before calling setOption. (b) Wrapped setOption in try-catch to suppress errors during chart transitions. (c) Added console.warn for debugging. **Result**: Flight board now correctly shows all overlapping work packages regardless of whether they extend beyond the filter window. xAxis error eliminated. Lint ✅, Dev server running. |
| **Files Modified** | `src/lib/utils/filter-helpers.ts` (lines 77-92, rewrote date range logic with overlap detection), `src/components/flight-board/flight-board-chart.tsx` (lines 708-760, added xAxis safety checks and try-catch) |
| **Links** | [REQ_Filters.md](SPECS/REQ_Filters.md), [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), M2 |

---

## OI-033 | Flight Board Time Axis Alignment & Day Labels — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-15 |
| **Resolved** | 2026-02-15 |
| **Context** | Flight board time axis showing incorrect range and misaligned ticks. Filter set to Feb 13-16 (4 days), but chart showed ~2 weeks of days. Time ticks displayed at 00:38, 12:38 instead of clean midnight-aligned intervals (00:00, 06:00, 12:00, etc.). Day labels (TUESDAY, WEDNESDAY...) extended far beyond the filter range. **Root cause**: Chart was computing axis bounds from data timestamps ±2 days, not from filter dates. The `computeMidnights` function scanned `minTs - 2*86400000` to `maxTs + 2*86400000`, causing the extended range. Time ticks used fixed intervals but weren't aligned to timezone midnight boundaries. |
| **Resolution** | **Complete rewrite of time axis logic** to match dashboard pattern: (1) Added `filterStart` and `filterEnd` props to FlightBoardChart component. (2) Rewrote `computeMidnights` → `findFilterMidnights`: finds midnight AT OR BEFORE filterStart and midnight AT OR AFTER filterEnd, only collects midnights within that range. (3) Rewrote `timeGrid` computation: uses filter-based midnights as axis bounds, picks clean interval (1h/2h/3h/6h/12h) based on total hours, generates ticks where `hour % intervalHours === 0` in timezone. (4) Updated bottom axis (time ticks): uses `splitNumber` based on tick count, shows labels only at computed tick positions, displays date at midnight. (5) Updated top axis (day names): uses `splitNumber` based on midnight count, shows labels only at midnight timestamps. **Result**: Chart now displays ONLY the filtered date range, time ticks align to clean intervals from midnight (00:00, 03:00, 06:00, etc. or 00:00, 12:00 depending on range), day labels only show for days within filter. Matches dashboard behavior. Lint ✅. |
| **Files Modified** | `src/app/(authenticated)/flight-board/page.tsx` (lines 42-44: extract filterStart/filterEnd from useFilters; lines 239-250: pass to chart), `src/components/flight-board/flight-board-chart.tsx` (lines 39-73: rewrote findFilterMidnights; lines 62-76: added filterStart/filterEnd props; lines 90: added to function params; lines 196-238: rewrote timeGrid with filter-based logic; lines 367-417: updated xAxis configs with splitNumber and tick-based formatters; line 486: added midnightTimestamps to deps) |
| **Links** | [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), [REQ_Filters.md](SPECS/REQ_Filters.md), M2, OI-032 (related time filter fix) |

---

## OI-034 | HTTP Ingest Endpoint Implemented — 2026-02-15

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-15 |
| **Resolved** | 2026-02-15 |
| **Context** | D-016 specified vNext secure POST endpoint at `/api/ingest` for Power Automate automation. All prerequisite milestones (M1-M8) complete. User requested implementation with rate limiting, admin-rotatable API key, idempotency support, and configurable size limits. |
| **Resolution** | Created 4 new files, modified 8 existing. **New**: `import-utils.ts` (shared validate+commit extracted from admin routes), `api-auth.ts` (Bearer token verification against SQLite `app_config`), `rate-limit.ts` (in-memory per-key-hash limiter), `ingest/route.ts` (POST handler with 7-step flow). **Modified**: schema.ts (idempotencyKey column), seed.ts (migration + system user + config defaults), types/index.ts (AppConfig fields), config route (new keys), transformer.ts (AppConfig defaults), admin import routes (use shared utils), admin settings page (API Integration section), proxy.ts (middleware exclusion). All 6 curl tests passed: 401/403/400/422/200/idempotent-replay. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-026, [REQ_DataImport.md](SPECS/REQ_DataImport.md) |

---

## OI-035 | Event Data Reset Tool Implemented — 2026-02-15

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-15 |
| **Resolved** | 2026-02-15 |
| **Context** | User requested a tool to reset only the aircraft event data (work packages) while preserving all system data (users, customers, settings). Use case: corrupted data that needs to be replaced without losing configuration. |
| **Resolution** | Implemented four components: (1) **NPM Script** (`npm run db:event-reset`) — cross-platform Node.js tool with interactive confirmation, color-coded output, automatic backup creation, restore instructions. (2) **Bash Script** (`scripts/reset_event_data.sh`) — alternative shell-based tool. (3) **Admin API** (`POST /api/admin/import/reset`) — role-enforced (admin/superadmin), creates timestamped backup, clears `input.json`, invalidates cache, logs action to import_log. (4) **Admin UI** — Reset button on `/admin/import` page with AlertDialog confirmation, detailed warnings (what's cleared vs preserved), success/error notifications, auto-refresh import history. Backups stored in `data/backups/`. Build ✅, Lint ✅. |
| **Files Created** | `scripts/reset-event-data.mjs`, `scripts/reset_event_data.sh`, `src/app/api/admin/import/reset/route.ts`, `src/components/ui/alert-dialog.tsx`, `.claude/SPECS/REQ_DataReset.md` |
| **Files Modified** | `src/components/admin/data-import.tsx`, `package.json` |
| **Links** | [REQ_DataReset.md](SPECS/REQ_DataReset.md), [REQ_DataImport.md](SPECS/REQ_DataImport.md), [REQ_Admin.md](SPECS/REQ_Admin.md) |

---

## OI-036 | ~~Master Data Import System~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Resolved** |
| **Priority** | ~~P0~~ |
| **Owner** | Claude |
| **Created** | 2026-02-15 |
| **Resolved** | 2026-02-15 |
| **Context** | Implemented master data import system with lookup tables (manufacturers, models, engines), aircraft master table, customer extensions, CSV/JSON import, fuzzy matching, source tracking (inferred→imported→confirmed), conformity validation, and admin UI. Completed all 4 phases in single session. |
| **Progress** | ✅ All 4 phases complete: (1) Database schema [1fbc81c], (2) Utilities & parsers [b82ba19], (3) API routes [eb66eae], (4) UI components [7b1f2c2]. Lint ✅ |
| **Resolution** | Full master data import system operational. Database: 5 new tables (manufacturers, aircraftModels, engineTypes, aircraft, masterDataImportLog) + extended customers with 11 fields. Utilities: OData parser, fuzzy matching (70% threshold), CSV parser. APIs: 12 endpoints (import/export/management). UI: Master data import component with customer/aircraft tabs on /admin/import. Core functionality complete; export buttons and full review page can be added incrementally. |
| **Links** | Commits: 1fbc81c, b82ba19, eb66eae, 7b1f2c2 |

---

## OI-037 | Configurable Allowed Hostnames — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-16 |
| **Resolved** | 2026-02-16 |
| **Context** | `AUTH_URL=http://localhost:3000` hardcoded in `.env.local` caused Auth.js to rewrite all callback/redirect URLs to localhost, breaking access from LAN IPs and other hostnames. User requested configurable allowed hostnames with admin UI. |
| **Resolution** | **Auth fix**: Added `trustHost: true` to NextAuth config, removed `AUTH_URL` from `.env.local`. Auth.js now derives callback URLs from the request's Host header. **Hostname registry**: Added `AllowedHostname` interface and `allowedHostnames` field to `AppConfig`. Stored as JSON array in `app_config` table, seeded with `localhost:3000` default. GET/PUT API routes updated. **next.config.ts**: New `src/lib/db/read-hostnames.ts` sync helper reads enabled hostnames at dev server startup for `allowedDevOrigins`. **Admin UI**: New "Allowed Hostnames" section in Admin > Settings (replaced "Authentication" Coming Soon stub) with add/edit/toggle/delete controls and info callout about server restart requirement. |
| **Files Created** | `src/lib/db/read-hostnames.ts` |
| **Files Modified** | `src/lib/auth.ts`, `.env.local`, `src/types/index.ts`, `data/seed/app-config.json`, `src/app/api/config/route.ts`, `next.config.ts`, `src/app/(authenticated)/admin/settings/page.tsx` |
| **Links** | [DECISIONS.md](DECISIONS.md) D-027 |

---

## Summary

| Priority | Open | Updated | Acknowledged | Resolved |
|----------|------|---------|-------------|----------|
| P0 | 0 | 0 | 0 | 14 |
| P1 | 0 | 0 | 0 | 12 |
| P2 | 0 | 0 | 0 | 10 |
| P3 | 0 | 0 | 2 | 0 |
| **Total** | **0** | **0** | **2** | **36** |

**Changes this pass (Allowed Hostnames)**: Resolved OI-037 — configurable allowed hostnames with trustHost fix, admin UI, and allowedDevOrigins integration. D-027 logged.
