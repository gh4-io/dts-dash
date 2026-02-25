# Capacity Model Enhancements E-01 through E-04: Implementation Plan

**Created:** 2026-02-24
**Branch:** `feat/capacity-layout`
**Spec:** `.claude/SPECS/REQ_CapacityDecisionTree.md`
**Status:** Ready for implementation

## Context

The capacity modeling page (`/capacity`) currently shows demand vs capacity with 7 lens overlays. Management needs forward-looking trend lines, what-if scenarios, and clear surplus/deficit metrics to make staffing decisions. All four enhancements are **client-side only** (no API changes) and follow the established pure-function engine pattern.

**Critical discovery:** `DailyUtilizationV2.gapMH` and `ShiftUtilizationV2.gapMH` already contain `capacity - demand` values. The gap engine aggregates these — it does NOT recompute them.

## Guardrails

1. All new engines are **pure functions** (zero DB imports) in `*-engine.ts` files
2. No API route changes — all computation is client-side over already-fetched data
3. Existing domain metric formulas are **unchanged** — scenarios create parallel computation paths with transformed inputs
4. Forecast outputs are **labeled as forecasts** with confidence indicators
5. Lens overlay values (allocated, forecasted, worked, billed) are **never scaled** by scenarios — they represent independent data sources
6. Date handling uses `T12:00:00Z` pattern consistently (matches `forecast-pattern-engine.ts`)
7. **D-047 barrel import trap:** `"use client"` components must import from direct paths, NOT from `@/lib/capacity` barrel

---

## Overview

| Enhancement | Description | Core Work |
|-------------|-------------|-----------|
| **E-01** | Rolling 8-Week Forecast Line | New pure engine + chart overlay |
| **E-02** | Scenario Toggle (Baseline vs +10% Demand) | Client-side demand transform + utilization recompute |
| **E-03** | Gap Metrics Per Scenario | Aggregate existing `gapMH` into summary + diverging bar view mode |
| **E-04** | Scenario Controls UI Integration | `ScenarioSelector` component wired into page layout |

**Build sequence:** E-01 → E-02 → E-03 → E-04 (E-01 and E-02 are independent; E-03 uses E-02; E-04 wires all)

---

## Phase 1: E-01 — Rolling 8-Week Forecast Line

### Files

| File | Action |
|------|--------|
| `src/lib/capacity/rolling-forecast-engine.ts` | **Create** |
| `src/__tests__/capacity/rolling-forecast-engine.test.ts` | **Create** |
| `src/types/index.ts` | Modify — add types |
| `src/lib/capacity/index.ts` | Modify — add barrel export |
| `src/components/capacity/capacity-summary-chart.tsx` | Modify — add forecast line + toggle |
| `src/app/(authenticated)/capacity/page.tsx` | Modify — compute + pass forecast data |

### Types to Add (`src/types/index.ts`)

```typescript
export interface RollingForecastDay {
  date: string;
  forecastedDemandMH: number;
  forecastedByShift: Record<string, number>;
  isForecast: true;
  confidence: "high" | "medium" | "low";
}

export interface RollingForecastResult {
  forecastDays: RollingForecastDay[];
  weeksAhead: number;
  basedOnWeeks: number;
  patternSource: "dayOfWeek";
}
```

### Engine (`rolling-forecast-engine.ts`)

```typescript
export function computeRollingForecast(
  demand: DailyDemandV2[],
  capacity: DailyCapacityV2[],
  options?: { weeksAhead?: number; maxHistoryWeeks?: number },
): RollingForecastResult
```

