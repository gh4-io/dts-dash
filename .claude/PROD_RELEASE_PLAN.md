# Production Release Plan — CVG Line Maintenance Dashboard

> **Created:** 2026-02-15
> **Updated:** 2026-02-16
> **Status:** In execution — v0.1.0 release
> **Next target:** v0.1.0 (dev-complete baseline) to `main`

## Context

All 8 development milestones (M0-M8) are complete with zero P0/P1/P2 blockers. The application is feature-complete on the `dev` branch.

**Release philosophy:** Every release to `main` is **stripped to production minimum**. No documentation, no development scaffolding, no resource material, no helper scripts unrelated to application operation. The `dev` branch is never modified by the release process.

**Deployment targets** (future): Docker (primary), bare metal with PM2 (secondary)

## Versioning

| Version | Scope | Branch |
|---------|-------|--------|
| **v0.1.0** | Dev-complete baseline — stripped, as-built from dev | `release/v0.1.0` |
| **v1.0.0** | Production-hardened (Phases 1-5 complete) | `release/v1.0.0` |

---

## Branching Strategy

The `dev` branch is **never modified** by the release process. All release work happens on a release branch cut from `dev` (or from the previous release branch for incremental releases). The release branch is merged to `main` and tagged.

```
dev (untouched) ──> release/v0.1.0 ──> main + tag v0.1.0
                         │
                         └──> release/v1.0.0 ──> main + tag v1.0.0
                               ^ hardening work here
```

**Dev environment guarantee:** No files outside git tracking are touched. No local dev files, databases, configs, or environment files are modified, moved, or deleted. The release branch is a separate working tree of changes — `dev` stays as-is.

---

## Release Stripping Policy

> **Applies to ALL releases.** Every release branch undergoes this stripping process before merge to `main`.

### REMOVE — not shipped

These are deleted on the release branch only. They remain on `dev`.

| Path | Reason |
|------|--------|
| `.claude/` | Knowledge base — specs, plans, decisions, dev docs |
| `plan/` | Implementation plans |
| `docs/` | Documentation site content |
| `CLAUDE.md` | AI operating instructions |
| `scripts/phase_commit.sh` | Dev workflow tool |
| `scripts/feature_intake.sh` | Dev workflow tool |
| `scripts/reset-event-data.mjs` | Dev utility |
| `scripts/reset_event_data.sh` | Dev utility |
| `screenshot.mjs` | Dev screenshot utility |
| `vitest.config.ts` | Test config (no tests shipped) |
| `.prettierrc.json` | Dev formatting config |
| `.prettierignore` | Dev formatting config |
| `data/input.json` | Development test data |

### KEEP — shipped in release

| Path | Reason |
|------|--------|
| `src/` | All application source code |
| `public/` | Static assets (Font Awesome, favicon) |
| `data/seed/` | Seed data for first-run |
| `scripts/db/` | Operational database tools (seed, reset, backup, migrate, etc.) |
| `package.json` | Dependencies and scripts (cleaned — see below) |
| `package-lock.json` | Locked dependency tree |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript configuration |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `eslint.config.mjs` | Linting (build gate) |
| `postcss.config.mjs` | PostCSS / Tailwind |
| `components.json` | shadcn/ui configuration |
| `next-env.d.ts` | Next.js TypeScript declarations |
| `.gitignore` | Git ignore rules |
| `src/middleware.ts` | Route protection (if exists) |

### package.json Cleanup

On the release branch, remove scripts and devDependencies that reference stripped files:

**Remove scripts:**
- `format` (references prettier)
- `format:check` (references prettier)
- `test` (references vitest)
- `test:watch` (references vitest)
- `test:coverage` (references vitest)
- `validate` (references test)
- `db:event-reset` (references stripped `scripts/reset-event-data.mjs`)

**Remove devDependencies:**
- `vitest`
- `@vitejs/plugin-react`
- `@testing-library/jest-dom`
- `@testing-library/react`
- `jsdom`
- `prettier`
- `eslint-config-prettier`
- `puppeteer-core`

