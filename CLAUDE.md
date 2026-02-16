# CLAUDE.md — CVG Line Maintenance Operations Dashboard

> Canonical operating manual for Claude Code. Read this first, every session.
> Detailed specs live in `.claude/` — this file links to them, never duplicates.
>
> **Last updated:** 2026-02-14 (Project Steward Skill)
>
> **What changed (UI Reconciliation Pass):**
> - Created `REQ_Dashboard_UI.md` — dashboard layout from CVG Line Maintenance reference screenshots
> - Created `REQ_Themes.md` — expanded to all 11 Fumadocs presets (D-022, supersedes D-018)
> - Created `UI_REFERENCE_MAP.md` — maps 12 reference images to layout/style decisions
> - Created `UI_MENUS.md` — dropdown, sidebar, admin navigation patterns
> - Updated `REQ_FlightBoard.md` — registration labels on bars, day separators, refresh button
> - Updated `REQ_Filters.md` — instant filtering confirmed, active filter pills, refresh action
> - Updated `UI_FILTER_PATTERNS.md` — active pill pattern, Column/Operator/Expression reference
> - Decisions: D-022 (11 themes), D-023 (dashboard layout), D-024 (instant vs apply filtering)
>
> **What changed (PASS 2 re-plan):**
> - Consolidated milestones from M0–M9 → M0–M8 with acceptance criteria
> - Created `.claude/PLAN.md` as authoritative implementation plan
> - Extracted standalone specs: `REQ_AircraftTypes.md`, `REQ_DataImport.md`

## Project Intent

Build a **local-first** Next.js web application for CVG (Cincinnati/Northern Kentucky Airport) line maintenance operations. Three core views:

1. **Flight Board** — Gantt-style timeline of aircraft on-ground windows
2. **Statistics Dashboard** — KPI cards, charts, analytics
3. **Capacity Modeling** — Demand vs. capacity for staffing decisions

The app ingests SharePoint OData work package data (local JSON), computes derived metrics, and renders interactive visualizations. No cloud dependencies.

## Non-Negotiables

- **Local-first**: no cloud dependencies required to run
- **Font Awesome**: self-hosted at `public/vendor/fontawesome/` → [UI_ICONS_FontAwesome.md](.claude/UI/UI_ICONS_FontAwesome.md)
- **Iterative scope**: small increments, always runnable
- Prefer clarity over cleverness; avoid over-engineering
- **Global FilterBar** on all data pages (7 fields): **Start**, **End**, **Station (CVG only)**, **Timezone (UTC/Eastern only)**, **Operator**, **Aircraft**, **Type** → [REQ_Filters.md](.claude/SPECS/REQ_Filters.md)
- **Import paths (MVP):** load from local JSON file **and** Admin "Paste JSON" importer; future secure POST route for automation.

> **🔴 MANDATORY — EVERY SESSION:**
> 1. **START**: Read CLAUDE.md → Review `.claude/OPEN_ITEMS.md` for blockers
> 2. **WORK**: Follow the relevant spec + PLAN.md
> 3. **END**: Update `.claude/OPEN_ITEMS.md` (new items, resolved items, links to specs/decisions/risks)

## Tech Stack (Locked — D-001)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15+ (App Router) | TypeScript, SSR, API routes |
| UI Components | shadcn/ui + Radix UI | Copy-paste model |
| Styling | Tailwind CSS v4 | Neutral dark theme |
| Theme | next-themes | Dark default, light available |
| Charts | Recharts (via shadcn/ui Charts) | Bar, line/area, donut/pie |
| Gantt | Apache ECharts (custom series) | Flight board timeline (canvas-rendered) |
| Icons | Font Awesome 6 (primary) + Lucide (supplementary) | Self-hosted |
| Tables | TanStack Table (via shadcn/ui) | Sortable |
| State | Zustand | Client-side, `skipHydration` |
| Auth | Auth.js (NextAuth v5) | Credentials provider, DB sessions |
| Database | SQLite (better-sqlite3) | Local-first, `data/dashboard.db` |
| ORM | Drizzle ORM | Type-safe schema, migrations |
| Data Import | JSON ingest (MVP) + Secure POST (future) | MVP: file ingest + Admin "Paste JSON" import UI. Future: authenticated HTTP POST endpoint for Power Automate. |