**Algorithm:**
1. If demand empty → return `{ forecastDays: [], weeksAhead: 8, basedOnWeeks: 0, patternSource: "dayOfWeek" }`
2. Sort demand by date ascending
3. `lastHistoricalDate` = last demand date
4. `cutoffDate` = lastHistoricalDate - (maxHistoryWeeks ?? 12) weeks
5. Filter `recentDemand` = demand where date >= cutoffDate
6. Build recency-weighted day-of-week buckets (ISO 1=Mon..7=Sun):
   - For each day: `weeksAgo = floor((lastDate - dayDate) / 7)`, `weight = 1 / (1 + weeksAgo * 0.15)`
   - Accumulate `weightedSum += demandMH * weight`, `totalWeight += weight`
   - Same for per-shift: `shiftWeightedSums[shiftCode] += shiftDemandMH * weight`
   - Track `sampleCount` per DOW
7. Compute weighted averages: `avg = weightedSum / totalWeight`
8. Confidence: sampleCount >= 8 → "high", >= 4 → "medium", else "low"
9. Generate 8 × 7 = 56 forecast days starting day after lastHistoricalDate
10. Each day maps to its DOW average

**Helpers (private):** `toIsoDayOfWeek()`, `round1()`, `addDays()` — duplicated locally (no cross-engine imports, pure function pattern)

### Chart Integration (`capacity-summary-chart.tsx`)

New optional props:
```typescript
rollingForecast?: RollingForecastResult | null;
// Toggle stays as internal useState<boolean> in the chart, default false
```

When forecast toggle is ON and data exists:
- Append forecast rows to `chartData` after last historical day
- Forecast rows have `forecastDemandMH` (total) / `forecastDemand_${shiftCode}` (per-shift)
- Historical rows have these fields as `undefined` (so line only draws over forecast region)
- `<Line>` with `strokeDasharray="4 2"`, color `#10b981` (emerald), `connectNulls={false}`
- `<ReferenceLine>` vertical separator at historical/forecast boundary
- Legend: "Forecast (8-wk rolling)" — clearly labeled
- Tooltip: "Forecast (8-wk rolling): X.X MH"
- Toggle button in chart header: `[8W Forecast]` emerald when active

### Page Integration (`page.tsx`)

```typescript
const rollingForecast = useMemo(() => {
  if (demand.length === 0 || capacity.length === 0) return null;
  return computeRollingForecast(demand, capacity);
}, [demand, capacity]);

// Pass to CapacitySummaryChart
<CapacitySummaryChart ... rollingForecast={rollingForecast} />
```

**Import:** Direct path `@/lib/capacity/rolling-forecast-engine` (D-047)

### Edge Cases

| Case | Handling |
|------|----------|
| Empty demand | Empty forecast, no line rendered |
| < 1 week history | Forecast with confidence "low" for all days |
| All demand zero | Forecast line at 0 |
| Shift mismatch | Ignore shifts not in `activeShifts` at render |
| Unsorted demand | Sort before processing |
| Date gaps | Natural (weekends/holidays) — only real data enters buckets |
| Future dates in demand | Filter to dates <= today before computing |

### Tests (10 cases)

1. Empty demand → empty forecast, basedOnWeeks: 0
2. 14 days history → 56 forecast days
3. Forecast starts day after last historical date
4. Correct DOW assignment (known Monday → dayOfWeek 1)
5. Recency weighting: recent week=100, old week=50 → avg closer to 100
6. Per-shift sums equal total (within rounding)
7. Confidence levels: 8+ = high, 4-7 = medium, <4 = low
8. Single day history → still produces forecast
9. All values rounded to 1 decimal
10. `maxHistoryWeeks` option respected

### Verification

```bash
npx vitest run src/__tests__/capacity/rolling-forecast-engine.test.ts
npm run build
```
Then: open `/capacity`, verify chart normal with toggle off, toggle on → emerald dashed line extends 8 weeks, hover tooltip says "Forecast", switch By Shift → per-shift lines.

---

## Phase 2: E-02 — Scenario Toggle

### Files

| File | Action |
|------|--------|
| `src/lib/capacity/scenario-engine.ts` | **Create** |
| `src/__tests__/capacity/scenario-engine.test.ts` | **Create** |
| `src/types/index.ts` | Modify — add types |
| `src/lib/capacity/index.ts` | Modify — add barrel export |