**Keep devDependencies** (required for build):
- `typescript`, `@types/*`
- `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`
- `eslint`, `eslint-config-next`
- `drizzle-kit`
- `shadcn`

### Stripping Procedure

Run on the release branch after all release-specific work is complete:

```bash
# 1. Remove directories
git rm -r .claude/ plan/ docs/

# 2. Remove individual files
git rm CLAUDE.md screenshot.mjs vitest.config.ts .prettierrc.json .prettierignore
git rm scripts/phase_commit.sh scripts/feature_intake.sh
git rm scripts/reset-event-data.mjs scripts/reset_event_data.sh
git rm data/input.json

# 3. Clean package.json (manual edit — remove scripts + devDeps listed above)

# 4. Regenerate lock file
npm install

# 5. Verify build
npm run build
npm run lint

# 6. Commit
git add -A
git commit -m "chore(release): strip dev artifacts for vX.Y.Z"
```

---

## v0.1.0 — Dev-Complete Baseline

**Scope:** The application as-built from M0-M8, stripped to production minimum. No hardening, no Docker, no CI/CD. This is the baseline "it works" release.

### v0.1.0 Steps

1. Commit pending `.gitignore` update on `dev`
2. Cut branch: `git checkout -b release/v0.1.0`
3. Run verification gates: `npm run build && npm run lint`
4. Execute stripping procedure (see above)
5. Verify stripped build: `npm run build && npm run lint`
6. Commit strip
7. Merge to `main`: `git checkout main && git merge --no-ff release/v0.1.0`
8. Tag: `git tag -a v0.1.0 -m "v0.1.0: dev-complete baseline"`
9. Push: `git push origin main --tags`

### v0.1.0 Checklist

- [ ] `release/v0.1.0` branch created from `dev`
- [ ] `.claude/`, `plan/`, `docs/` directories removed
- [ ] All individual dev files removed (see strip list)
- [ ] `package.json` scripts cleaned (no references to stripped files)
- [ ] `package.json` devDependencies pruned (no test/format/screenshot deps)
- [ ] `npm run build` passes on stripped branch
- [ ] `npm run lint` passes on stripped branch
- [ ] `dev` branch is completely untouched
- [ ] No untracked or gitignored files were affected
- [ ] Merged to `main` with `--no-ff`
- [ ] Tagged `v0.1.0`
- [ ] Pushed to origin

---

## v1.0.0 — Production Hardened

**Scope:** Security hardening, infrastructure, observability, CI/CD. All 5 phases below are completed on `release/v1.0.0` (cut from `release/v0.1.0` or `main`), then stripped and merged to `main`.

> The phase details below are unchanged from the original plan. They are executed on the release branch, and the stripping policy is applied before final merge.

---

## Phase 1: Security Hardening

**Priority**: CRITICAL — blocks all deployment

### 1.1 Create `.env.example` + AUTH_SECRET validation (S)
- Create `.env.example` documenting all env vars (AUTH_SECRET, AUTH_URL, DATABASE_PATH, INITIAL_ADMIN_EMAIL/PASSWORD, NODE_ENV, ENABLE_SEED_ENDPOINT)
- Create `src/lib/utils/env-check.ts` — validates AUTH_SECRET is 32+ chars and not the dev default in production
- Add `"generate-secret"` npm script
- **Modify**: `src/lib/auth.ts`, `package.json`

### 1.2 Externalize seed credentials (M)
- **Modify** `src/lib/db/seed.ts` — read `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` from env. In production with no env vars, skip user seeding. Remove hardcoded `admin123`/`user123`
- **Create** `src/app/setup/page.tsx` + `src/app/api/setup/route.ts` — first-run setup wizard, only works when 0 users exist. Returns 403 after initial admin created
- Depends on 1.3 (password complexity) for setup validation

### 1.3 Add password complexity requirements (S)
- **Create** `src/lib/utils/password-validation.ts` — min 12 chars, upper+lower+digit+special, common password blocklist
- **Modify**: `src/app/api/account/password/route.ts`, `src/app/api/admin/users/route.ts`, setup API (1.2)

