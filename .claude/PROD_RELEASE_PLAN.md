# Production Release Plan — CVG Line Maintenance Dashboard

> **Created:** 2026-02-15
> **Status:** Draft — not yet in execution
> **Target:** v1.0.0 release to `main`

## Context

All 8 development milestones (M0-M8) are complete with zero P0/P1/P2 blockers. The application is feature-complete but has significant gaps between "dev-complete" and "production-ready" across security, infrastructure, and operations.

**Deployment targets**: Docker (primary), bare metal with PM2 (secondary)

## Branching Strategy

The `dev` branch remains as-is — no production hardening work touches it.

All production readiness work is done on a **release branch** (e.g., `release/v1.0.0`) cut from `dev`, then merged to `main` when complete. Tagging follows semver: `v1.0.0`.

```
dev (frozen) ──> release/v1.0.0 ──> main (production)
                  ^ all work here     ^ merge + tag
```

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
- **Create** `.dockerignore` — node_modules, .next, data/, .env*, .git, .claude/, plan/

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
- Install husky + lint-staged, eslint --fix + prettier on staged files

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

### 5.1 Deployment guide — `docs/DEPLOYMENT.md` (M)
- Docker step-by-step, bare metal step-by-step, env var reference, first-run setup, reverse proxy (nginx/Caddy + HTTPS), upgrade procedure

### 5.2 Backup procedures — `docs/BACKUP.md` (S)
- What to back up, script usage, cron setup, restore procedure

### 5.3 Monitoring runbook — `docs/MONITORING.md` (S)
- Health check usage, log analysis, alert conditions, incident response

### 5.4 Update project docs (S)
- `.claude/ROADMAP.md` — add M9: Production Readiness
- `.claude/DECISIONS.md` — add D-025 through D-029
- `.claude/OPEN_ITEMS.md` — add OI-034+ for production items
- `.claude/DEV/RISKS.md` — add R-22 through R-25

### Phase 5 Checklist

- [ ] `docs/DEPLOYMENT.md` — a new team member can deploy using only this guide
- [ ] `docs/BACKUP.md` — backup and restore tested end-to-end
- [ ] `docs/MONITORING.md` — covers top 5 failure scenarios
- [ ] `.claude/ROADMAP.md` updated with M9
- [ ] `.claude/DECISIONS.md` updated with D-025 through D-029
- [ ] `.claude/OPEN_ITEMS.md` updated with production items
- [ ] `.claude/DEV/RISKS.md` updated with R-22 through R-25

---

## Release Checklist (Final Gate)

This checklist is completed **after all 5 phases** before merging `release/v1.0.0` to `main`:

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

### Documentation
- [ ] Deployment guide complete and tested
- [ ] Backup/restore procedures documented
- [ ] Monitoring runbook written
- [ ] Project knowledge base updated

### Build Gates
- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] `npm run dev` — all pages render without console errors
- [ ] All 3 views functional (Flight Board, Dashboard, Capacity)
- [ ] Auth flow works end-to-end (login, protected routes, admin routes, logout)
- [ ] Data import works (file upload + paste JSON)
- [ ] All 11 theme presets render correctly in light and dark modes

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
dev (frozen) ──> release/v1.0.0 ──> main + tag v1.0.0

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
  5.4 Project docs update        (S)

── Release Checklist (final gate) ──> merge to main + tag v1.0.0
```

## Files Summary

**New files (~18)**: `.env.example`, `src/middleware.ts`, `src/lib/utils/env-check.ts`, `src/lib/utils/password-validation.ts`, `src/lib/utils/login-rate-limit.ts`, `src/lib/logger.ts`, `src/lib/error-tracking.ts`, `src/types/next-auth.d.ts`, `src/app/setup/page.tsx`, `src/app/api/setup/route.ts`, `src/app/api/health/route.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `ecosystem.config.js`, `scripts/backup-db.sh`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Key files to modify**: `src/lib/auth.ts`, `src/lib/db/client.ts`, `src/lib/db/schema.ts`, `src/lib/db/seed.ts`, `src/app/api/account/password/route.ts`, `next.config.ts`, `package.json`, `src/app/api/seed/route.ts`, ~25 server files (logging migration)