### Types to Add (`src/types/index.ts`)

```typescript
export interface DemandScenario {
  id: string;
  label: string;
  demandMultiplier: number;
}

export interface ScenarioResult {
  scenarioId: string;
  demand: DailyDemandV2[];
  utilization: DailyUtilizationV2[];
  summary: CapacitySummary;
}
```

### Engine (`scenario-engine.ts`)

```typescript
export const DEMAND_SCENARIOS: readonly DemandScenario[] = [
  { id: "baseline", label: "Baseline", demandMultiplier: 1.0 },
  { id: "plus10", label: "+10% Demand", demandMultiplier: 1.1 },
] as const;

export function applyDemandScenario(
  demand: DailyDemandV2[],
  capacity: DailyCapacityV2[],
  scenario: DemandScenario,
): ScenarioResult
```

**Algorithm:**
1. If multiplier === 1.0 → shortcut: compute utilization from original demand, return
2. Deep-copy + scale demand:
   - `totalDemandMH *= multiplier`
   - `byCustomer` values *= multiplier
   - `byShift[].demandMH *= multiplier`
   - `byShift[].wpContributions[].allocatedMH *= multiplier`
3. **DO NOT scale:** `allocatedDemandMH`, `forecastedDemandMH`, `workedMH`, `billedMH`, `peakConcurrency` — these are independent data sources
4. Recompute utilization: `computeUtilizationV2(scaledDemand, capacity)`
5. Recompute summary: `computeCapacitySummary(utilization)`
6. Return `{ scenarioId, demand: scaledDemand, utilization, summary }`

**Imports:** `computeUtilizationV2` and `computeCapacitySummary` from `./capacity-core` (engine-to-engine import is allowed — both are pure functions)

### Edge Cases

| Case | Handling |
|------|----------|
| Empty demand | Empty arrays, zero summary |
| Multiplier 1.0 | Shortcut, no transformation |
| Zero demand | 0 × 1.1 = 0, no division issues |
| Null lens overlays | Preserved as-is |

### Tests (13 cases)

1. Baseline returns demand unchanged
2. +10% scales totalDemandMH (100 → 110)
3. +10% scales per-shift demandMH
4. +10% scales per-customer demand
5. +10% scales wpContributions.allocatedMH
6. Does NOT scale allocatedDemandMH
7. Does NOT scale forecastedDemandMH
8. Does NOT scale workedMH / billedMH
9. Recomputes utilization (demand 100 × 1.1 = 110, capacity 100 → util 110%)
10. Recomputes summary (overtimeFlag triggers)
11. Handles empty demand
12. Rounds to 1 decimal
13. DEMAND_SCENARIOS constant has correct entries

### Verification

```bash
npx vitest run src/__tests__/capacity/scenario-engine.test.ts
npm run build
```
No UI changes yet.

---

## Phase 3: E-03 — Gap Metrics + Gap View Mode

### Files

| File | Action |
|------|--------|
| `src/lib/capacity/gap-engine.ts` | **Create** |
| `src/__tests__/capacity/gap-engine.test.ts` | **Create** |
| `src/types/index.ts` | Modify — add GapSummary |
| `src/lib/capacity/index.ts` | Modify — add barrel export |
| `src/components/capacity/capacity-summary-chart.tsx` | Modify — add "gap" view mode |
| `src/components/capacity/capacity-kpi-strip.tsx` | Modify — add gap KPI card |

### Type to Add (`src/types/index.ts`)

```typescript
export interface GapSummary {
  avgDailyGapMH: number;
  totalGapMH: number;
  deficitDays: number;
  surplusDays: number;
  worstDayDeficit: { date: string; gapMH: number } | null;
  worstShiftDeficit: { date: string; shiftCode: string; gapMH: number } | null;
  avgGapByShift: Record<string, number>;
  classification: "surplus" | "balanced" | "tight" | "deficit";
}
```