### 1.4 Create middleware.ts (M)
- **Create** `src/middleware.ts` — centralized route protection:
  - **Public**: `/login`, `/setup`, `/api/auth/*`, `/api/ingest`, `/api/health`, `/_next/*`, `/vendor/*`, `/favicon.ico`
  - **Authenticated** (any role): all data pages + APIs
  - **Admin** (admin|superadmin): `/admin/*`, `/api/admin/*`, `/api/config` PUT
- Extract client IP (X-Forwarded-For) for rate limiting

### 1.5 Add login rate limiting (M)
- **Create** `src/lib/utils/login-rate-limit.ts` — track by IP+email, 5 failed attempts in 15 min = 15 min lockout
- **Modify** `src/lib/auth.ts` — check rate limit in `authorize` before password comparison
- In-memory store (documented as known limitation for single-process)

### 1.6 Switch JWT to DB-backed sessions (L)
- **Modify** `src/lib/auth.ts` — switch `strategy: "jwt"` to `strategy: "database"`, configure Drizzle adapter
- **Modify** `src/lib/db/schema.ts` — adjust `sessions` table for Auth.js adapter (add `sessionToken` column)
- **Modify** `src/lib/db/seed.ts` — update CREATE TABLE for sessions
- **Create** `src/types/next-auth.d.ts` — module augmentation for session types

### 1.7 Fix password change session revocation (S)
- **Modify** `src/app/api/account/password/route.ts` — bug: `ne(sessions.id, session.user.id)` compares session ID to user ID (always false). Fix to exclude current session by actual sessionToken
- Also fix account enumeration: unify error messages for wrong-password and user-not-found

### 1.8 Add security headers (M)
- **Modify** `next.config.ts` — add `headers()`: CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, HSTS, Permissions-Policy
- CSP needs `unsafe-eval` (ECharts) and `unsafe-inline` (next-themes, Tailwind)
- **Modify** `src/middleware.ts` — append headers to API responses

### 1.9 Harden seed endpoint (S)
- **Modify** `src/app/api/seed/route.ts` — require `ENABLE_SEED_ENDPOINT=true` env var. Returns 404 when disabled. In production still requires superadmin auth

### Phase 1 Checklist

- [ ] `.env.example` created with all variables documented
- [ ] `npm run generate-secret` outputs a cryptographically strong 32+ char string
- [ ] App refuses to start in production with weak AUTH_SECRET
- [ ] `grep -r "admin123\|user123" src/` returns 0 matches
- [ ] `/setup` page works when 0 users exist, returns 403 after initial admin created
- [ ] Passwords require 12+ chars, upper, lower, digit, special character
- [ ] Unauthenticated requests to `/dashboard` redirect to `/login`
- [ ] Requests to `/api/admin/*` from non-admin users get 403
- [ ] `/login`, `/api/auth/*`, `/api/ingest`, `/api/health` accessible without session
- [ ] After 5 failed logins, further attempts blocked for 15 minutes
- [ ] Login creates a row in `sessions` table
- [ ] Logout deletes the session row
- [ ] Password change invalidates all OTHER sessions (not current)
- [ ] Role changes take effect immediately (no JWT stale cache)
- [ ] Password change returns identical error for wrong-password and user-not-found
- [ ] `curl -I localhost:3000` shows CSP, X-Frame-Options, X-Content-Type-Options, HSTS headers
- [ ] ECharts Gantt still renders correctly with CSP active
- [ ] next-themes FOUC prevention still works
- [ ] Font Awesome loads correctly
- [ ] Seed endpoint returns 404 without `ENABLE_SEED_ENDPOINT=true`
- [ ] `npm run build` passes
- [ ] `npm run lint` is clean

---

## Phase 2: Infrastructure & Deployment

**Priority**: HIGH — needed for any deployment
**Depends on**: Phase 1 complete

### 2.1 Configurable database path (S)
- **Modify** `src/lib/db/client.ts` — use `process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'dashboard.db')`

