# CLAUDE.md — CVG Line Maintenance Operations Dashboard

> Canonical operating manual for Claude Code. Read this first, every session.
> Detailed specs live in `.claude/` — this file links to them, never duplicates.
>
> **Last updated:** 2026-08-06 (v0.3.0 in progress)
>
> **🔶 CURRENT STATE — READ BEFORE PLANNING WORK:**
> - Working branch `feat/flight-event-enhancements`, **223 commits ahead of `master`**. `package.json` is `0.3.0`.
> - **v0.3.0 is NOT release-ready.** CHANGELOG `[0.3.0]` is dated 2026-03-04, but five commits landed after the version bump (including a `wip:` checkpoint). The entry is incomplete.
> - **Production runs `0.2.0-rc1`** — it predates OI-080 entirely, which is why prod has no `rotation_end_date` column and no shift history.
> - **Effective dating now works end to end** (2026-08-07). OI-100, OI-101 and OI-102 are resolved: the engine honours shift effective dates, rotation patterns are versioned (M026), and a version boundary lands on the save date with the pattern phase preserved (M025). The P1 blocker on the prod upgrade is cleared. OI-103 remains partially open — the archive-and-create transactions need a DB harness.
> - **Two new migrations since prod:** M025 (`staffing_shifts.pattern_anchor_date`) and M026 (rotation pattern versioning). Both are additive, backfilled, and idempotent; verified against the dev DB.
> - Unfiled planning work sits in the untracked root `roadmap.md` (MH Override Management, Cron Scheduler Admin) — see OI-104/OI-105.
> - **⚠️ The branch has never been pushed.** No upstream is configured and `origin` has only `dev`, `master`, `release/v0.2.0`. All 229 commits exist solely on this machine.
> - **Unfinished on this feature:** `5e66700` is `wip: checkpoint before pill marker redesign` — that redesign was never done. `ground-events.ts` still has AOG as a diamond symbol with BTB/Ferry/MX as pills, the hybrid the checkpoint meant to replace. The commit itself parks no code. Confirm with Jason whether it is still wanted.
>
> **Working preferences (Jason):**
> - **Keep a dev server running** whenever practical — he evaluates live, not from tests. Bring it up while getting oriented and drive it with Playwright. Stop it before `npm install` (it holds `node_modules` open); kill with `fuser -k 3000/tcp`.
> - **Run against a copy of production data**, pulled from the NAS, rather than seed data — seed data is thin and hides real edge cases. Use seed data only when testing seed/import behaviour, and restore afterwards. `npm run db:backup` first, `npm run db:migrate` after (prod is on an older schema).
>
> **What changed (2026-08-06/07 session):**
> - `npm audit fix` — 27 advisories → 3; all criticals/highs cleared (lockfile-only, PATCH per D-028)
> - Repaired type errors in 3 test files that had been failing the build gate since ~Feb — `npm run validate` now exits 0 for the first time on this branch
> - Filed OI-100 → OI-105 for the versioning gaps and unfiled roadmap items
> - Resolved OI-100/101/102 — effective dating applied in the engine, rotation patterns versioned, anchor split from effective date. Suite 673 → 705
>
> **What changed (v0.3.0 — starting, 2026-03-04):**
> - MINOR version bump: v0.2.0 → v0.3.0
> - Staffing shift rotation end date + auto-versioning + archive (OI-080, M022) — **partial, see OI-100**
> - Sub-build tracking via `build.json` + pre-commit hook (OI-087, D-063)
> - Various flight board, dashboard, and mobile/PWA polish fixes
> - Flight event comments + ground event markers (OI-092, OI-093), in-app notifications (OI-094)
>
> **Previous update (v0.2.0 — Universal Import Hub):**
> - Single schema-driven Data Hub, 6-step wizard, 9 pluggable schemas, full Capacity Suite, Phase 4 Mobile-First UX
> - See CHANGELOG.md `[0.2.0]` and `.claude/SPECS/REQ_DataImport.md` for details

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
- **Semantic Versioning (D-028):** Strict semver. PATCH=bugfix, MINOR=new feature (backwards-compatible), MAJOR=breaking change. **Claude Code must stop and notify before implementing any backwards-incompatible change.** See [REQ_Versioning.md](.claude/SPECS/REQ_Versioning.md)

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
- **Bootstrap**: On startup, `instrumentation.ts` → `bootstrap.ts` auto-creates schema, system user, and default config. No manual `db:seed` required for first run (D-035)
- **Self-Registration**: First user → superadmin (no invite code). Subsequent users → admin-gated via invite codes in Admin Settings (D-035)

Full data model → [REQ_DataModel.md](.claude/SPECS/REQ_DataModel.md)

## System Configuration

**`server.config.yml` is the canonical home for all server-side system settings.**

| Setting | Key | Default | Notes |
|---------|-----|---------|-------|
| Site title | `app.title` | `"Dashboard"` | Shown in browser tab, sidebar, login page, nav |
| Password policy | `passwordSecurity.*` | (see file) | Min/max length, character requirements, entropy |

