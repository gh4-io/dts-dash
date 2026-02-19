# Production Release Plan — CVG Line Maintenance Dashboard

> **Created:** 2026-02-15
> **Updated:** 2026-02-16
> **Status:** v0.1.0 RELEASED — published to `master` as orphan commit `3f8220e`
> **Versioning:** See [REQ_Versioning.md](SPECS/REQ_Versioning.md) for semver rules, backwards compatibility contract, and release procedures (D-028)

## Context

All 8 development milestones (M0-M8) and 5 production hardening phases are complete. v0.1.0 is published to `master` with GitHub Release and tag. Future releases follow the incremental PR-to-master pattern documented below and the versioning rules in REQ_Versioning.md.

**Release philosophy:** Every release to `master` is **stripped to production minimum**. No documentation, no development scaffolding, no resource material, no helper scripts unrelated to application operation. The `dev` branch is never modified by the release process.

**Deployment targets**: Docker (primary), bare metal with PM2 (secondary)

---

## Branching Strategy

All development and production hardening work happens on `dev`. The `dev` branch is **never modified** by the release process.

### v0.1.0 — Initial Release (orphan commit)

The first release establishes `master` as a clean baseline with **no commit history**. It is published as a single orphan commit (no parent) containing only the final stripped tree.

```
dev (all work here) ──> release/v0.1.0 ──> strip ──> orphan commit ──> master + tag v0.1.0
```

**v0.1.0 publish procedure** (after stripping is complete on the release branch):
```bash
# From dev — no checkout needed
TREE=$(git rev-parse release/v0.1.0^{tree})
COMMIT=$(git commit-tree "$TREE" -m "v0.1.0: production-ready release")
git branch -f master "$COMMIT"
git tag -f -a v0.1.0 "$COMMIT" -m "v0.1.0: production-ready release"
git push origin master --force-with-lease
git push origin v0.1.0 --force

# Create GitHub Release with manual notes (no prior tags to auto-generate from)
gh release create v0.1.0 --title "v0.1.0" --notes-file RELEASE_NOTES.md
# (or --generate-notes for auto-generated, or --notes "inline notes")
```

### Future Releases (v0.2.0+) — PR to master

After v0.1.0 establishes the baseline, all subsequent releases are **incremental updates via PR to `master`**. Only the specific changes for that release are included — no full re-strip required.

```
master (production baseline)
  └── release/v0.2.0 (branched from master)
        ├── cherry-pick or apply targeted changes from dev
        ├── strip any new dev artifacts if brought over
        └── PR to master ──> review ──> merge ──> tag v0.2.0
```

**Future release procedure:**
```bash
# 1. Branch from master
git checkout master
git checkout -b release/vX.Y.Z

# 2. Apply only the targeted changes from dev
#    Options: cherry-pick, diff/patch, or manual apply
git cherry-pick <commit-hash>        # specific commits
# or: git diff dev -- src/path | git apply   # specific files

# 3. Strip any dev artifacts that came along (if cherry-picking brought any)
# 4. Verify: npm run build && npm run lint
# 5. Docker gap analysis (see CLAUDE.md "Docker & Deployment Verification")
#    docker build -t dtsd . && docker run --rm -p 3000:3000 dtsd

# 5. Push and create PR
git push origin release/vX.Y.Z
gh pr create --base master --title "release: vX.Y.Z" --body "..."

# 6. After PR review and merge — tag and create GitHub Release
git checkout master && git pull
git tag -a vX.Y.Z -m "vX.Y.Z: <release description>"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes
```

This gives full PR review capability — the diff shows only what changed since the last release.

### GitHub Releases & Tags

Every version tag gets a corresponding **GitHub Release** with release notes. This provides a public changelog, downloadable source archives, and a clear history of production changes.

**Release types:**
- **Production release** (`v0.1.0`) — `gh release create v0.1.0 --title "v0.1.0" --generate-notes`
- **Pre-release / RC** (`v0.1.0-rc.1`) — `gh release create v0.1.0-rc.1 --prerelease --title "v0.1.0-rc.1" --generate-notes`

**Auto-generated notes** (`--generate-notes`) pull from PR titles and commit messages since the last tag. For the v0.1.0 initial release, write manual notes summarizing the feature set.

**Tag convention:** semver with `v` prefix — `v0.1.0`, `v0.2.0`, `v1.0.0`. Pre-releases: `v0.1.0-rc.1`, `v0.1.0-rc.2`.

### Branch Protection

After v0.1.0 is published, enable branch protection on `master`:

```bash
gh api repos/{owner}/{repo}/branches/master/protection -X PUT -f \
  required_pull_request_reviews.required_approving_review_count=0 \
  enforce_admins=false \
  restrictions=null \
  required_status_checks=null
```

- Require PRs (no direct push) for all future releases
- Status checks enforced once CI is active (Phase 4)
- Admins can bypass for the v0.1.0 orphan push only

### Dev environment guarantee