## Key Domain Rules

- **effectiveMH**: manual override > WP MH (if include) > default MH (3.0)
- **Capacity**: Day 07-15 (8 heads), Swing 15-23 (6 heads), Night 23-07 (4 heads)
- **Real capacity**: headcount × 6.5 MH/person
- **Utilization**: totalDemandMH / realCapacity × 100%
- **Station**: always CVG (locked, D-002)
- **Timezone:** default `UTC`. Internals support **all IANA timezones**, but the UI only enables **UTC** and **America/New_York**.
- **Aircraft Type:** provided in inbound data when available. Additionally, maintain an **admin-editable normalization + mapping dataset** in SQLite to standardize values (e.g., `B737`, `737-200`, `747-4R7`, `747F` → normalized forms). Do not rely on registration-prefix inference as primary logic.
- **Pagination**: Default 30 rows/page, configurable per user (D-017)
- **Theme presets**: 11 Fumadocs presets — Neutral, Ocean, Purple, Black, Vitepress, Dusk, Catppuccin, Solar, Emerald, Ruby, Aspen (D-022)
- **Data quirks**: `TotalGroundHours` is STRING, `TotalMH` null for 66/86 records
- **Customer colors**: Admin-configurable, stored in SQLite, not hardcoded (D-010)
- **Admin-configurable settings:** customer color coding is configurable via Admin Settings (stored in SQLite). No customer-specific styling should be hardcoded.
- **Auth**: Role-based — `user`, `admin`, `superadmin`. Admin routes server-enforced (D-009)

Full data model → [REQ_DataModel.md](.claude/SPECS/REQ_DataModel.md)

## Customer Colors

Customer colors are **admin-configurable** and stored in SQLite. Do **not** hardcode colors in docs or UI.
Defaults (seed values) may exist for first-run only; the Admin UI is the source of truth.

See: [REQ_Admin.md](.claude/SPECS/REQ_Admin.md)

## User Menu

Dropdown includes:
- **Account**
- **Admin** (superuser/admin only)
- **Logout**

Account page supports profile + preferences + security stubs per [REQ_Account.md](.claude/SPECS/REQ_Account.md).
Admin routes and UI are role-gated per [REQ_Admin.md](.claude/SPECS/REQ_Admin.md) and [REQ_Auth.md](.claude/SPECS/REQ_Auth.md).

## Folder Structure

```
src/app/                     — Next.js App Router pages
src/app/login/               — Login page
src/app/account/             — Account page (profile, prefs, security)
src/app/admin/               — Admin section (customers, aircraft-types, import, users, settings, analytics, audit)
src/app/api/                 — API route handlers
src/app/api/auth/            — Auth.js routes
src/app/api/admin/           — Admin-only APIs (role-enforced)
src/app/api/analytics/       — Analytics events + summary APIs
src/app/api/account/         — User account APIs
src/components/ui/           — shadcn/ui components
src/components/layout/       — Sidebar, header, user menu, mobile nav
src/components/shared/       — FilterBar, FilterBarMobile, DateTimePicker, MultiSelect, LoadingSkeleton, EmptyState
src/components/flight-board/ — ECharts Gantt components
src/components/dashboard/    — KPI cards, charts
src/components/capacity/     — Utilization chart, tables
src/components/account/      — Profile, preferences, security forms
src/components/admin/        — Customer editor, user table, user form, analytics dashboard
src/lib/auth.ts              — Auth.js configuration
src/lib/db/                  — SQLite connection, Drizzle schema, seed, seed-analytics
src/lib/data/                — Reader, transformer, engines
src/lib/hooks/               — Zustand stores (filters, customers, prefs)
src/lib/utils/               — Date, format, aircraft-type normalization (D-015), contrast helpers
src/types/                   — TypeScript interfaces
src/middleware.ts            — Route protection (auth + role checks)
data/                        — dashboard.db + input.json
data/seed/                   — Seed data JSON files (tracked in git)
data/backups/                — Timestamped backups (gitignored)
data/exports/                — Timestamped exports (gitignored)
scripts/db/                  — Database CLI tools (seed, reset, backup, etc.)
public/vendor/fontawesome/   — Self-hosted FA assets
plan/                        — Implementation plans
.claude/                     — Knowledge base (specs, UI, dev docs)
```