Rules:
- All new system-level settings (non-secret, non-env) go in `server.config.yml`
- Loaded at startup via `src/lib/config/loader.ts` → `loadServerConfig()`
- Exposed to server components via `getAppTitle()`, `getPasswordRequirements()`, etc.
- Exposed to client components via `AppConfigProvider` (context) in `src/components/layout/app-config-provider.tsx`
- `server.config.dev.yml` is the git-tracked dev template; `server.config.yml` is the live file (gitignored in production)
- **Do not use env vars for settings that belong in config** — env vars are for secrets and deployment-specific values only

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
src/app/register/            — Self-registration page (first-user + invite code)
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
src/lib/config/loader.ts     — System config loader (server.config.yml → memory → client via AppConfigProvider)
src/lib/db/                  — SQLite connection, Drizzle schema, seed, seed-analytics, bootstrap
src/lib/data/                — Reader, transformer, engines
src/lib/hooks/               — Zustand stores (filters, customers, prefs)
src/lib/utils/               — Date, format, aircraft-type normalization (D-015), contrast helpers
src/types/                   — TypeScript interfaces
src/middleware.ts            — Route protection (auth + role checks)
src/components/layout/app-config-provider.tsx — Client context for system config (useAppTitle, etc.)
server.config.yml            — Live system config (gitignored; app title, password policy, future settings)
server.config.dev.yml        — Dev template for server.config.yml (git-tracked)
data/                        — dashboard.db + input.json
data/seed/                   — Seed data JSON files (tracked in git)
data/backups/                — Timestamped backups (gitignored)
data/exports/                — Timestamped exports (gitignored)
scripts/db/                  — Database CLI tools (seed, reset, backup, etc.)
public/vendor/fontawesome/   — Self-hosted FA assets
plan/                        — Implementation plans
.claude/                     — Knowledge base (specs, UI, dev docs)
Dockerfile                   — Unified multi-target (prod default + dev target)
docker/                      — Docker resources directory
docker/docker-compose.dev.yml   — Dev compose example
docker/docker-compose.prod.yml  — Prod compose example
docker/.env.example             — Universal env reference (all 7 vars documented)
docker/.env.dev.example         — Pre-filled dev template (cp to .env.local)
docker/.env.prod.example        — Production template with placeholders
docker/README.md                — Authoritative Docker + env + deployment guide
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
| [REQ_Versioning.md](.claude/SPECS/REQ_Versioning.md) | Semver rules, backwards compatibility contract, release procedures (D-028) |

### UI
| File | Purpose |
|------|---------|
| [UI_COMPONENTS.md](.claude/UI/UI_COMPONENTS.md) | Component inventory (shadcn/ui + custom) |
| [UI_ICONS_FontAwesome.md](.claude/UI/UI_ICONS_FontAwesome.md) | FA setup, icon map by feature |
| [UI_FILTER_PATTERNS.md](.claude/UI/UI_FILTER_PATTERNS.md) | Filter component patterns, active pills, mobile sheet |
| [UI_REFERENCE_MAP.md](.claude/UI/UI_REFERENCE_MAP.md) | Reference image analysis — 12 images mapped to specs |
| [UI_MENUS.md](.claude/UI/UI_MENUS.md) | Dropdown, sidebar, admin nav menu patterns |
| [UI_BACKGROUND.md](.claude/UI/UI_BACKGROUND.md) | Background image configuration — enable/disable, customization, performance |

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

- `npm run validate` must exit 0 — runs typecheck → lint → test → build
- `npm run dev` must render all pages without console errors
- See [TEST_PLAN.md](.claude/DEV/TEST_PLAN.md) for full checklist

> **⚠️ Always check the real exit code.** `next build` compiles first and type-checks second, so it can print `✓ Compiled successfully` **and then fail** with `Failed to type check` (exit 1). Piping to `tail`/`head` discards the exit code and makes a red build look green. This masked a broken build gate on this branch for roughly four months. Use `npm run validate; echo $?` or redirect to a file.
>
> **⚠️ vitest does not type-check.** All 673 tests can pass while `tsc --noEmit` fails. Test files are inside `tsconfig.json`'s `include`, so fixture drift (a new required field on a shared type) breaks the build without breaking a single test. When you add a required field to a type in `src/types/`, grep `src/__tests__/` for fixtures of that type.

### WSL / 9p note

This repo lives on `/mnt/d` (a 9p drvfs mount). `npm install` renames package directories, and a rename fails with a misleading `EACCES` if any process holds `node_modules` open — commonly a `tsserver` spawned from the project's own `node_modules`. It is a file lock, not a permission problem. Kill the language server (`ps aux | grep tsserver`) and retry. After moving drives or switching branches, `rm -rf node_modules && npm install` — `better-sqlite3` bindings are path-sensitive.

## Docker & Deployment Verification

**Before any deployment, tag, or release**, run a Docker gap analysis:

1. `docker build -t dtsd .` — prod image builds successfully
2. `docker build --target dev -t dtsd:dev .` — dev image builds successfully
3. `docker compose -f docker/docker-compose.prod.yml up` — container starts and stays healthy
4. Health check passes: `wget -qO- http://localhost:3000/api/health`
5. DB scripts work in container: `docker exec <container> tsx scripts/db/status.ts`
6. Volume mount paths are relative (`./data`, `./server.config.yml`) — not absolute
7. `env_file` paths resolve correctly relative to compose file location
8. No dev dependencies leak into prod image (`docker exec <container> ls node_modules/vitest` should fail)

**Key files:** Root `Dockerfile` (single file, `prod` default + `dev` target), `docker/` (compose examples, env templates, resource files).

See [docker/README.md](docker/README.md) for full Docker usage guide.

## Plan Files

- `.claude/PLAN.md` — **authoritative** implementation plan (PASS 2, D-020)
- `/plan/FINAL-PLAN.md` — prior implementation plan (retained as reference)
- `/plan/PLAN-AMENDMENT-001-FILTER-BAR.md` — FilterBar integration plan (integrated into PLAN.md M2)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
