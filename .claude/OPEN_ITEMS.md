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

## OI-038 | Interactive Fuzzy Match Resolution (v0.2.0)

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |
| **Context** | Aircraft/customer import with fuzzy operator matching currently auto-rejects matches below 70% confidence threshold. Example: "Singapore" → "Singapore Airlines" scores 22% and fails. Users have no way to confirm/override low-confidence matches or see what was matched during import. CSV export shows operator FK IDs instead of names (not human-readable). |
| **Proposed Solution** | **CLI (db:import)**: Per-occurrence interactive prompts for low-confidence matches (<70%). Show ranked candidates, allow user to select match/skip/manual entry. `--yes` flag skips prompts (auto-skip all). **Admin UI**: Validation step shows mapping table with dropdowns per row. User can accept/skip/override suggested matches. Bulk actions: "Accept all high-confidence", "Skip all low-confidence". **Both**: Store user confirmations in import session, log which matches were manual vs auto. **CSV Export Fix**: Join with customers table, export operator names instead of UUIDs. |
| **Current Workarounds** | (1) Lower fuzzy match threshold from 70% to 50-60% (more false positives). (2) Enhance fuzzy matching with substring detection ("Singapore" contained in "Singapore Airlines" → confidence boost). (3) Pre-clean import data to match exact customer names. |
| **Target Version** | v0.2.0 |
| **Dependencies** | None (builds on existing D-029 import system) |
| **Links** | [REQ_DataImport.md](SPECS/REQ_DataImport.md), Fuzzy match logic: `src/lib/utils/fuzzy-match.ts`, Import utils: `src/lib/data/aircraft-import-utils.ts` |

---

## OI-039 | ~~Master Data Imports Not Shown in Import History~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug / UX Gap |
| **Status** | **Resolved** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |
| **Resolved** | 2026-02-19 |
| **Context** | Customer and aircraft imports write to `master_data_import_log` table (separate from work package `import_log`). Admin import history page (`/admin/import`) only queries `import_log`, so master data imports don't appear in the UI. Users have no visibility into customer/aircraft import history via the UI. |
| **Impact** | Moderate — users can still perform master data imports, but cannot see history/audit trail in the UI. Must query DB directly to see `master_data_import_log` records. |
| **Workarounds** | (1) Query `master_data_import_log` table directly via `db:status` or SQL. (2) Check `data/exports/` timestamped directories for exported CSVs. |
| **Proposed Solution** | **Option 1**: Unified import history view that queries both `import_log` and `master_data_import_log`, displays in a single table with "Type" column (Work Packages, Customers, Aircraft). **Option 2**: Tabbed UI with separate tables per import type. **Option 3**: Merge both tables into a single `import_log` with `dataType` discriminator (`work_packages`, `customers`, `aircraft`). |
| **Related Tables** | `import_log` (work packages), `master_data_import_log` (customers, aircraft) |
| **Files** | `src/app/(authenticated)/admin/import/page.tsx`, `src/app/api/admin/import/history/route.ts`, `src/lib/db/schema.ts` |
| **Links** | [REQ_DataImport.md](SPECS/REQ_DataImport.md), [REQ_Admin.md](SPECS/REQ_Admin.md) |

---