### Engine (`gap-engine.ts`)

```typescript
export function computeGapSummary(utilization: DailyUtilizationV2[]): GapSummary
```

**Algorithm:**
1. Empty → all zeros, classification "balanced", nulls for worst
2. `totalGapMH` = sum of `gapMH` across all days
3. `avgDailyGapMH` = round1(total / length)
4. `deficitDays` = count where gapMH < 0
5. `surplusDays` = count where gapMH > 0
6. `worstDayDeficit` = day with minimum gapMH (null if min >= 0)
7. `worstShiftDeficit` = min across all days × shifts (null if min >= 0)
8. `avgGapByShift` = per-shift average of shift.gapMH
9. Classification by deficit ratio = deficitDays / totalDays:
   - 0 → "surplus", < 0.2 → "balanced", < 0.5 → "tight", else → "deficit"

### Chart — Gap View Mode (`capacity-summary-chart.tsx`)

Extend `ViewMode`:
```typescript
type ViewMode = "byShift" | "byCustomer" | "total" | "gap";
```

Add "Gap" toggle button in chart header.

**Gap mode chart data:**
```typescript
// For each utilization day:
row = {
  date, label,
  gapMH: round1(u.gapMH),
  gap_DAY: round1(dayShift.gapMH),
  gap_SWING: round1(swingShift.gapMH),
  gap_NIGHT: round1(nightShift.gapMH),
}
```

