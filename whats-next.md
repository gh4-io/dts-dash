# Handoff Document — G-10: Flight Events Per-Customer Attribution

**Created:** 2026-02-24
**Branch:** `feat/capacity-layout`
**Repo:** `gh4-io/dts-dash`
**Version:** 0.2.0 (unreleased work on feature branch)
**Status:** G-10 ready to implement. E-01–E-06 + G-01 all complete.

---

<original_task>

Implement G-10: Surface per-customer flight event attribution in the Events lens.
The `flight_events.customer` field already exists (NOT NULL). `EventCoverageWindow.customer`
is already populated. The API already returns this data. The gap is purely UI: when Events
lens is active, per-customer event breakdown is not shown in KPI strip or table.

</original_task>

---

<work_completed>

## All Prior Enhancements Complete (on feat/capacity-layout)

| Enhancement | Status | Commit |
|-------------|--------|--------|
| E-01: Rolling 8-week forecast | Done | `20cf711` |
| E-02: Scenario toggle | Done | `20cf711` |
| E-03: Gap analysis | Done | `20cf711` |
| E-04: UI integration | Done | `20cf711` |
| Review fixes (I-01, I-06, R-01, R-05) | Done | `fcc167c` |
| E-05: Compute mode badge | Done | `f844da3` |
| E-06: Today line + future shading | Done | `f844da3` |
| G-01: Decouple aggregation from lens | Done | (latest) |
| Forecast-pattern capacity-zero bug fix | Done | (committed) |

## Docs Updated This Session
- `CHANGELOG.md` — all work under `[Unreleased]` (version stays 0.2.0 until merge/release)
- `.claude/OPEN_ITEMS.md` — OI-071 (G-07), OI-072 (G-09), OI-073 (G-10) added
- `.claude/ROADMAP.md` — capacity enhancements section + Tier 3 section added
- `package.json` — stays at 0.2.0

## Verification
- Tests: 557 passing (21 files)
- Build: clean
- Lint: clean

</work_completed>

---

<work_remaining>

## Now: G-10 — Flight Events Per-Customer Attribution

### Prompt for Fresh Agent

```
## Context

You are on `feat/capacity-layout` branch of a Next.js/TypeScript capacity dashboard.
557 tests passing, build clean. All capacity engines are pure functions (zero DB imports).

The `flight_events` table already has a `customer` NOT NULL column. The `EventCoverageWindow`
type already carries `customer`. The API already returns this data. The gap is purely a
UI surfacing issue: when the Events lens is active in "By Customer" view mode, per-customer
event data is not shown.

## Your Task

Read these files first:
1. `src/lib/capacity/flight-events-engine.ts` — existing `computeCoverageRequirements()` pattern
2. `src/types/index.ts` — search for `FlightEvent`, `EventCoverageWindow`, `CapacityShift`
3. `src/app/(authenticated)/capacity/page.tsx` — current data routing
4. `src/components/capacity/capacity-kpi-strip.tsx` — KPI card rendering
5. `src/lib/db/schema.ts` — confirm `flight_events.customer` exists

Then implement:

### 1. New Engine: `src/lib/capacity/event-attribution-engine.ts`
Pure functions, zero DB imports. Three functions:

- `aggregateCoverageByCustomer(windows, shifts)` → `CustomerCoverageAggregate[]`
  Same algorithm as `computeCoverageRequirements()` but keyed by (date, shift, customer)
  Import `resolveShiftForHour` from `./demand-engine`

- `summarizeEventsByCustomer(events)` → `CustomerEventSummary[]`
  Group active non-cancelled events by customer, count + sum coverage MH

- `buildCustomerCoverageMap(aggregates)` → `Map<string, Record<string, number>>`
  date → customer → total coverage MH lookup

### 2. New Types in `src/types/index.ts`

    export interface CustomerCoverageAggregate {
      date: string;
      shiftCode: string;
      customer: string;
      coverageMinutes: number;
      coverageMH: number;
      windowCount: number;
    }

    export interface CustomerEventSummary {
      customer: string;
      eventCount: number;
      totalCoverageMH: number;
      windowCount: number;
    }

### 3. Tests: `src/__tests__/capacity/event-attribution-engine.test.ts`
~15 tests: empty inputs, single/multiple customers, shift boundary crossing,
midnight crossing, cancelled/inactive filtering, MH computation, map building.

### 4. Page Integration: `src/app/(authenticated)/capacity/page.tsx`
Direct imports (NOT barrel — D-047). useMemo for customerEventSummary and
customerCoverageMap. Pass to KPI strip and table as optional props.

### 5. KPI Strip: `src/components/capacity/capacity-kpi-strip.tsx`
New optional prop `customerEventSummary?: CustomerEventSummary[]`.
When Events lens active: top 3 customers by event count as mini KPI cards.

### 6. Barrel Export: `src/lib/capacity/index.ts`
Add exports for 3 new functions.

### Guardrails
- All engines are pure functions (zero DB imports)
- D-047: client components use direct imports, not barrel
- Scenarios do NOT scale event data
- Existing `computeCoverageRequirements()` is NOT modified
- No schema migration needed

### After each step:
    npx vitest run && npm run build && npm run lint

### Commit: `feat(capacity): add per-customer flight event attribution (G-10)`
```

## After G-10: Remaining Tier 3 Gaps (Deferred)

| Gap | Description | Effort | Why Deferred |
|-----|-------------|--------|--------------|
| G-07 | Cross-lens comparison (dual overlay) | High (3 sessions) | Legend explosion, UI complexity |
| G-09 | Monthly roll-up aggregation | High (2 sessions) | New engine + chart + partial-month edge cases |

## After All Gaps: Branch Merge + Release

- PR from `feat/capacity-layout` to `master`
- Version bump at merge time (demand contracts = breaking change → v0.3.0 minimum)
- Release notes from `[Unreleased]` changelog section

</work_remaining>

---

<critical_context>

## Key Facts for G-10
- `flight_events.customer` is NOT NULL in schema (confirmed)
- `EventCoverageWindow.customer` is copied from `FlightEvent.customer` in `computeEventWindows()`
- `resolveShiftForHour()` from `demand-engine.ts` is already imported by `flight-events-engine.ts`
- The Events lens currently has NO `LENS_LINE_CONFIG` entry (unlike allocated/forecast/worked/billed)
- Existing `computeCoverageRequirements()` aggregates by (date, shift) — new engine adds customer dimension
- API at `/api/capacity/overview` already returns `flightEvents` and `coverageWindows` with customer data

## Architecture Rules
- Pure function engines (zero DB imports) in `*-engine.ts`
- D-047 barrel trap: client components use direct imports
- Scenarios do NOT scale event data
- Date strings use `T12:00:00Z` UTC noon pattern

</critical_context>

---

<current_state>

## Git State
- Branch: `feat/capacity-layout`
- HEAD: latest commit after G-01
- Uncommitted: doc updates (CHANGELOG, OPEN_ITEMS, ROADMAP, whats-next)

## All Gates Passing
- Tests: 557 (21 files)
- Build: clean
- Lint: clean

</current_state>