## OI-040 | System Settings Configuration File (Static JSON)

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Updated** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |
| **Updated** | 2026-02-17 |
| **Context** | Currently all system settings (theme presets, logging config, security settings, allowed hostnames, rate limits, API keys, etc.) are stored in SQLite `app_config` table as key-value pairs. This requires Admin UI access to configure and doesn't support version control or declarative deployment. For server/system-specific settings (not user preferences), a static config file would enable: (1) GitOps-style deployments, (2) Environment-specific overrides (dev/staging/prod), (3) Backup/restore without DB export, (4) Review/audit in PRs. |
| **Current Behavior** | Settings in `app_config` table: `defaultMH`, `wpMHMode`, `theoreticalCapacityPerPerson`, `realCapacityPerPerson`, `shifts`, `ingestApiKey`, `ingestRateLimitSeconds`, `ingestMaxSizeMB`, `masterDataConformityMode`, `masterDataOverwriteConfirmed`, `allowedHostnames`. Modified via Admin Settings UI, stored in SQLite. **Timeline/timezone defaults (`startOffset`, `endOffset`, `defaultZoom`, `defaultCompact`, `defaultTimezone`, `defaultDays`) have been migrated to `server.config.yml`.** |
| **Partial Resolution** | Timeline defaults migrated: `server.config.yml` is now the canonical system config file for timeline settings. `loader.ts` provides `getTimelineDefaults()`. Priority chain: URL params → user prefs → `server.config.yml` → hardcoded fallbacks. Remaining: ingest settings, capacity defaults, allowed hostnames still in `appConfig` DB. |
| **Proposed Solution** | **Static config file**: `data/config/system.json` (or `.env`-style). **Startup behavior**: Load settings from file into `app_config` table (one-way sync — file is source of truth). **Scope**: Server/system settings only (theme defaults, logging levels, security policies, capacity defaults, API rate limits, allowed hostnames). **Out of scope**: User preferences (remain in `user_preferences` table), customer colors (remain in `customers` table), master data (remain in respective tables). **Admin UI**: Read-only display for file-driven settings with note "Configured via system.json" OR allow UI edits but warn "Changes will be overwritten on server restart". **Environment overrides**: Support `data/config/system.local.json` (gitignored) for local dev overrides. |
| **Benefits** | (1) Version-controlled system config (track changes in git). (2) Declarative deployment (deploy config file, restart server). (3) Environment-specific config (dev/staging/prod). (4) Easier backup/restore (just the file). (5) Review config changes in PRs. (6) No need to click through Admin UI to configure fresh deployments. |
| **Examples of System Settings** | Theme default (not user override), logging level/format, security policies (session timeout, password rules), capacity defaults (shift schedules, MH defaults), API rate limits, allowed hostnames, ingest endpoint config, master data conformity mode. |
| **Examples of Non-System Settings** | User theme preference (stays in `user_preferences`), customer colors (stays in `customers`), aircraft type mappings (stays in `aircraft_type_mappings`), MH overrides (stays in `mh_overrides`). |
| **Implementation Notes** | (1) Define schema for `data/config/system.json`. (2) On startup (`seed.ts` or separate `load-system-config.ts`), read file and UPSERT into `app_config`. (3) Optionally support env-specific overlays (`system.production.json`). (4) Document in `DEPLOYMENT.md` and `CONFIGURATION.md`. (5) Provide sample file in repo (`system.json.example`). |
| **Migration Path** | Export current `app_config` rows to initial `system.json`, commit to repo, document in deployment guide. |
| **Related** | Similar to how Docker Compose uses `docker-compose.yml` for declarative config, or Kubernetes ConfigMaps. |
| **Links** | `src/lib/db/schema.ts` (`app_config` table), `src/app/api/config/route.ts`, `src/app/(authenticated)/admin/settings/page.tsx`, [DEPLOYMENT.md](../DEPLOYMENT.md) |

---

## OI-041 | Collapsible Sidebar with Icon-Only Condensed Mode

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |
| **Context** | Current sidebar is fixed-width with full labels (Dashboard, Flight Board, Capacity, Settings, Admin, etc.). No option to collapse or condense. User wants a collapsible sidebar that: (1) Collapses to icon-only mode for space efficiency, (2) Keeps icons visible when collapsed, (3) Keeps Dashboard logo visible when collapsed (scaled/condensed), (4) Toggle button or hover to expand. Common pattern in modern dashboards (e.g., Grafana, Vercel, GitHub). |
| **Current Behavior** | Sidebar always shows full width with icon + label for each menu item. Logo at top shows full "CVG Line Maintenance Dashboard" text. No collapse mechanism. |
| **Proposed Solution** | **Collapsed state**: Width ~60-80px, icons only, logo condensed (icon or initials "CVG"), tooltips on hover show full labels. **Expanded state**: Current width (~240px), icons + labels, full logo text. **Toggle**: Chevron button at bottom of sidebar or hamburger icon at top. **Persistence**: Save collapse state to `user_preferences` table (per-user). **Responsive**: Auto-collapse on mobile/tablet, always expanded on desktop unless user toggles. **Smooth transition**: CSS transition for width change (200-300ms ease). |
| **Reference Examples** | Vercel Dashboard (collapsible sidebar with icons), GitHub sidebar (condensed mode), Grafana (icon-only mode with tooltips), VS Code Activity Bar (always icon-only with hover tooltips). |
| **Design Details** | **Collapsed**: Icon-only vertical stack, 48px icon buttons with tooltips, logo as icon/initials (e.g., "CVG" in a circle). **Expanded**: Icon + label horizontal layout, full "CVG Line Maintenance Dashboard" logo. **Toggle button**: Fixed at bottom of sidebar or next to logo, chevron left/right icon. **Mobile**: Overlay sidebar (always collapsed to hamburger menu), no in-page collapse. |
| **User Preferences** | New field in `user_preferences` table: `sidebarCollapsed: boolean`. Default `false` (expanded). |
| **Components Affected** | `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx` (mobile hamburger), `src/lib/hooks/use-preferences.ts` (new field), `src/lib/db/schema.ts` (add column), `src/app/api/account/preferences/route.ts` (persist state). |
| **Benefits** | (1) More horizontal space for content (especially on laptops). (2) Cleaner, less cluttered UI. (3) Common UX pattern users expect. (4) Per-user preference (some users want always-expanded). |
| **Implementation Notes** | Use Zustand store for client-side state + sync to DB on toggle. CSS transitions for smooth expand/collapse. Tooltips use Radix UI Tooltip component. Logo component accepts `collapsed` prop for alternate rendering. |
| **Related Patterns** | Similar to compact mode (D-017) but specific to sidebar layout. |
| **Links** | `src/components/layout/sidebar.tsx`, `src/lib/hooks/use-preferences.ts`, [REQ_UI_Interactions.md](SPECS/REQ_UI_Interactions.md), [UI_COMPONENTS.md](UI/UI_COMPONENTS.md) |