**Gap mode rendering:**
- `<Bar>` per shift (`gap_DAY`, `gap_SWING`, `gap_NIGHT`) side-by-side grouped (no stackId)
- Recharts renders negative values below zero line natively
- `<ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />`
- Color: shift colors (DAY=#f59e0b, SWING=#f97316, NIGHT=#6366f1) — same as other modes
- Remove utilization % Y-axis in gap mode (only MH axis)
- Tooltip: positive → "Surplus: +X.X MH", negative → "Deficit: X.X MH"

### KPI Strip (`capacity-kpi-strip.tsx`)

New optional prop:
```typescript
gapSummary?: GapSummary | null;
activeScenarioLabel?: string;
```

When `gapSummary` provided, add a KPI card:
- Icon: `fa-scale-unbalanced` / `fa-scale-balanced`
- Label: "Gap Status"
- Value: classification ("Surplus" / "Balanced" / "Tight" / "Deficit")
- Color: green / blue / amber / red
- Sub: `${deficitDays}/${totalDays} deficit days`
- When `activeScenarioLabel` provided, show scenario badge

### Edge Cases

| Case | Handling |
|------|----------|
| Empty utilization | All zeros, "balanced" |
| All zero capacity | All gaps = -demand, "deficit" |
| All zero demand | All gaps = +capacity, "surplus" |
| Gap exactly zero | Neither deficit nor surplus |
| Shift not on all days | Average only across days where shift exists |

### Tests (13 cases)

1. Empty utilization → zeros, "balanced"
2. Correct totalGapMH
3. Correct avgDailyGapMH (rounded)
4. Correct deficit/surplus day counts
5. Finds worst day deficit
6. Null worstDayDeficit when no deficits
7. Finds worst shift deficit
8. Per-shift gap averages
9. Classification: "surplus" (0 deficit days)
10. Classification: "balanced" (<20%)
11. Classification: "tight" (20-50%)
12. Classification: "deficit" (>50%)
13. Zero-gap days count as neither

### Verification

```bash
npx vitest run src/__tests__/capacity/gap-engine.test.ts
npm run build
```
Then: open `/capacity`, click "Gap" view → diverging bars visible, tooltip shows surplus/deficit, KPI card shows classification.

---

## Phase 4: E-04 — Scenario Controls UI Integration

### Files

| File | Action |
|------|--------|
| `src/components/capacity/scenario-selector.tsx` | **Create** |
| `src/app/(authenticated)/capacity/page.tsx` | Modify — wire everything |
| `src/components/capacity/capacity-summary-chart.tsx` | Modify — accept `activeScenarioLabel` |
| `src/components/capacity/capacity-kpi-strip.tsx` | Modify — accept scenario props (already done in E-03) |

### ScenarioSelector Component

```typescript
// src/components/capacity/scenario-selector.tsx
"use client";
import { DEMAND_SCENARIOS } from "@/lib/capacity/scenario-engine"; // DIRECT import (D-047)
import type { DemandScenario } from "@/types";

interface ScenarioSelectorProps {
  activeScenario: DemandScenario;
  onScenarioChange: (scenario: DemandScenario) => void;
}
```

Pill-style radio toggle matching existing UI patterns (like ViewMode buttons). Active scenario gets accent background. "+10% Demand" shows amber indicator when active.

### Page Wiring (`page.tsx`)

```typescript
// Imports (DIRECT — D-047)
import { applyDemandScenario, DEMAND_SCENARIOS } from "@/lib/capacity/scenario-engine";
import { computeRollingForecast } from "@/lib/capacity/rolling-forecast-engine";
import { computeGapSummary } from "@/lib/capacity/gap-engine";

// State
const [activeScenario, setActiveScenario] = useState<DemandScenario>(DEMAND_SCENARIOS[0]);

// Memoized computations
const scenarioResult = useMemo(() => {
  if (demand.length === 0 || capacity.length === 0) return null;
  return applyDemandScenario(demand, capacity, activeScenario);
}, [demand, capacity, activeScenario]);

const effectiveDemand = scenarioResult?.demand ?? demand;
const effectiveUtilization = scenarioResult?.utilization ?? utilization;
const effectiveSummary = scenarioResult?.summary ?? summary;

// Rolling forecast uses ORIGINAL demand (not scenario-adjusted)
const rollingForecast = useMemo(() => {
  if (demand.length === 0 || capacity.length === 0) return null;
  return computeRollingForecast(demand, capacity);
}, [demand, capacity]);

// Gap summary uses scenario-adjusted utilization
const gapSummary = useMemo(() => {
  return computeGapSummary(effectiveUtilization);
}, [effectiveUtilization]);
```

### Data Flow to Components

| Component | Receives | Notes |
|-----------|----------|-------|
| `LensSelector` | Unchanged | Lenses are orthogonal to scenarios |
| `ScenarioSelector` | `activeScenario`, `onScenarioChange` | New — placed next to LensSelector |
| `CapacityKpiStrip` | `effectiveSummary`, `gapSummary`, `activeScenarioLabel` | Scenario-adjusted |
| `CapacitySummaryChart` | `effectiveDemand`, `effectiveUtilization`, `rollingForecast`, `activeScenarioLabel` | Scenario-adjusted demand, original capacity |
| `ForecastPatternChart` | `demand` (ORIGINAL), `capacity` | **Not scenario-adjusted** — historical pattern analysis |
| `CapacityHeatmap` | `effectiveDemand`, `effectiveUtilization` | Scenario-adjusted |
| `CapacityPieCharts` | `effectiveDemand`, `effectiveUtilization` | Scenario-adjusted |
| `CapacityTable` | `effectiveDemand`, `effectiveUtilization` | Scenario-adjusted |
| `ShiftDrilldownDrawer` | `demand` (ORIGINAL) | **Not scenario-adjusted** — shows WP-level detail |

### Chart Scenario Badge (`capacity-summary-chart.tsx`)

When `activeScenarioLabel` is truthy, show badge in chart header:
```tsx
<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
  {activeScenarioLabel}
</span>
```

### Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ LENS: [Planned] [Allocated] [Events] [Forecast] [Worked] [Billed]... │
│                                                                        │
│ SCENARIO: (● Baseline) (○ +10% Demand)                                │
└────────────────────────────────────────────────────────────────────────┘
```

Separator `<div className="h-4 w-px bg-border" />` between LensSelector and ScenarioSelector.

### Regression Risks

| Risk | Mitigation |
|------|-----------|
| Heatmap/Pies/Table wrong data | Pass `effectiveDemand` / `effectiveUtilization` consistently |
| Drawer shows fractional WP values | Pass original `demand` (not scenario) to drawer |
| ForecastPatternChart polluted | Pass original `demand` and `capacity` |
| KPI strip wrong summary | Pass `effectiveSummary` |
| Type errors | All new props are optional with sensible defaults |
| Rapid scenario switching | `useMemo` is synchronous — no race condition |

### Verification

```bash
npm run build
npx vitest run  # all tests including E-01, E-02, E-03
```

Manual checks:
1. ScenarioSelector visible next to LensSelector
2. Default "Baseline" — no changes
3. Click "+10% Demand":
   - Demand bars grow ~10%
   - Capacity lines unchanged
   - Utilization increases
   - KPI strip updated
   - Badge shows in chart header
4. Gap view mode shows scenario-adjusted gaps
5. Forecast line does NOT change when switching scenarios
6. Forecast lens → ForecastPatternChart shows original data
7. Shift drilldown drawer shows original WP data
8. Switch back to Baseline → all values restore

---

## Complete File Inventory

### New Files (7)
| File | Phase |
|------|-------|
| `src/lib/capacity/rolling-forecast-engine.ts` | E-01 |
| `src/lib/capacity/scenario-engine.ts` | E-02 |
| `src/lib/capacity/gap-engine.ts` | E-03 |
| `src/components/capacity/scenario-selector.tsx` | E-04 |
| `src/__tests__/capacity/rolling-forecast-engine.test.ts` | E-01 |
| `src/__tests__/capacity/scenario-engine.test.ts` | E-02 |
| `src/__tests__/capacity/gap-engine.test.ts` | E-03 |

### Modified Files (5)
| File | Phases | Changes |
|------|--------|---------|
| `src/types/index.ts` | E-01, E-02, E-03 | 5 new interfaces |
| `src/lib/capacity/index.ts` | E-01, E-02, E-03 | 3 barrel exports |
| `src/components/capacity/capacity-summary-chart.tsx` | E-01, E-03, E-04 | Forecast line, gap view mode, scenario label |
| `src/components/capacity/capacity-kpi-strip.tsx` | E-03, E-04 | Gap KPI card, scenario label |
| `src/app/(authenticated)/capacity/page.tsx` | E-01, E-04 | Scenario state, memoized computations, data routing |

### Unchanged Files (explicitly NOT modified)
| File | Reason |
|------|--------|
| `src/lib/capacity/capacity-core.ts` | Reused as-is (computeUtilizationV2, computeCapacitySummary) |
| `src/lib/capacity/forecast-pattern-engine.ts` | Not modified — E-01 uses own approach |
| `src/app/api/capacity/overview/route.ts` | No API changes |
| `src/lib/hooks/use-capacity-v2.ts` | No store changes — scenario state is page-local |
| `src/components/capacity/lens-selector.tsx` | Scenarios are orthogonal to lenses |

---

## Domain Metric Definitions — Old vs New

| Metric | Formula | Changed? |
|--------|---------|----------|
| Demand MH | `totalDemandMH` from WP computation | Same formula; scenario creates transformed copy |
| Capacity MH | `totalProductiveMH` from staffing | **UNCHANGED** |
| Utilization % | `demandMH / productiveMH × 100` | Same formula; input may differ under scenario |
| Gap MH | `productiveMH - demandMH` | Same formula; input may differ under scenario |
| Rolling Forecast | **(NEW)** recency-weighted DOW average projected 8 weeks | New metric |
| Gap Classification | **(NEW)** deficit ratio → surplus/balanced/tight/deficit | New metric |

**No existing formulas are redefined.**

---

## Post-Implementation Gates

After all 4 phases:
```bash
npx vitest run                    # all tests pass (existing 439 + ~36 new)
npm run build                     # clean
npm run lint                      # no new errors
```
