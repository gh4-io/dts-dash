# CLAUDE.md — CVG Line Maintenance Operations Dashboard

> Canonical operating manual for Claude Code. Read this first, every session.
> Detailed specs live in `.claude/` — this file links to them, never duplicates.
>
> **Last updated:** 2026-08-12 (v1.0.0 RELEASED and deployed)
>
> **🔶 CURRENT STATE — READ BEFORE PLANNING WORK:**
> - **v1.0.0 is released and running in production.** Merged to `master` via PR #1 (`70219ee`),
>   tagged `v1.0.0`, GitHub Release published. **v0.3.0 was never released** and no tag for it ever
>   existed; its CHANGELOG entry is folded into `[1.0.0]`, so the release boundary question is closed.
> - **⚠️ `dev`'s `package.json` still says `0.3.0` while production runs `1.0.0`.** The old rule was
>   "the version is bumped on the release branch only (D-028), and `dev` realigns by merging `master`
>   back" — but merging `master` into `dev` is forbidden (see below), so that realignment can never
>   happen and `dev` is stranded *below* production. Decide whether to bump `dev` to `1.0.0`; until
>   then, do not trust `dev`'s version number for anything.
> - **Deployment is Portainer + Git (GitOps), not a local image.** The stack is defined in the
>   separate `container-gitops` repo at `stacks/dts-dash/docker-compose.yaml`; images come from
>   `ghcr.io/gh4-io/dts-dash`, built by `.github/workflows/deploy.yml` on any `v*` tag push. Host
>   data lives at `/volume2/docker/dts-dash-1/`; `/volume2/docker/dts-dash/` is the frozen v0.2.0
>   deployment kept as rollback. See [[prod-deployment-access]].
> - **⚠️ `master` and `dev` have NO common ancestor.** `master` is a 3-commit, orphan-rooted,
>   *stripped* production baseline (548 files vs dev's 774 — no `.claude/`, no `CLAUDE.md`, no tests,
>   no dev deps). A release is one squashed stripped commit on top of it. **Never `git merge master`
>   into `dev`** — REQ_Versioning's v1.0.0 addendum says to, and it would delete the knowledge base,
>   plans and tests from `dev`. It is also why release-branch fixes must be **back-ported to `dev` by
>   hand**; nothing merges back on its own.
> - **Production runs `1.0.0`** (build 267), upgraded from `0.2.0-rc1` on 2026-08-12. The
>   `v0.2.0-rc1` tag is now pushed to `origin`, so the previously-deployed build is reproducible.
>   Its schema predated OI-080 entirely — no `rotation_end_date`, no shift history, no
>   `flight_comments` or `notifications` tables — and `db:upgrade-v1` applied 36 changes to reach
>   `1.0.0`, verified row-for-row against a pre-upgrade snapshot.
> - **`npm run db:upgrade-v1` is mandatory and is the only upgrade path.** It is verified from every
>   released schema (v0.1.0, v0.1.1, v0.2.0, v0.2.0-rc1) and is idempotent. The app now **refuses to
>   boot** against an un-upgraded database rather than silently serving blank work-package
>   identifiers — `assertSchemaCompatible()` in `bootstrap.ts` (OI-139).
> - **Capacity has ONE engine** (D-064, OI-115). The legacy `headcount × 6.5` model and its Admin → Settings fields were deleted — they had no live consumers but were still editable, so configuring them silently did nothing. Capacity is `capacity_assumptions` (paidToAvailable × availableToProductive) + `capacity_shifts`. The old "Real capacity: headcount × 6.5 MH/person" rule is superseded.
> - **Effective dating works end to end.** OI-100/101/102 resolved, plus OI-107 (the edit dialog was still rewriting history via `PUT`) and OI-108 (two versions of one shift effective at once, double-counting the roster).
> - `dev` is pushed and current on `origin`. `origin` carries `dev`, `master` and `release/v1.0.0`,
>   plus tags through `v1.0.0`. The release branch is **retained deliberately** for patch work.
> - **Production data is clean of the OI-108 defect** — the duplicate `13SMD` rows were corrected on
>   2026-08-06. The 2026-08-09 snapshot has 6 shifts, 6 lineages, zero overlapping active versions.
> - **The pill-marker redesign is CANCELLED, not pending.** The AOG diamond with BTB/Ferry/MX pills in
>   `ground-events.ts` is the intended design. `5e66700` (`wip: checkpoint before pill marker
>   redesign`) parks no code and needs no follow-up.
>
> **⚠️ WSL / 9p trap — Turbopack file watching does NOT fire on `/mnt/d`.** HMR silently serves stale markup; edits appear to do nothing. **Restart the dev server after every change** or you will verify the wrong build. This is separate from the `npm install` EACCES issue below.
>
> **Working preferences (Jason):**
> - **Keep a dev server running** whenever practical — he evaluates live, not from tests. Bring it up while getting oriented and drive it with Playwright. Stop it before `npm install` (it holds `node_modules` open); kill with `fuser -k 3000/tcp`.
> - **Run against a copy of production data**, pulled from the NAS, rather than seed data — seed data is thin and hides real edge cases. Use seed data only when testing seed/import behaviour, and restore afterwards. `npm run db:backup` first, `npm run db:migrate` after (prod is on an older schema).
>
> **What changed (2026-08-12 session — v1.0.0 SHIPPED to production):**
> - Published the release: pushed `v0.2.0-rc1` + `release/v1.0.0`, merged PR #1 to `master`, tagged
>   `v1.0.0`, GitHub Release created. `deploy.yml` built and pushed `ghcr.io/gh4-io/dts-dash:1.0.0`
>   / `:1.0` / `:latest` — its **first ever run**, since no `v*` tag had reached `origin` before
> - Migrated production: 36 changes, 10,231 work packages and 10 users unchanged, `messages`
>   reconciled exactly (3/5/2 from feedback_posts/labels/post_labels), 6 shift lineages, integrity
>   and FK checks clean, re-run idempotent. **`/feedback/4` → `/feedback/1`** on this database
> - Rebuilt the deployment: new folder `/volume2/docker/dts-dash-1/`, config regenerated from
>   `server.config.prod.yml` (was dev-derived — `debug` logging and 8-char passwords on a public URL),
>   secret moved out of YAML into `_secrets/dts-dash.env`
> - **OI-141 filed** — `/login` ignores `app.title`/`app.subtitle` because it is statically prerendered
>
> **Traps found deploying v1.0.0 — read before the next release:**
> - **Renaming a stack in Portainer redeploys it.** A container believed stopped was back up within
>   the minute, making a "clean" database copy a live one.
> - **The app does not checkpoint SQLite on shutdown.** After a clean exit-0 stop the `-wal` was still
>   3.4 MB and the `.db` file was hours stale. **Always copy `.db` + `-wal` + `-shm` together** and
>   `PRAGMA wal_checkpoint(TRUNCATE)` the copy, or the backup silently loses recent writes.
> - **The config file must be group-readable by gid 1001.** The container runs uid/gid 1001
>   (`plexserver:fast-data`); a `640 guru:admin` config gave `Permission denied` and would have
>   silently fallen back to built-in defaults. `chgrp fast-data`.
> - **`env_file` values are not available for Compose-time interpolation.** `APP_VERSION` set only in
>   the env file left `${APP_VERSION:-latest}` resolving to `latest`. Compose-time vars belong in
>   Portainer's stack environment section.
> - **Watchtower monitors every container on the NAS** (daily, no `WATCHTOWER_LABEL_ENABLE`). Harmless
>   while the image was local; moving to GHCR made it able to auto-update production overnight. The
>   stack now carries `com.centurylinklabs.watchtower.enable=false`.
> - **`deploy.yml` triggers on `v*`, which includes RC tags.** Pushing `v0.2.0-rc1` kicked off a build.
> - **`upgrade-to-v1.ts` prompts interactively** — pass `--yes` for non-interactive runs.
>
> **What changed (2026-08-09 session — v1.0.0 release prep):**
> - Cut `release/v1.0.0`: stripped tree on `master`'s history, CHANGELOG collapsed to `[1.0.0]` with
>   a Migration Guide, dead `v0.3.0` compare links repointed at `v0.2.0`
> - **OI-139** — the upgrade path was unusable from *any* prior release: `createTables()` threw on
>   pre-v1.0.0 databases (index on a column `CREATE TABLE IF NOT EXISTS` never added), taking
>   `db:migrate`, the snapshot restore and app startup with it; `--dry-run` failed on every database
>   it exists to preview. Guarded, plus `assertSchemaCompatible()` so the app fails loud instead of
>   serving wrong data
> - **OI-140** — pre-v1.0.0 `/feedback/[id]` links resolve via `messages.legacy_id` and 308 to the
>   canonical URL; real "Post not found" page. The remap is **database-specific** (prod: 4/5/6 → 1/2/3,
>   not the CHANGELOG's dev-database 49/50/51)
> - Docker gate found three more: nine test files outside `src/__tests__` broke the prod image build;
>   the healthcheck used `localhost`, which resolves to `::1` first and left the container permanently
>   `unhealthy`; compose volumes resolved to `docker/data` rather than `data/`
> - Production rehearsal passed on a real snapshot — 10,133 work packages, messages reconciled exactly,
>   rollback proven. Suite 936 → 950
>
> **What changed (2026-08-07 session):**
> - Removed the dead legacy capacity engine + its misleading Admin → Settings fields (OI-115, D-064)
> - Fixed four capacity defects found against production data: OI-107 (edits rewrote history), OI-108 (overlapping versions double-counted), OI-109 (matrix headcount silently discounted), OI-110 (paid/available/productive chain collapsed, understating Paid MH ~11%)
> - Documented the productivity chain in the UI + click-to-edit percentages (OI-116)
> - Responsive fixes: matrix clipped columns (OI-112), panel priority (OI-114)
> - Added `.claude/skills/prod-db-snapshot/` for pulling/restoring production data
> - Suite 705 → 714; `npm run validate` exits 0
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
- **Real capacity**: ~~headcount × 6.5 MH/person~~ — **superseded by D-064**. Productive MH = `headcount × paidHours × paidToAvailable × availableToProductive [× nightFactor]`, from `capacity_assumptions`
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
| [prod-db-snapshot/](.claude/SKILLS/prod-db-snapshot/SKILL.md) | Pull a production DB snapshot and restore it into dev (invocable skill) |

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