### 2.2 Node.js engines constraint (S)
- **Modify** `package.json` — add `"engines": { "node": ">=20.0.0" }`

### 2.3 Health check endpoint (M)
- **Create** `src/app/api/health/route.ts` — no auth, returns `{ status, version, checks: { database, dataFile }, uptime }`. Returns 503 if DB unreachable. No sensitive data.

### 2.4 Dockerfile — multi-stage (L)
- **Create** `Dockerfile` — 3 stages: deps (Alpine + build tools for better-sqlite3), builder (next build), runner (standalone output, non-root user, port 3000)
- **Modify** `next.config.ts` — add `output: "standalone"`

### 2.5 docker-compose.yml + .dockerignore (S)
- **Create** `docker-compose.yml` — volume `./data:/app/data`, env_file, healthcheck via `/api/health`
- **Create** `.dockerignore` — node_modules, .next, data/, .env*, .git

### 2.6 PM2 ecosystem config (S)
- **Create** `ecosystem.config.js` — fork mode (SQLite single-writer), 512M restart limit, logs in `./logs/`

### Phase 2 Checklist

- [ ] `DATABASE_PATH` env var overrides default DB location
- [ ] Default behavior unchanged when `DATABASE_PATH` unset
- [ ] `package.json` has `"engines": { "node": ">=20.0.0" }`
- [ ] `GET /api/health` returns 200 with status when healthy
- [ ] `GET /api/health` returns 503 when DB is down
- [ ] Health check responds in < 100ms
- [ ] Health check requires no authentication
- [ ] `docker build -t cvg-dashboard .` succeeds
- [ ] `docker run -p 3000:3000 -v ./data:/app/data --env-file .env cvg-dashboard` starts and serves the app
- [ ] better-sqlite3 native bindings work in Alpine Linux container
- [ ] Docker image size < 300MB
- [ ] SQLite data persists across `docker compose down && docker compose up`
- [ ] Docker healthcheck passes within 15 seconds of startup
- [ ] `next.config.ts` has `output: "standalone"`
- [ ] `pm2 start ecosystem.config.js --env production` starts the app
- [ ] PM2 auto-restarts on crash
- [ ] `npm run build` passes
- [ ] `npm run lint` is clean

---

## Phase 3: Observability & Operations

**Priority**: MEDIUM — important for production operations
**Depends on**: Phase 2 complete

### 3.1 Structured logging with pino (L)
- Install `pino` + `pino-pretty` (dev)
- **Create** `src/lib/logger.ts` — pino instance, child logger factory, JSON in prod / pretty in dev
- **Modify** ~25 server-side files — replace `console.error/warn/log` with logger calls
- Client-side components keep `console.*` (pino is server-only)

### 3.2 Graceful shutdown (S)
- **Modify** `src/lib/db/client.ts` — SIGTERM/SIGINT handlers to close SQLite connection

### 3.3 Error tracking integration point (S)
- **Create** `src/lib/error-tracking.ts` — `captureException(error, context)` abstraction. Default: pino. With `SENTRY_DSN`: forwards to Sentry. Optional dependency.

### 3.4 Database backup script (M)
- **Create** `scripts/backup-db.sh` — `sqlite3 .backup` (WAL-safe), timestamped filenames, configurable retention (default 7), cron-compatible

### Phase 3 Checklist

- [ ] `pino` and `pino-pretty` installed
- [ ] `src/lib/logger.ts` exists with child logger factory
- [ ] All server-side `console.error/warn/log` replaced with logger calls
- [ ] Server logs output JSON in production
- [ ] Server logs output pretty-printed in development
- [ ] `docker stop` triggers clean DB close (no WAL corruption)
- [ ] `kill -TERM <pid>` cleanly shuts down on bare metal
- [ ] `src/lib/error-tracking.ts` exists and works without Sentry installed
- [ ] With `SENTRY_DSN` set, errors forward to Sentry
- [ ] `scripts/backup-db.sh` creates a valid SQLite backup
- [ ] `sqlite3 <backup> "PRAGMA integrity_check"` passes
- [ ] Old backups pruned per retention policy
- [ ] `npm run build` passes
- [ ] `npm run lint` is clean

