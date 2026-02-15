# Phase 2 — Changes Summary

**Date:** 2026-02-15

## Changes Implemented

### A) Correctness Fixes

| # | Change | File | Why |
|---|--------|------|-----|
| 1 | NaN/Infinity guard in `formatDuration()` | `src/lib/utils/date-helpers.ts` | Prevented `"NaN:NaN"` output for invalid input |
| 2 | NaN/Infinity guard in `formatDurationHuman()` | `src/lib/utils/date-helpers.ts` | Same as above, returns `"0m"` |
| 3 | Division by zero guard in capacity utilization | `src/lib/data/engines/capacity.ts` | Prevented `Infinity` when `realCapacityMH = 0` |

### B) Security Fixes

| # | Change | File | Why |
|---|--------|------|-----|
| 4 | Removed `/api/seed` from proxy exclusions | `src/proxy.ts` | Endpoint was publicly accessible without auth |
| 5 | Added auth guard to seed route | `src/app/api/seed/route.ts` | Production requires superadmin; dev always allowed |
| 6 | Removed credential logging from seed | `src/lib/db/seed.ts` | Passwords no longer appear in logs |
| 7 | Added config key whitelist | `src/app/api/config/route.ts` | Prevented arbitrary key injection into appConfig |

### C) Observability / Logging

| # | Change | Files | Why |
|---|--------|-------|-----|
| 8 | Replaced `console.log` with `console.warn` across data layer | reader.ts, transformer.ts, seed.ts, seed-analytics.ts, aircraft-type.ts, track.ts, import/commit | Consistent logging level; linter now catches accidental `console.log` |

**Total:** 17 `console.log` → `console.warn` conversions across 7 files.

### D) Quality Gates Added (Phase 1 carryover)

| # | Change | Files | Why |
|---|--------|-------|-----|
| 9 | Prettier formatter | `.prettierrc.json`, `.prettierignore` | Consistent code formatting |
| 10 | ESLint tightened | `eslint.config.mjs` | Added prettier compat, no-console, no-debugger, prefer-const, eqeqeq |
| 11 | Vitest test framework | `vitest.config.ts`, `src/test/setup.ts` | Automated testing |
| 12 | 51 unit tests | `src/lib/utils/__tests__/` | Coverage for date-helpers, pagination, contrast, csv-export |
| 13 | npm scripts | `package.json` | format, typecheck, test, test:watch, test:coverage, validate |

## Not Changed (Documented Risk Acceptance)

| Item | Reason | Risk |
|------|--------|------|
| Timezone in `generateHourBoundaries()` | Requires date-fns-tz or significant refactor. Function works correctly for UTC. | LOW in current usage |
| Rate limiting | Requires additional dependency (upstash/ratelimit) or custom implementation. Local-first app with single-user access pattern. | MEDIUM (future) |
| Temp password in reset response | Current UX flow requires showing the password. Would need email integration to fix properly. | MEDIUM (future) |
| Password complexity requirements | Current 8-char minimum is functional for local-first app. | LOW |
| `getDayBoundaries()` timezone bug | Function is not called anywhere in the codebase. Dead code. | NONE |

## Test Results After Changes

| Gate | Status |
|------|--------|
| `npm run test` | 51/51 PASS |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 4 warnings (screenshot.mjs only) |
| `npm run build` | PASS |
