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

## OI-003 | Aircraft Type Normalization Rules — UPDATED

| Field | Value |
|-------|-------|
| **Type** | Question |
| **Status** | **Updated** — partially addressed by D-015 |
| **Priority** | P2 — mitigated by admin-editable mapping |
| **Owner** | User + Claude |
| **Created** | 2026-02-13 |
| **Updated** | 2026-02-13 |
| **Context** | ~~Deprecated — registration-prefix inference is no longer the primary logic.~~ Aircraft type is sourced from admin-controlled mapping (D-015). **Key finding**: review of input.json shows NO aircraft type field in inbound data — the `Aircraft` object only contains `Title` (registration). Type resolution depends entirely on the admin mapping table. |
| **Mitigation** | D-015 adds an admin-editable aircraft type mapping table with pattern matching. Since there's no type field in data, seed rules must map by **registration pattern** (e.g., `C-F*` → B767, `C-G*` → B767 for CargoJet fleet) or admin manual classification. Unknown registrations fall back to "Unknown" type. Admin can add rules without code changes. |
| **Remaining** | User should review seed mapping rules against actual fleet roster and add registration-to-type patterns via the Admin UI. The mapping table design should support both type-string patterns AND registration patterns. |
| **Links** | [REQ_DataModel.md](SPECS/REQ_DataModel.md), [REQ_Admin.md](SPECS/REQ_Admin.md), [REQ_AircraftTypes.md](SPECS/REQ_AircraftTypes.md), [DECISIONS.md](DECISIONS.md) D-015, [RISKS.md](DEV/RISKS.md) R4, OI-019 |

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
| **Resolution** | D-016: MVP uses file upload + paste-JSON on `/admin/import` with validate → preview → confirm workflow. vNext: secure POST endpoint at `/api/ingest` for Power Automate integration. Import history logged to SQLite. |
| **Links** | [DECISIONS.md](DECISIONS.md) D-016, [REQ_Admin.md](SPECS/REQ_Admin.md), [REQ_Logging_Audit.md](SPECS/REQ_Logging_Audit.md) |

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

## Summary

| Priority | Open | Updated | Acknowledged | Resolved |
|----------|------|---------|-------------|----------|
| P0 | 0 | 0 | 0 | 2 |
| P1 | 0 | 0 | 0 | 8 |
| P2 | 0 | 1 | 0 | 9 |
| P3 | 0 | 0 | 2 | 0 |
| **Total** | **0** | **1** | **2** | **18** |

**Changes this pass (Decision Resolution)**: Resolved OI-011 (Auth.js v5 — proceed), OI-012 (Drizzle + better-sqlite3 — proceed), OI-013 (vNext stubs — include with "Coming Soon" badges), OI-016 (materialized views — don't build now, monitor at 500+ records), OI-017 (event tracking — immediate writes), OI-019 (Operator Performance — available-data KPIs only), OI-021 (theme CSS — include all, optimize if needed). **Remaining**: OI-003 (Updated — aircraft type seed rules need user review), OI-006 & OI-007 (Acknowledged — informational only).