---

## Phase 4: CI/CD & Quality Gates

**Priority**: MEDIUM — ensures ongoing quality
**Depends on**: Phase 1 complete, Phase 2 partial (Dockerfile exists)

### 4.1 CI workflow (M)
- **Create** `.github/workflows/ci.yml` — on PR/push to main/dev: npm ci, lint, typecheck, build, npm audit

### 4.2 CD workflow (M)
- **Create** `.github/workflows/deploy.yml` — on push to main/tags: Docker build + push to GHCR, tagged latest + SHA

### 4.3 Pre-commit hooks (S, optional)
- Install husky + lint-staged, eslint --fix on staged files

### Phase 4 Checklist

- [ ] `.github/workflows/ci.yml` exists
- [ ] PR to main/dev triggers lint + typecheck + build + audit
- [ ] Failed CI blocks merge (branch protection configured)
- [ ] `.github/workflows/deploy.yml` exists
- [ ] Merge to main triggers Docker image push to GHCR
- [ ] Image tagged with `latest` and commit SHA
- [ ] `npm run audit` script exists in package.json
- [ ] (Optional) Pre-commit hooks run lint on staged files

---

## Phase 5: Documentation & Handoff

**Priority**: MEDIUM — needed for anyone operating the system
**Depends on**: Phases 1-4 complete

> Note: Documentation created during hardening lives on the release branch and is stripped per policy before merge. Operational docs (DEPLOYMENT.md, BACKUP.md, MONITORING.md) are an exception — they ship if they exist at release time. The stripping policy can be amended per-release if specific docs are deemed operational.

### 5.1 Deployment guide — `docs/DEPLOYMENT.md` (M)
- Docker step-by-step, bare metal step-by-step, env var reference, first-run setup, reverse proxy (nginx/Caddy + HTTPS), upgrade procedure

### 5.2 Backup procedures — `docs/BACKUP.md` (S)
- What to back up, script usage, cron setup, restore procedure

### 5.3 Monitoring runbook — `docs/MONITORING.md` (S)
- Health check usage, log analysis, alert conditions, incident response

### Phase 5 Checklist

- [ ] `docs/DEPLOYMENT.md` — a new team member can deploy using only this guide
- [ ] `docs/BACKUP.md` — backup and restore tested end-to-end
- [ ] `docs/MONITORING.md` — covers top 5 failure scenarios

---

## Release Checklist — v1.0.0 (Final Gate)

This checklist is completed **after all 5 phases** and **after stripping** before merging `release/v1.0.0` to `main`:

### Security
- [ ] No hardcoded credentials in codebase (`grep -r "admin123\|user123\|dev-secret" src/`)
- [ ] AUTH_SECRET is strong (32+ chars, random)
- [ ] Middleware enforces auth on all protected routes
- [ ] DB sessions working (login creates row, logout deletes, password change revokes others)
- [ ] Login rate limiting active
- [ ] Security headers present on all responses
- [ ] Seed endpoint disabled by default
- [ ] Password complexity enforced (12+ chars, mixed)
- [ ] No account enumeration via error messages

### Infrastructure
- [ ] `docker build` succeeds
- [ ] `docker compose up` starts healthy app in < 15s
- [ ] Data persists across container restarts
- [ ] Health check returns 200 at `/api/health`
- [ ] PM2 config works for bare metal deployment
- [ ] Database path configurable via env var

### Observability
- [ ] Structured JSON logs in production
- [ ] Graceful shutdown on SIGTERM
- [ ] Backup script creates valid copies
- [ ] Error tracking integration point functional

### CI/CD
- [ ] CI pipeline runs on PRs
- [ ] CD pipeline builds and pushes Docker images
- [ ] npm audit passes with no high-severity vulnerabilities