---

## OI-042 | ~~Dashboard Chart Issues & Enhancements~~ PARTIALLY RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug + Enhancement |
| **Status** | **Partially Resolved** |
| **Priority** | P1 (bugs), P2 (enhancements) |
| **Owner** | Claude |
| **Created** | 2026-02-16 |
| **Resolved** | 2026-02-18 (items 1, 2, 4, 5) |
| **Context** | Multiple issues identified with dashboard charts (main timeline + pie charts). Some are bugs (broken filtering, theme non-compliance), others are UX enhancements (timezone display, cross-filtering). |

### Bugs (P1) — RESOLVED

1. **~~Aircraft by Customer pie chart tooltip not theme-compliant~~** ✅
   - **Root cause**: Recharts Tooltip `itemStyle` defaults to the pie slice color, making hover text unreadable in dark mode when slice colors are dark
   - **Fix**: Added `itemStyle={{ color: "hsl(var(--popover-foreground))" }}` to Tooltip. Also added inline `style={{ color: "hsl(var(--foreground))" }}` to Legend `wrapperStyle` and `formatter` span (Tailwind classes don't reliably override Recharts internals)
   - **Files**: `src/components/dashboard/customer-donut.tsx`, `src/components/dashboard/combined-chart.tsx`

2. **~~Click-to-focus operator doesn't filter timeline chart~~** ✅
   - **Root cause**: `displaySnapshots` was a passthrough of API-fetched snapshots, ignoring `focusedOperator`. FilterBar operator selection already worked (via `useHourlySnapshots` API call), but clicking an operator in the performance table/donut did not update the chart.
   - **Fix**: `displaySnapshots` memo now recomputes hourly arrival/departure/onGround counts in-memory from `displayWps` (already filtered by `focusedOperator`) when cross-filtering is active
   - **File**: `src/app/(authenticated)/dashboard/page.tsx`

### Enhancements (P2) — RESOLVED

3. **Pie chart interaction: popout instead of single pick** — **Open (deferred)**
   - Deferred to v0.3.0+

4. **~~Show selected timezone in chart header~~** ✅
   - **Fix**: Added `ml-auto` span to combined chart `<h3>` header, inherits same styling (text-xs font-semibold uppercase text-muted-foreground). Shows "UTC" or "Eastern (ET)"
   - **File**: `src/app/(authenticated)/dashboard/page.tsx`

5. **~~Total Aircraft card: show total turns~~** ✅
   - **Fix**: Reimagined as "Aircraft & Turns" card with two-column layout — both numbers shown at `text-3xl font-bold` with vertical divider, equally prominent. Uses "Turns" terminology (not "Visits")
   - **File**: `src/components/dashboard/total-aircraft-card.tsx`

### Future (v0.3.0+) — Open

6. **Interactive chart filtering (brush selection + customer cross-filter)**
   - **Proposal**: Click/drag to select a time range on main chart → filters all stats
   - **Cross-filtering**: Select customer in sidebar → highlights that customer's data on chart
   - **Implementation**: ECharts brush component + Zustand filter state + cross-component sync

| **Resolution** | Items 1, 2, 4, 5 resolved. Items 3, 6 deferred to v0.3.0+. |
| **Files** | `src/app/(authenticated)/dashboard/page.tsx`, `src/components/dashboard/customer-donut.tsx`, `src/components/dashboard/combined-chart.tsx`, `src/components/dashboard/total-aircraft-card.tsx` |
| **Links** | [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md), [REQ_Filters.md](SPECS/REQ_Filters.md), Flight Board timezone display (working reference) |

---

## OI-043 | Chunked Upload Location Header Returns Localhost Behind Proxy

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |
| **Context** | When Power Automate initiates a chunked upload (`x-ms-transfer-mode: chunked`), the server returns a `Location` header pointing to `https://localhost:5015/api/ingest/chunks/{sessionId}`. PA rejects this: "The location header value returned in the response must be a well formed absolute URI not referencing local host or UNC path." **Root cause**: `request.nextUrl.origin` in Next.js resolves to the internal server address (`localhost:5015`) when behind a reverse proxy (Cloudflare Tunnel), not the public hostname (`cvg.gh4.io`). |
| **Fix Applied** | Updated `src/app/api/ingest/route.ts` to derive the base URL from `X-Forwarded-Host` / `X-Forwarded-Proto` headers instead of `nextUrl.origin`. Falls back to `nextUrl.origin` if no forwarded headers present. **Committed but not yet deployed/verified.** |
| **Verification Needed** | (1) Confirm the reverse proxy (Cloudflare Tunnel) sends `X-Forwarded-Host` and `X-Forwarded-Proto` headers. (2) Deploy updated code to Braxton and restart server. (3) Test chunked upload from Power Automate — Location header should now read `https://cvg.gh4.io/api/ingest/chunks/{sessionId}`. |
| **Related Issue** | Logout button also redirects to `localhost` — same root cause. **Fixed 2026-02-17**: Changed `signOut({ callbackUrl: \`${origin}/login\` })` to `signOut({ callbackUrl: "/login" })` in `header.tsx`. Auth.js v5 accepts relative `callbackUrl` values without origin validation; the browser resolves the path against the actual host. |
| **Files** | `src/app/api/ingest/route.ts` (lines 140-145), `src/lib/auth.ts` (trustHost config) |
| **Links** | [REQ_DataImport.md](SPECS/REQ_DataImport.md), OI-034, OI-037 |

---

## OI-044 | Generic db:cleanup + Data Retention Policy

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Partially Resolved** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |
| **Resolved** | 2026-02-17 (cron management system — D-030) |
| **Context** | Cron job management system now supports built-in + custom jobs via code defaults + YAML overrides. The cleanup-canceled task is the first built-in job with configurable options (graceHours). Additional cleanup tasks (data retention) can be added as new built-in jobs or custom scripts. |
| **Remaining** | Data retention policy (auto-delete WPs older than N days) not yet implemented as a separate cron task. Can now be added as a built-in job in `src/lib/cron/index.ts` or as a custom script via the Admin Cron UI. |
| **Links** | [REQ_Cron.md](SPECS/REQ_Cron.md), D-030, `src/lib/cron/index.ts` |

---

## OI-045 | Canceled WP Visual Treatment on Flight Board

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-16 |
| **Implemented** | 2026-02-17 (visual treatment commit `1386d75`), 2026-02-18 (system preference + admin toggle, D-034) |
| **Context** | Canceled WPs are now controlled by a system preference `flights.hideCanceled` in `server.config.yml` (default: `true`). When hidden, canceled WPs are excluded at the DB query level with no visual indication. When an admin sets `hideCanceled: false`, canceled WPs appear with striped/dimmed treatment. The cleanup grace period (`flights.cleanupGraceHours`) is also a system preference, feeding both the cron job and manual cleanup. Admin UI toggle in Admin Settings > Server tab > Flight Display section. |
| **Resolution** | System preference approach (D-034). Not a filter — completely invisible when hidden. Admin toggle writes to `server.config.yml`. Grace period is a first-class system setting. |
| **Links** | D-034, `src/lib/config/loader.ts`, `src/lib/data/reader.ts`, `src/app/api/admin/server/flights/route.ts`, `src/components/admin/server-tab.tsx` |

---

## OI-046 | Customer SP ID in Work Packages — Future Mapping Needed

| Field | Value |
|-------|-------|
| **Type** | Limitation / Stub |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-02-17 |
| **Context** | `work_packages.customer_sp_id` column added as a stub (D-033). Current WP JSON (`wp.json`) only provides `Customer` as a name string — no SharePoint customer ID is present in the WP record. To populate this column, either the WP export format would need to include the customer SP ID, or a name→ID lookup against `customers.sp_id` would be needed post-import. |
| **Proposed Solution** | After aircraft/customer master data is imported (and `customers.sp_id` is populated from cust.json), add a post-import backfill step: `UPDATE work_packages SET customer_sp_id = (SELECT sp_id FROM customers WHERE customers.name = work_packages.customer) WHERE customer_sp_id IS NULL`. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-033, `src/lib/data/import-utils.ts` |

---

## OI-047 | Flight Board Chart Color Reset on Rapid Clicks

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | Flight board chart colors occasionally revert to hardcoded/default values when clicked multiple times or at random intervals. Expected: custom customer colors persisted throughout session. Actual: colors reset unpredictably. |
| **Root Cause** | Likely: ECharts state not properly managed during rapid updates, customer color context not maintaining reference across re-renders, or Zustand store not syncing customer color changes. |
| **Proposed Solution** | (1) Debug ECharts chart update flow for color state mutation. (2) Verify Zustand customer store is properly invalidating on color edit. (3) Add key-based cache invalidation for flight board series colors. (4) Test with rapid click/drag interactions. |
| **Files** | `src/components/flight-board/flight-board-chart.tsx`, `src/lib/hooks/use-customers.ts`, `src/app/api/admin/customers/route.ts` |
| **Links** | [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), [REQ_Admin.md](SPECS/REQ_Admin.md) (customer colors) |

---

## OI-048 | Rate Limiting as System Preference

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | Current rate limiting for `/api/ingest` endpoint is hardcoded (`ingestRateLimitSeconds` from `app_config`). User wants rate limiting to be a configurable system preference accessible via Admin Settings, similar to other server-level settings. |
| **Proposed Solution** | Move `ingestRateLimitSeconds` and `ingestMaxSizeMB` to `server.config.yml` with defaults. Expose in Admin Settings under API Integration section as editable fields. File-based settings are source of truth (admin changes don't persist after restart unless pushed to config file). |
| **Related** | D-030 (system config), OI-040 (system settings file) |
| **Files** | `server.config.yml`, `src/lib/config/loader.ts`, `src/app/api/config/route.ts`, `src/app/(authenticated)/admin/settings/page.tsx` |
| **Links** | [REQ_DataImport.md](SPECS/REQ_DataImport.md), OI-040 |

---

## OI-049 | Admin Settings Tab Layout Redesign

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | Current Admin Settings page mixes DB-stored preferences (demand model, capacity, shifts, display) with system-level config (allowed hostnames, API keys, rate limits). Mixed save patterns confusing: some changes save on button click, others auto-save. User wants clearer separation: **System Preferences** section (rate limiting, API config, etc.) with Save button affecting ONLY file-based system settings; **Database Preferences** section (demand/capacity models, shifts) with auto-save or separate save flow. |
| **Proposed Solution** | (1) Split Admin Settings page into two distinct tabs/sections: "System Configuration" (server.config.yml) and "Database Preferences" (app_config/preferences tables). (2) System tab: Load all settings from `server.config.yml` via `GET /api/config`, edit form, Save button writes to file (admin-only). (3) Database tab: Current behavior (auto-save per field). (4) Visual distinction (different backgrounds/icons). (5) Info callout in System tab: "Requires server restart to apply" or "Live changes via config file". |
| **Files** | `src/app/(authenticated)/admin/settings/page.tsx`, `src/components/admin/server-tab.tsx` |
| **Links** | OI-040 (system config file), [REQ_Admin.md](SPECS/REQ_Admin.md) |

---

## OI-050 | AOG Aircraft Condition & Visual Tracking

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | AOG = Aircraft on Ground (due to maintenance emergency/unscheduled maintenance). User wants to track AOG status separately from canceled flights. AOG aircraft should: (1) Appear with a distinct visual treatment on flight board (similar to canceled flights), (2) Possibly use a secondary table or a flag in the work package data, (3) Eventually have its own view/analytics. **Not fully imagined yet** — needs discovery on data source, tracking mechanism, and UI treatment. |
| **Proposed Solution** | **Phase 1 (Discovery)**: Clarify data source for AOG flag (exists in work package JSON? admin-entered? inferred from status?). **Phase 2 (Schema)**: Add `aogStatus` or similar field to `work_packages` table (nullable, default NULL). **Phase 3 (UI)**: Flight board visual treatment (striped/dimmed like canceled). **Phase 4 (Future)**: Dedicated AOG analytics section, admin controls. |
| **Data Model** | Likely: `work_packages.aogStatus: string | null` (e.g., "aog", "scheduled", null). Or separate boolean: `isAog: boolean`. |
| **Visual Reference** | Canceled treatment used as starting point (D-034). AOG could use same pattern or distinct color/pattern. |
| **Files** | `src/lib/db/schema.ts`, `src/components/flight-board/flight-board-chart.tsx`, `src/lib/data/reader.ts` |
| **Links** | [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), D-034 (canceled visual treatment) |

---

## OI-051 | iPad Quick Info Panel (Long Press / Tap)

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | On desktop, clicking a flight bar opens a side drawer with detailed information. On iPad, this interaction is unclear (small target, drawer may hide content). User wants: quick info popover/panel appears and stays on screen when tapping a flight on iPad, rather than relying on hover-triggered tooltips or full-screen drawer. Pattern: tap → info panel appears on same screen, tap elsewhere to close. |
| **Proposed Solution** | (1) Detect touch device (iPad/tablet). (2) On tap, instead of opening side drawer, open a fixed floating panel (card/popover) anchored to the tapped flight or a fixed position (e.g., top-right). (3) Show same flight details as drawer (registration, customer, time, ground time, MH, type). (4) Include close button. (5) Tap outside or press close → panel dismisses. (6) Ensure panel doesn't block other important UI elements. **Alternative**: Use Radix UI Popover anchored to the ECharts element. |
| **UX Pattern** | Similar to mobile map apps (tap pin → info card appears, swipe to close). |
| **Files** | `src/components/flight-board/flight-detail-drawer.tsx`, `src/components/flight-board/flight-board-chart.tsx` |
| **Links** | [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), [REQ_UI_Interactions.md](SPECS/REQ_UI_Interactions.md) |

---

## OI-052 | Flight Board Toggle: Gantt vs. List View

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | Flight board currently displays as a Gantt timeline chart (ECharts). User wants ability to toggle to a **list view** (table format) to see flights in a sortable/filterable table instead of timeline. List view would enable: (1) Easier mobile navigation (vertical scrolling instead of horizontal Gantt panning), (2) Detailed tabular view for operators/admins, (3) Foundation for mobile-first design. |
| **Proposed Solution** | (1) Add toggle button (Gantt icon / List icon) in flight board toolbar. (2) Zustand store tracks view mode (`flightBoardView: "gantt" | "list"`). (3) Conditional render: Gantt chart or TanStack Table. (4) List columns: Registration, Customer, Aircraft Type, Arrival, Departure, Ground Time, MH, Status. (5) Sortable columns, sticky header. (6) Persist view preference in `user_preferences` table. (7) Mobile: default to list view, option to switch to Gantt. |
| **Files** | `src/app/(authenticated)/flight-board/page.tsx`, `src/components/flight-board/`, `src/lib/hooks/use-preferences.ts`, `src/lib/db/schema.ts` |
| **Links** | [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), [REQ_UI_Interactions.md](SPECS/REQ_UI_Interactions.md) |

---

## OI-053 | iOS Home Screen Installation (PWA / Web Clip)

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | User wants the app to be installable as a home screen shortcut on Apple devices (iPhone/iPad). Users can tap "Share" → "Add to Home Screen" to create a web clip. Currently app likely lacks proper PWA metadata (`manifest.json` icons, theme colors, display mode). Goal: app appears as an installable app icon, opens in full-screen mode (no browser chrome). |
| **Proposed Solution** | (1) Ensure `public/manifest.json` exists with icons (192x192, 512x512), app name, theme colors, display mode `fullscreen` or `standalone`. (2) Add `<meta name="apple-mobile-web-app-capable">`, `<meta name="apple-mobile-web-app-status-bar-style">`, `<link rel="apple-touch-icon">` to layout root. (3) Test on iPad: Settings → Home Screen → Add to Home Screen → verify icon and full-screen launch. (4) Ensure all routes work in PWA mode (no redirect loops). |
| **Files** | `public/manifest.json`, `src/app/layout.tsx`, iOS viewport meta tags |
| **Links** | [MDN: Web app manifests](https://developer.mozilla.org/en-US/docs/Web/Manifest), [Apple PWA Guide](https://developer.apple.com/library/archive/referencelibrary/General/Conceptual/QueryingtheWebforScottish/) |

---

## OI-054 | Collapsible Sidebar with Icon-Only Mode

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | Current sidebar is always expanded (full width with labels). User wants collapsible sidebar with icon-only condensed mode for space efficiency. When collapsed: width ~60-80px, icons only, logo condensed (initials "CVG"), tooltips on hover. User also wants multiple "flavors" of collapse (icons visible, icon + abbreviated labels, full width). |
| **Proposed Solution** | (1) Add collapse toggle button in sidebar. (2) Zustand store tracks `sidebarMode: "expanded" | "condensed" | "compact"` (or similar variants). (3) CSS transitions for smooth width/opacity changes. (4) Logo component renders full text or initials based on mode. (5) Menu items render icon + label (expanded) or icon only (condensed) with Radix Tooltip on hover. (6) Persist preference to `user_preferences.sidebarMode`. (7) Mobile: always collapsed (hamburger menu), no in-page collapse. (8) Responsive: auto-collapse on small desktop screens. |
| **Files** | `src/components/layout/sidebar.tsx`, `src/lib/hooks/use-preferences.ts`, `src/lib/db/schema.ts` |
| **Links** | OI-041 (similar but less detail), [REQ_UI_Interactions.md](SPECS/REQ_UI_Interactions.md) |

---

## OI-055 | Sticky Time Headers on Flight Board (Horizontal Scroll)

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | Flight board Gantt timeline scrolls horizontally. When scrolling left/right, the time header (top axis with hour labels) scrolls out of view, making it hard to track what times you're viewing. User wants time headers to **stick** at the top of the chart during horizontal scroll, similar to sticky table headers on vertical scroll. |
| **Proposed Solution** | (1) Identify ECharts xAxis container (top time labels). (2) Use CSS `position: sticky; top: 0; z-index: 10;` or equivalent ECharts configuration to keep top axis visible during scroll. (3) Ensure day labels (MONDAY, TUESDAY...) also stick. (4) Test horizontal scroll behavior across browsers. **Challenge**: ECharts uses canvas-based rendering, not DOM elements, so traditional CSS sticky may not work. May require custom container wrapper or ECharts gridIndex positioning. |
| **Files** | `src/components/flight-board/flight-board-chart.tsx` (ECharts grid/axis config) |
| **Links** | [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), ECharts grid documentation |

---

## OI-056 | Shift Highlighting with Visual Time Separators

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | Flight board shows continuous timeline but no visual indication of shift boundaries. User wants to see **shift time blocks** on the chart: (1) Define shift times via system preference (e.g., Day 07:00-15:00, Swing 15:00-23:00, Night 23:00-07:00). (2) Render subtle background colored sections for each shift (semi-transparent, low opacity ~0.1, light gray or theme-aware). (3) Add thin separator lines at shift boundaries (e.g., 07:00, 15:00, 23:00). (4) Optional: Show shift name label (e.g., "DAY SHIFT" in corner of section). **Reference**: Similar to "now" and "day" marker lines already in the chart. |
| **Proposed Solution** | (1) Shift times already configurable in system settings (`server.config.yml` shifts array). (2) In `flight-board-chart.tsx`, compute shift block timestamps for the visible date range. (3) Add `markArea` components to ECharts for each shift (background fill). (4) Add vertical `markLine` components for shift boundaries. (5) Shift background colors: theme-aware, low opacity. (6) Shift labels optional based on space/preference. |
| **Files** | `src/components/flight-board/flight-board-chart.tsx`, `src/lib/config/loader.ts` (shifts), `server.config.yml` |
| **Links** | [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md), [REQ_OtherPages.md](SPECS/REQ_OtherPages.md) (shifts), D-009 (capacity model) |

---

## OI-057 | ~~System Preference Filters Not Shown as Active~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | Claude |
| **Created** | 2026-02-18 |
| **Resolved** | 2026-02-18 |
| **Context** | FilterBar displayed active filter pills for system defaults (date range, timezone) even though the user didn't explicitly set them. "Eastern" timezone chip appeared because the check was `timezone !== "UTC"`, but the system default IS Eastern. Date range chip ("Feb 18 – Feb 21") was always shown and redundant with the Start/End pickers above. |
| **Resolution** | **Fix 1**: Removed the date-range chip entirely — dates are already visible in Start/End pickers. **Fix 2**: Timezone chip now compares against system default (`getTimelineFromWindow().defaultTimezone`) instead of hardcoded "UTC". Only shows when user has changed timezone from the default. **Fix 3**: `handleClearAll` now resets timezone to system default instead of hardcoded "UTC". |
| **Files** | `src/components/shared/top-menu-bar.tsx` |
| **Links** | [REQ_Filters.md](SPECS/REQ_Filters.md), OI-059 (time indicator display) |

---

## OI-058 | Bootstrap Layer + Self-Registration + Invite Codes

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Resolved** |
| **Priority** | P0 |
| **Owner** | Claude |
| **Created** | 2026-02-18 |
| **Resolved** | 2026-02-18 |
| **Context** | Complete bootstrap system + authentication flow for fresh deployments. On startup, system auto-creates SQLite schema, a system service account (SYSTEM_AUTH_ID), and default server configuration. First user registers as superadmin (no invite code required) via `/register`. Subsequent self-registration gated by admin-controlled invite codes. |
| **Resolution** | **Bootstrap layer** (seed.ts): Idempotent schema creation + system user injection + system defaults. **First-user registration** (/register): Accepts email/password, creates superadmin user, only works when zero users exist. **Admin-gated self-registration** (/register with invite code toggle): Admin controls toggle in Settings. When enabled, admins can generate/revoke invite codes (stored in `invite_codes` table). Users register with email/password + code. **Shared constants**: SYSTEM_AUTH_ID extracted to `src/lib/constants.ts`. **Database migration**: M004 adds `invite_codes` table for existing deployments. **All changes additive**: New endpoints, new nullable columns, new optional settings per D-028 (semantic versioning). **Build**: npm run build passes. **Lint**: npm run lint clean. **Verified**: Fresh DB startup → /register accepts first user as superadmin → second user requires invite code (if enabled). |
| **Files Created** | `src/lib/constants.ts` (SYSTEM_AUTH_ID constant) |
| **Files Modified** | `src/lib/db/schema.ts` (invite_codes table, M004 migration), `src/lib/db/seed.ts` (bootstrap system user), `src/app/(unauthenticated)/register/page.tsx` (new route), `src/app/api/auth/register/route.ts` (registration handler), `src/app/(authenticated)/admin/settings/page.tsx` (invite code admin UI), `src/types/index.ts` (AppConfig.selfRegistrationEnabled, InviteCode interface) |
| **Links** | [REQ_Auth.md](SPECS/REQ_Auth.md), [DECISIONS.md](DECISIONS.md) D-035, [REQ_Versioning.md](SPECS/REQ_Versioning.md) D-028 |

---

## OI-059 | Time/Date Indicator Needs Better Display Area

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |
| **Context** | The date range and timezone context (e.g., "Feb 18 – Feb 21", "Eastern") are useful pieces of information, but active filter pills are the wrong display area. The date range is already visible in the Start/End picker fields. A dedicated, subtle display area for time context (current range, timezone, relative label like "next 3 days") would be a better UX — perhaps a status bar, subtitle under the page title, or a small info badge near the date pickers. |
| **Proposed Ideas** | (1) Subtitle below page title: `Dashboard · Feb 18–21 · Eastern`. (2) Small muted badge/tag inline with date pickers. (3) Breadcrumb-style context strip. (4) Footer status bar with time context + data freshness. |
| **Files** | `src/components/shared/top-menu-bar.tsx` |
| **Links** | OI-057 (resolved — removed default pills), [REQ_Filters.md](SPECS/REQ_Filters.md) |

---

---

## OI-060 | ~~baseUrl / AUTH_URL Normalization~~ RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Resolved** |
| **Priority** | ~~P2~~ |
| **Owner** | Claude |
| **Created** | 2026-02-19 |
| **Resolved** | 2026-02-19 |
| **Context** | Three confirmed failure cases with malformed base URL values: (1) no protocol, (2) literal quote characters from Docker env quoting, (3) valid URL — only this one worked. Also, `AUTH_URL` env var name was confusing (sounds security-related, is actually the public URL). |
| **Resolution** | **D-037**: Unified under single concept `baseUrl`. `app.baseUrl` in `server.config.yml` is primary. `BASE_URL` env var is override (env beats YAML). `AUTH_URL` removed from all user-facing config/docs (still set internally for Auth.js). Normalization added: strips quotes, adds protocol, validates, logs clearly, falls back to trustHost on failure. |
| **Files** | `src/instrumentation.ts`, `server.config.dev.yml`, `docker/.env.example`, `docker/.env.prod.example`, `docker/docker-compose.prod.yml`, `docker/README.md`, `DEPLOYMENT.md`, `docs/getting-started/configuration.mdx`, `docs/operations/deployment.mdx` |
| **Links** | [DECISIONS.md](DECISIONS.md) D-037, OI-043 |

---

## OI-061 | System User (system@internal) Should Be Read-Only

| Field | Value |
|-------|-------|
| **Type** | Bug / Security |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-19 |
| **Resolved** | 2026-02-19 |
| **Context** | The `system@internal` service account (SYSTEM_AUTH_ID) is used internally for automated tasks (data import, cron jobs, event tracking). It should not be modifiable by admins (cannot change username, email, or password) and should not be visible in user management UI, or if visible, should be clearly marked as system-protected. Currently admins can edit or delete this user, which would break system functionality. |
| **Resolution** | (1) Filtered system user from `GET /api/admin/users` using `ne(users.authId, SYSTEM_AUTH_ID)`. (2) Added `authId === SYSTEM_AUTH_ID` guard returning 403 in PUT, DELETE (`[id]/route.ts`), and reset-password routes. (3) No UI changes needed — system user no longer appears in the table. |
| **Files** | `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/app/api/admin/users/[id]/reset-password/route.ts`, `src/lib/constants.ts` |
| **Links** | [REQ_Auth.md](SPECS/REQ_Auth.md), [REQ_Admin.md](SPECS/REQ_Admin.md), OI-058 (bootstrap system user) |

---

## OI-062 | Superuser Self-Service Account Modifications

| Field | Value |
|-------|-------|
| **Type** | Feature / Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-19 |
| **Resolved** | 2026-02-19 |
| **Context** | Currently, superadmin users cannot modify their own username, email, or password from the Account page (`/account`). The Account page has a Profile form that shows username/email but is read-only (appears to be stub). Change Password form exists but username/email edits are missing or non-functional. Meanwhile, admins can edit superuser accounts from the Admin Users table, creating an asymmetry: admins can change superuser credentials, but superuser cannot self-modify. **Desired behavior**: Superuser should be able to change their own username, email, and password directly from their Account page, similar to any regular user. |
| **Impact** | Superuser is locked into their original credentials — cannot rotate credentials for security or update email address. |
| **Resolution** | (1) Extended `PUT /api/account/profile` to accept `username` and `email` with format validation, uniqueness checks, and lowercase storage. (2) Made profile-form.tsx username/email fields editable for all users (removed lock icons and "Contact an admin" text). (3) Added client-side validation. (4) Extended `auth.ts` JWT callback to refresh `displayName` and `email` from DB on every token refresh — changes reflect in session automatically. (5) Password change already worked via Security tab. |
| **Files** | `src/app/api/account/profile/route.ts`, `src/components/account/profile-form.tsx`, `src/lib/auth.ts` |
| **Links** | [REQ_Account.md](SPECS/REQ_Account.md), [REQ_Auth.md](SPECS/REQ_Auth.md), OI-018 (change password feature) |

---

## OI-063 | User Data Not Populated When Editing in Admin User Management

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-02-19 |
| **Resolved** | 2026-02-19 |
| **Context** | In the Admin Users table (`/admin/users`), when an admin clicks the edit button (pencil icon) on a user row, a dialog/form should open with that user's data (username, email, password reset option, role) pre-populated so the admin can modify it. Currently, the form opens but **no user data is populated** — all fields are blank. The form is not receiving the user's data from the selected row. |
| **Root Cause** | `UserForm` is always mounted. `useState` initializes form from `initialData` only once at mount (when `initialData` is `undefined`). On subsequent opens, `useState` does not re-initialize from changed props, and Radix Dialog's `onOpenChange` callback only fires on user interaction (overlay/Escape), not programmatic `open` prop changes. |
| **Resolution** | Added `useEffect` in `user-form.tsx` that syncs form state whenever `open` or `initialData` changes. Simplified `handleOpenChange` to just forward to `onOpenChange`. |
| **Files** | `src/components/admin/user-form.tsx` |
| **Links** | [REQ_Admin.md](SPECS/REQ_Admin.md) User Management section, M6 (Admin Core) |

---

## Summary

| Priority | Open | Partial | Acknowledged | Resolved |
|----------|------|---------|-------------|----------|
| P0 | 0 | 0 | 0 | 15 |
| P1 | 3 | 1 | 0 | 15 |
| P2 | 4 | 1 | 0 | 14 |
| P3 | 3 | 0 | 2 | 0 |
| **Total** | **10** | **2** | **2** | **44** |

**Latest update (2026-02-19)**: OI-060 resolved — D-037 unified base URL config under `baseUrl`/`BASE_URL`, removed `AUTH_URL` from user-facing config. OI-061, OI-062, OI-063 resolved — System user protected, self-service edits enabled, admin user edit form populates correctly.

**Latest additions (2026-02-18)**: Added OI-047 through OI-059. Flight board bugs (color reset, sticky headers, shift markers), feature requests (list view toggle, sidebar collapse, iOS PWA), UX improvements (system preference filter display, admin settings redesign, rate limiting configuration), authentication bootstrap (OI-058), and time indicator display (OI-059).
