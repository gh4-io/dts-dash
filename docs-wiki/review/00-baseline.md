# Phase 0 — Baseline Report

**Project:** CVG Line Maintenance Operations Dashboard
**Date:** 2026-02-15
**Reviewer:** Ralph Wiggum (Senior Engineer)

---

## 1. Inventory

| Attribute | Value |
|-----------|-------|
| Language | TypeScript 5.x (strict mode) |
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Runtime | Node.js (WSL2 Linux) |
| Package Manager | npm |
| UI Library | React 19.2.3, shadcn/ui, Radix UI |
| Charts | Recharts 3.7, Apache ECharts 6 |
| State | Zustand 5 |
| Auth | Auth.js v5 (beta.30), JWT strategy |
| Database | SQLite (better-sqlite3 12.6), Drizzle ORM 0.45 |
| Styling | Tailwind CSS v4, tw-animate-css |
| Icons | Font Awesome 6 (self-hosted) + Lucide |
| Tables | TanStack Table 8 |

### Entrypoints
- `src/app/layout.tsx` — root layout
- `src/app/page.tsx` — redirect to /flight-board
- `src/proxy.ts` — auth middleware (Node.js runtime)
- `src/lib/db/seed.ts` — database seeding (CLI)

### Deployment
- Local-first, no cloud dependencies
- Dev: `npm run dev` (Turbopack)
- Build: `npm run build` (static + dynamic routes)
- Start: `npm run start`

### Existing Tooling
| Tool | Status |
|------|--------|
| ESLint 9 (flat config) | Configured (next/core-web-vitals + next/typescript) |
| Prettier | **Not configured** |
| TypeScript strict | Enabled |
| Tests | **No test framework** |
| Pre-commit hooks | **None** |
| CI/CD | **None** |
| Format script | **Missing** |
| Typecheck script | **Missing** |
| Test script | **Missing** |

---

## 2. Architecture Map

### Module Boundaries
```
src/app/           — Pages (App Router) + API routes
src/components/    — React components (6 domains + ui + shared + layout)
src/lib/auth.ts    — Auth.js config
src/lib/data/      — Data reader, transformer, engines (capacity, hourly-snapshot)
src/lib/db/        — SQLite client, Drizzle schema, seeds
src/lib/hooks/     — Zustand stores + data-fetching hooks
src/lib/utils/     — Pure utility functions
src/types/         — TypeScript interfaces
```

### Data Flow
```
data/input.json → reader.ts → transformer.ts → API routes → React hooks → Components
                                    ↑
                     SQLite (config, overrides, mappings)
```

### External Integrations
- None (local-first). Future: SharePoint OData via Power Automate POST.

---

## 3. Build/Test/Lint Status

| Gate | Status | Notes |
|------|--------|-------|
| `npm run build` | PASS | Clean after `.next` cache clear |
| `npm run lint` | PASS | Zero warnings/errors |
| `npx tsc --noEmit` | PASS | Zero type errors |
| `npm audit` | 4 moderate | All in drizzle-kit (dev dep, esbuild transitive) |
| Tests | N/A | No test framework configured |
| Formatter | N/A | No formatter configured |

---

## 4. Top 10 Issues (Ranked by Severity)

### CRITICAL

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Unrestricted `/api/seed` endpoint** — excluded from auth proxy, publicly accessible. Anyone can reset the database and recreate seed users. | `src/proxy.ts` matcher, `src/app/api/seed/route.ts` | Database reset, credential reset, data loss |
| 2 | **Hardcoded seed credentials logged to console** — `admin123` / `user123` visible in logs and source. Combined with #1, trivial account takeover. | `src/lib/db/seed.ts` | Known default credentials |
| 3 | **No test framework** — zero automated tests for 86+ source files. No regression safety net. | Project-wide | Regressions undetectable |
| 4 | **Filter date params never validated in API routes** — `parseFilterParams()` accepts arbitrary strings; `validateFilterState()` exists but is never called server-side. Malformed dates cause silent empty results. | `src/lib/utils/filter-helpers.ts`, API routes | Silent data loss, confusing UX |
| 5 | **Timezone parameter ignored in `generateHourBoundaries()`** — accepted but explicitly unused. Hour boundaries align to system time, not user's timezone. | `src/lib/data/engines/hourly-snapshot.ts` | Incorrect hourly analytics |

### HIGH

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 6 | **Division by zero in capacity utilization** — if `realCapacityMH = 0` (misconfigured shifts), returns `Infinity`. Breaks JSON serialization. | `src/lib/data/engines/capacity.ts` | API 500, chart crash |
| 7 | **NaN propagation in `formatDuration()`** — no input validation; produces `"NaN:NaN"` for invalid input. | `src/lib/utils/date-helpers.ts` | Garbage display |
| 8 | **No rate limiting** — login, import, config endpoints all unprotected from brute force. | All API routes | Brute force attacks |
| 9 | **Config PUT has no key whitelist** — arbitrary keys can be written to `appConfig` table. | `src/app/api/config/route.ts` | Config pollution |
| 10 | **Temp password returned in HTTP response** — admin password reset exposes plaintext password in API response body. | `src/app/api/admin/users/[id]/reset-password/route.ts` | Credential exposure |

### Additional Notable Issues (11-15)

| # | Issue | Severity |
|---|-------|----------|
| 11 | No formatter (Prettier) configured | MEDIUM |
| 12 | No pre-commit hooks | MEDIUM |
| 13 | No CI/CD pipeline | MEDIUM |
| 14 | Cache invalidation patterns inconsistent (reader vs transformer) | MEDIUM |
| 15 | CSV export filename not sanitized | LOW |

---

## 5. Risk Summary

**Security:** 6.5/10 — Critical auth bypass via seed endpoint, no rate limiting, weak passwords.
**Reliability:** 7/10 — No tests, silent failures in data layer, NaN/Infinity edge cases.
**Correctness:** 7.5/10 — Timezone bugs in hourly engine, filter validation gaps.
**Maintainability:** 8/10 — Good structure, but no formatter, no tests, some duplication.
**Observability:** 5/10 — console.log only, no structured logging, no health endpoint.

**Overall Baseline Score: 6.8/10**

---

*Phase 0 complete. Proceeding to Phase 1 — Quality Gates.*