No files outside git tracking are touched. No local dev files, databases, configs, or environment files are modified, moved, or deleted. Release branches are a separate working tree — `dev` stays as-is.

---

## Release Stripping Policy

> **Applies to v0.1.0 (full strip).** Future releases branch from `master` and only bring targeted changes — no full strip needed. The lists below define what belongs in production vs. what stays on `dev` only.

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
| `.env.example` | Environment variable documentation |
| `Dockerfile` | Unified container build (prod default + dev target) |
| `docker/` | Compose examples, env templates, Docker resources |
| `.dockerignore` | Docker build exclusions |
| `ecosystem.config.js` | PM2 process manager config |
| `.github/workflows/` | CI/CD pipelines |
| `README.md` | Project overview |
| `DEPLOYMENT.md` | Deployment guide (Docker, PM2, systemd, reverse proxy) |
| `BACKUP.md` | Backup procedures and restore steps |
| `MONITORING.md` | Health checks, log analysis, incident response |

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
# 4. Clean eslint.config.mjs (remove prettier + vitest references)

# 5. Regenerate lock file
npm install

# 6. Verify build
npm run build
npm run lint

# 7. Commit
git add -A
git commit -m "chore(release): strip dev artifacts for vX.Y.Z"

# 8. Publish as orphan commit (see publish procedure above)
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
- **Create** `.github/workflows/ci.yml` — on PR to dev: npm ci, lint, typecheck, build, npm audit

### 4.2 CD workflow (M)
- **Create** `.github/workflows/deploy.yml` — on tag push (v*): Docker build + push to GHCR, tagged latest + semver

### 4.3 Pre-commit hooks (S, optional)
- Install husky + lint-staged, eslint --fix on staged files

### Phase 4 Checklist

- [ ] `.github/workflows/ci.yml` exists
- [ ] PR to dev triggers lint + typecheck + build + audit
- [ ] Failed CI blocks merge (branch protection configured)
- [ ] `.github/workflows/deploy.yml` exists
- [ ] Tag push triggers Docker image push to GHCR
- [ ] Image tagged with `latest` and semver
- [ ] `npm run audit` script exists in package.json
- [ ] (Optional) Pre-commit hooks run lint on staged files

---

## Phase 5: Documentation & Handoff

**Priority**: MEDIUM — needed for anyone operating the system
**Depends on**: Phases 1-4 complete

> Note: Documentation created during hardening lives on `dev` and is stripped per policy at release time. Operational docs (DEPLOYMENT.md, BACKUP.md, MONITORING.md) are an exception — they ship if they exist at release time. The stripping policy can be amended per-release if specific docs are deemed operational.

### 5.1 Deployment guide — `DEPLOYMENT.md` (M)
- Docker step-by-step, bare metal step-by-step, env var reference, first-run setup, reverse proxy (nginx/Caddy + HTTPS), upgrade procedure

### 5.2 Backup procedures — `BACKUP.md` (S)
- What to back up, script usage, cron setup, restore procedure

### 5.3 Monitoring runbook — `MONITORING.md` (S)
- Health check usage, log analysis, alert conditions, incident response

### Phase 5 Checklist

- [ ] `DEPLOYMENT.md` — a new team member can deploy using only this guide
- [ ] `BACKUP.md` — backup and restore tested end-to-end
- [ ] `MONITORING.md` — covers top 5 failure scenarios

---

## Release Checklist — v0.1.0 (Final Gate)

This checklist is completed **after all 5 phases** and **after stripping** before publishing as orphan commit to `master`:

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

### Release Publishing
- [ ] Orphan commit published to `master`
- [ ] Tag `v0.1.0` points to orphan commit
- [ ] GitHub Release created with release notes
- [ ] Branch protection enabled on `master` (require PRs for future releases)

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
v0.1.0 (initial — orphan commit, full strip)
  All work on dev ──> release/v0.1.0 ──> strip ──> orphan commit ──> master + tag v0.1.0

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

  ── strip ──> orphan commit ──> master + tag v0.1.0

Future releases (v0.2.0+)
  master ──> release/vX.Y.Z ──> cherry-pick changes ──> PR to master ──> merge ──> tag
```

## Files Summary

**New files (~18)**: `.env.example`, `src/middleware.ts`, `src/lib/utils/env-check.ts`, `src/lib/utils/password-validation.ts`, `src/lib/utils/login-rate-limit.ts`, `src/lib/logger.ts`, `src/lib/error-tracking.ts`, `src/types/next-auth.d.ts`, `src/app/setup/page.tsx`, `src/app/api/setup/route.ts`, `src/app/api/health/route.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `ecosystem.config.js`, `scripts/backup-db.sh`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Key files to modify**: `src/lib/auth.ts`, `src/lib/db/client.ts`, `src/lib/db/schema.ts`, `src/lib/db/seed.ts`, `src/app/api/account/password/route.ts`, `next.config.ts`, `package.json`, `src/app/api/seed/route.ts`, ~25 server files (logging migration)
