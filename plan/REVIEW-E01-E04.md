# Review: E-01 through E-04 Implementation Plan

**Reviewed:** 2026-02-24
**Plan file:** `plan/CAPACITY-ENHANCEMENTS-E01-E04.md`

---

## PASS Items (10)

| ID | Finding |
|----|---------|
| P-01 | Pure function pattern strictly followed — all 3 engines are zero-DB-import |
| P-02 | D-047 barrel import trap correctly handled — direct imports for client components |
| P-03 | Lens overlay values (allocated, forecasted, worked, billed) never scaled by scenarios |
| P-04 | Domain metric definitions preserved — old vs new table confirms no formulas redefined |
| P-05 | Forecast uses ORIGINAL demand, not scenario-adjusted — prevents contamination |
| P-06 | Build sequence sound — dependency ordering is correct |
| P-07 | No API changes — eliminates API contract regression risk entirely |
| P-08 | Edge cases well-enumerated per engine |
| P-09 | 36 new tests on top of existing 439 — reasonable coverage |
| P-10 | Scenario state is page-local (useState), not in Zustand — correct scoping |

---

## ISSUES (6)

### I-01: Signature mismatch — `computeRollingForecast` capacity param [LOW]
Plan specifies `computeRollingForecast(demand, capacity, options?)` but the engine only needs `demand`. The `capacity` param is unused. The `useMemo` dependency array would include `capacity` needlessly.
**Fix:** Remove `capacity` from signature and memo deps.

### I-02: Build order contradiction between spec and plan [LOW]
Spec says "E-03 first, E-01 second, E-02 third." Plan says "E-01 → E-02 → E-03 → E-04." The plan's ordering is correct — E-03 does not depend on E-02 (both consume `DailyUtilizationV2[]`).
**Fix:** Update spec to match plan ordering.

### I-03: Gap view mode does not support scenario comparison bars [MEDIUM]
Spec promises "baseline gap as solid bars, scenario gap as outlined bars." Plan only implements single-scenario gap bars.
**Fix:** Document this as a future enhancement, not a Phase 1 deliverable. Or scope it into E-04.

### I-04: `capacityMultiplier` in spec but not in implementation [LOW]
Spec defines `ScenarioConfig` with `capacityMultiplier`. Implementation uses simpler `DemandScenario` with `demandMultiplier` only.
**Fix:** Align spec to match implementation. Capacity multiplier is aspirational, not needed for current scenarios.

### I-05: Recency weighting formula differs from spec [LOW]
Spec says "exponential decay ~0.85 per week." Plan uses hyperbolic: `1/(1 + weeksAgo * 0.15)`. These produce materially different weights for older data. Hyperbolic is gentler.
**Fix:** Note in spec that actual implementation uses hyperbolic decay, not exponential.

### I-06: Forecast confidence based on sample count, not horizon distance [MEDIUM]
Spec says "confidence degrades as horizon extends." Implementation assigns confidence per DOW based on historical sample count. Day 1 and Day 56 of forecast have the same confidence.
**Fix:** Either add horizon-based degradation or update spec to reflect actual behavior. Both approaches are defensible.

---

## RISKS (5)

### R-01: X-axis label density with 56 forecast points [MEDIUM]
With forecast ON, chartData triples (~28 → ~84 rows). Current `interval={0}` shows ALL labels → overlap.
**Mitigation:** Switch to `interval="preserveEnd"` or calculated interval when forecast is active.

### R-02: Gap classification is frequency-based, not magnitude-based [LOW]
A single catastrophic deficit day in 30 days classifies as "surplus" (3.3% < 20%). Could surprise management.
**Note:** Acceptable trade-off — document this in tooltips.

### R-03: Only 2 scenarios — UI overhead for a binary choice [LOW]
Pill-group for 2 options could be a simple toggle. If scenarios never grow, this is overbuilt.
**Note:** The extensible design is fine for now.

### R-04: Scenario state not persisted across navigation [LOW]
`useState` resets on page leave. Intentional but worth noting.

### R-05: `wpContributions.allocatedMH` naming confusion [LOW]
This field IS correctly scaled (it's WP-level demand allocation), but the name looks like the lens overlay `allocatedDemandMH` (which is NOT scaled). Future devs may be confused.
**Mitigation:** Add inline comment in scenario-engine.ts clarifying the distinction.

---

## SUGGESTIONS (4)

| ID | Suggestion | Effort | Value |
|----|-----------|--------|-------|
| S-01 | Add confidence band (Area) around forecast line instead of single line | Medium | High — makes uncertainty visible |
| S-02 | Show scenario delta on KPI cards (e.g., "85% → 93.5% (+8.5pp)") | Low | High — immediate impact visibility |
| S-03 | Persist forecast toggle as user preference | Low | Medium — convenience |
| S-04 | Add D-047 warning comment to barrel `index.ts` | Trivial | Medium — prevents future trap |