## Knowledge Base (.claude/)

| File | Purpose |
|------|---------|
| [README.md](.claude/README.md) | Index and rules for the knowledge base |
| [PROJECT_CONTEXT.md](.claude/PROJECT_CONTEXT.md) | What, who, data flow |
| [GLOSSARY.md](.claude/GLOSSARY.md) | Domain terminology |
| [DECISIONS.md](.claude/DECISIONS.md) | Decision log (D-001+) |
| [PLAN.md](.claude/PLAN.md) | Implementation plan (PASS 2) — authoritative build plan |
| [ROADMAP.md](.claude/ROADMAP.md) | Milestones M0–M8 |
| [OPEN_ITEMS.md](.claude/OPEN_ITEMS.md) | Tracked questions/issues (OI-001+) |

### Specs
| File | Purpose |
|------|---------|
| [REQ_Filters.md](.claude/SPECS/REQ_Filters.md) | Global FilterBar — 7 fields, URL sync, validation |
| [REQ_FlightBoard.md](.claude/SPECS/REQ_FlightBoard.md) | Flight Board page — Gantt, tooltip, zoom |
| [REQ_OtherPages.md](.claude/SPECS/REQ_OtherPages.md) | Dashboard, Capacity, Settings pages |
| [REQ_DataModel.md](.claude/SPECS/REQ_DataModel.md) | TypeScript interfaces, data warnings |
| [REQ_DataSources.md](.claude/SPECS/REQ_DataSources.md) | API routes, HAR analysis, data stats |
| [REQ_UI_Interactions.md](.claude/SPECS/REQ_UI_Interactions.md) | State mgmt, responsive, theme, loading |
| [REQ_Auth.md](.claude/SPECS/REQ_Auth.md) | Authentication, roles, sessions, login |
| [REQ_Account.md](.claude/SPECS/REQ_Account.md) | Account page, preferences, user menu |
| [REQ_Admin.md](.claude/SPECS/REQ_Admin.md) | Admin section, customer colors, user mgmt |
| [REQ_Analytics.md](.claude/SPECS/REQ_Analytics.md) | Analytics plan — 24 KPIs, event tracking, storage |
| [REQ_Dashboard_UI.md](.claude/SPECS/REQ_Dashboard_UI.md) | Dashboard page layout, KPI cards, charts, cross-filtering |
| [REQ_Themes.md](.claude/SPECS/REQ_Themes.md) | Theme system — 11 Fumadocs presets, light/dark, CSS tokens |
| [REQ_AircraftTypes.md](.claude/SPECS/REQ_AircraftTypes.md) | Aircraft type normalization — mapping, seed data, admin UI |
| [REQ_DataImport.md](.claude/SPECS/REQ_DataImport.md) | Data import — file upload, paste JSON, vNext POST |
| [REQ_Permissions.md](.claude/SPECS/REQ_Permissions.md) | ~~No auth for v0~~ Superseded by REQ_Auth.md |
| [REQ_Logging_Audit.md](.claude/SPECS/REQ_Logging_Audit.md) | Error logging, import stats |
| [REQ_DataReset.md](.claude/SPECS/REQ_DataReset.md) | Database tools — 9 db:* scripts, seed data, backups |

