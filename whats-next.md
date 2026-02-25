# Handoff Document — G-09: Monthly Roll-Up Aggregation

**Created:** 2026-02-25
**Branch:** `feat/capacity-layout`
**Repo:** `gh4-io/dts-dash`
**Version:** 0.2.0 (unreleased work on feature branch)
**Latest Commit:** (pending) — `feat(capacity): add monthly roll-up aggregation (G-09)`
**Tests:** 590 passing (23 files)
**Build:** Clean
**Lint:** 0 errors, 0 warnings

---

## What Was Done

### G-09: Monthly Roll-Up Aggregation — COMPLETE ✅

Added a third aggregation mode ("Monthly") to the capacity page. When selected, daily data is bucketed into calendar-month groups showing total MH for demand, capacity, gap, and average utilization %.

**New Files (3):**
- `src/lib/capacity/monthly-rollup-engine.ts` — Pure engine: `aggregateMonthlyRollup(demand, capacity, utilization)` → `MonthlyRollupResult`
- `src/components/capacity/monthly-rollup-chart.tsx` — Recharts `ComposedChart` with 4 view modes (Total/By Shift/By Customer/Gap), lens overlays, secondary comparison (G-07), scenario badge
- `src/__tests__/capacity/monthly-rollup-engine.test.ts` — 16 tests covering sums, partials, edge cases, lens overlays, rounding

**Modified Files (4):**
- `src/types/index.ts` — 3 new interfaces: `MonthlyShiftBucket`, `MonthlyRollupBucket`, `MonthlyRollupResult`
- `src/lib/capacity/index.ts` — Barrel export for `aggregateMonthlyRollup`
- `src/components/capacity/aggregation-toggle.tsx` — Extended union type + OPTIONS to 3 items (Daily / Weekly Pattern / Monthly)
- `src/app/(authenticated)/capacity/page.tsx` — Widened state type, added import, extended chart ternary to 3-way

**Zero:** API changes, schema migrations, engine modifications to existing code, Zustand changes

---

## All Capacity Tier 3 Gaps Complete

| Gap | Status |
|-----|--------|
| G-01 | Decouple aggregation from lens ✅ |
| G-07 | Cross-lens comparison (2 sessions) ✅ |
| G-09 | Monthly roll-up aggregation ✅ |
| G-10 | Per-customer event attribution ✅ |

---

## What's Next

The `feat/capacity-layout` branch has all planned capacity enhancements and gap fixes complete:
- E-01 through E-06 (enhancements)
- G-01, G-05, G-07, G-09, G-10 (gap fixes)

**Likely next steps:**
1. Merge `feat/capacity-layout` → `master`
2. Capacity Phase 3 — Contract MH Pipeline (OI-065)
3. Or other non-capacity work

---

## Architecture Notes

- All capacity engines are **pure functions** (zero DB imports) in `*-engine.ts`
- **D-047 barrel import trap**: `"use client"` components use direct imports, not `@/lib/capacity` barrel
- Aggregation state is page-local `useState` (not Zustand)
- Scenario overlays (E-01 rolling forecast line) are NEVER scaled by scenario — only base demand is
- Monthly chart receives `effectiveDemand` and `effectiveUtilization` (scenario-adjusted) from page
- Monthly engine internally computes `avgUtilizationPercent = totalDemandMH / totalCapacityMH * 100`