### Build Gates
- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] All 3 views functional (Flight Board, Dashboard, Capacity)
- [ ] Auth flow works end-to-end (login, protected routes, admin routes, logout)
- [ ] Data import works (file upload + paste JSON)
- [ ] All 11 theme presets render correctly in light and dark modes
- [ ] Release stripping policy applied
- [ ] No dev artifacts remain on release branch

---

## New Decisions

| ID | Decision |
|----|----------|
| D-025 | Production security hardening scope and approach |
| D-026 | Docker primary + PM2 secondary deployment targets |
| D-027 | DB-backed sessions replace JWT |
| D-028 | pino for structured logging, optional Sentry integration |
| D-029 | GitHub Actions CI/CD with GHCR |

## New Risks

| ID | Risk | Mitigation |
|----|------|-----------|
| R-22 | better-sqlite3 fails to compile in Alpine Docker | Test early; fallback to debian-slim base |
| R-23 | Auth.js v5 Drizzle adapter schema mismatch | Careful schema alignment; test login immediately |
| R-24 | In-memory rate limiters reset on restart | Document limitation; acceptable for single-process |
| R-25 | CSP headers break ECharts canvas rendering | Test with `unsafe-eval`; tighten later with nonces |

## Execution Order

```
v0.1.0 (immediate)
  dev ──> release/v0.1.0 ──> strip ──> main + tag v0.1.0

v1.0.0 (future)
  main (or dev) ──> release/v1.0.0

  Phase 1 (Security) ─ CRITICAL, blocks all deployment
    1.1 .env.example + AUTH_SECRET validation     (S)
    1.3 Password complexity                        (S)
    1.4 Middleware.ts                               (M)
    1.5 Login rate limiting                         (M)
    1.9 Harden seed endpoint                        (S)
    1.2 Externalize seed credentials                (M, needs 1.1 + 1.3)
    1.8 Security headers                            (M, needs 1.4)
    1.6 DB sessions                                 (L, needs 1.4)
    1.7 Fix session revocation + enumeration        (S, needs 1.6)

  Phase 2 (Infrastructure) ─ needs Phase 1
    2.1 Configurable DB path       (S)
    2.2 Engines constraint         (S)
    2.3 Health check endpoint      (M)
    2.4 Dockerfile                 (L, needs 2.1)
    2.5 docker-compose + ignore    (S, needs 2.4)
    2.6 PM2 config                 (S)

  Phase 3 (Observability) ─ needs Phase 2
    3.1 Structured logging         (L)
    3.2 Graceful shutdown          (S)
    3.3 Error tracking             (S, needs 3.1)
    3.4 Backup script              (M, needs 2.1)

  Phase 4 (CI/CD) ─ needs Phase 1 + 2 partial
    4.1 CI workflow                (M)
    4.2 CD workflow                (M, needs 2.4)
    4.3 Pre-commit hooks           (S, optional)

  Phase 5 (Documentation) ─ needs Phases 1-4
    5.1 Deployment guide           (M)
    5.2 Backup procedures          (S)
    5.3 Monitoring runbook         (S)

  ── strip ──> merge to main + tag v1.0.0
```

## Files Summary

**v0.1.0**: No new files. Only removals (stripping) + package.json cleanup.

**v1.0.0 new files (~18)**: `.env.example`, `src/middleware.ts`, `src/lib/utils/env-check.ts`, `src/lib/utils/password-validation.ts`, `src/lib/utils/login-rate-limit.ts`, `src/lib/logger.ts`, `src/lib/error-tracking.ts`, `src/types/next-auth.d.ts`, `src/app/setup/page.tsx`, `src/app/api/setup/route.ts`, `src/app/api/health/route.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `ecosystem.config.js`, `scripts/backup-db.sh`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**v1.0.0 key files to modify**: `src/lib/auth.ts`, `src/lib/db/client.ts`, `src/lib/db/schema.ts`, `src/lib/db/seed.ts`, `src/app/api/account/password/route.ts`, `next.config.ts`, `package.json`, `src/app/api/seed/route.ts`, ~25 server files (logging migration)