### UI
| File | Purpose |
|------|---------|
| [UI_COMPONENTS.md](.claude/UI/UI_COMPONENTS.md) | Component inventory (shadcn/ui + custom) |
| [UI_ICONS_FontAwesome.md](.claude/UI/UI_ICONS_FontAwesome.md) | FA setup, icon map by feature |
| [UI_FILTER_PATTERNS.md](.claude/UI/UI_FILTER_PATTERNS.md) | Filter component patterns, active pills, mobile sheet |
| [UI_REFERENCE_MAP.md](.claude/UI/UI_REFERENCE_MAP.md) | Reference image analysis — 12 images mapped to specs |
| [UI_MENUS.md](.claude/UI/UI_MENUS.md) | Dropdown, sidebar, admin nav menu patterns |

### Dev
| File | Purpose |
|------|---------|
| [DEV_STANDARDS.md](.claude/DEV/DEV_STANDARDS.md) | Code conventions, naming, patterns |
| [DEV_COMMANDS.md](.claude/DEV/DEV_COMMANDS.md) | Setup, install, build, dev commands |
| [TEST_PLAN.md](.claude/DEV/TEST_PLAN.md) | Manual test checklist, future automation |
| [RISKS.md](.claude/DEV/RISKS.md) | R1–R19 risks with mitigations |

### Skills
| File | Purpose |
|------|---------|
| [PROJECT_STEWARD.md](.claude/SKILLS/PROJECT_STEWARD.md) | Session workflow, doc authority, change discipline |
| [AUTO_COMMIT_POLICY.md](.claude/SKILLS/AUTO_COMMIT_POLICY.md) | Commit triggers, message format, verification gates |

## Project Steward Skill

> **Run this workflow every session.** See [PROJECT_STEWARD.md](.claude/SKILLS/PROJECT_STEWARD.md) for full details.

**EVERY SESSION: Review OPEN_ITEMS.md first, and before finishing; update statuses, add new OIs, and link each OI to the spec/decision/risk it touches.**

**After major phases/changes, run `scripts/phase_commit.sh`** to verify gates (lint + build), check doc touchpoints, and generate a conventional commit with metadata footers.

**Scripts:**
- `scripts/phase_commit.sh` — Guided commit with verification gates and doc-touch checks
- `scripts/feature_intake.sh` — Create new OPEN_ITEMS entries + optional stub specs

## Session Workflow

### A. Start of Session
1. Read this file (CLAUDE.md)
2. Check [OPEN_ITEMS.md](.claude/OPEN_ITEMS.md) for blockers
3. Check [ROADMAP.md](.claude/ROADMAP.md) for current milestone

### B. Before Implementation
1. Read the relevant spec in `.claude/SPECS/`
2. Check [DECISIONS.md](.claude/DECISIONS.md) for related choices
3. Plan before coding; keep the app runnable

### C. During Implementation
1. Follow [DEV_STANDARDS.md](.claude/DEV/DEV_STANDARDS.md)
2. Small, focused changes
3. Verify: `npm run build` + `npm run lint` + `npm run dev`

### D. End of Session
1. Update [OPEN_ITEMS.md](.claude/OPEN_ITEMS.md) — new items, resolved items
2. Update [ROADMAP.md](.claude/ROADMAP.md) if milestone progress changed
3. Log any new decisions in [DECISIONS.md](.claude/DECISIONS.md)

## Verification Gates

- `npm run build` must pass
- `npm run lint` must be clean
- `npm run dev` must render all pages without console errors
- See [TEST_PLAN.md](.claude/DEV/TEST_PLAN.md) for full checklist

## Plan Files

- `.claude/PLAN.md` — **authoritative** implementation plan (PASS 2, D-020)
- `/plan/FINAL-PLAN.md` — prior implementation plan (retained as reference)
- `/plan/PLAN-AMENDMENT-001-FILTER-BAR.md` — FilterBar integration plan (integrated into PLAN.md M2)
