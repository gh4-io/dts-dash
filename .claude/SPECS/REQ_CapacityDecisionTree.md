# Capacity Scope × Lens View — Decision Tree

**Created:** 2026-02-24
**Updated:** 2026-02-24 (post E-01–E-06, G-01, G-10 implementation)
**Branch:** `feat/capacity-layout`
**Purpose:** Map the three scope axes (date range, aggregation level, model mode) against the seven lens views to define what should be shown in every combination — and to track gap closure progress.

---

## The Three Scope Axes

Every view on the `/capacity` page is the intersection of three independent decisions.

| Axis | Options | UI Control Today | Status |
|------|---------|-----------------|--------|
| **Axis 1: Date Range** | Day · Week · Multi-week · Month+ | Filter bar (Start/End) | No gap — user-controlled |
| **Axis 2: Aggregation Level** | Daily (per-tick) · Weekly pattern (Mon–Sun avg) · Monthly roll-up | **Independent toggle** (Daily / Weekly Pattern / Monthly) | **RESOLVED (G-01 + G-09)** — all 3 aggregation levels implemented. |
| **Axis 3: Capacity Model** | Rotation-based · Headcount-plan-based | `ComputeModeToggle` — interactive mode switch via API `mode` query param | **RESOLVED (G-05)** — toggle switches active capacity model; badge upgraded to interactive control |

---

## Axis 2 Detail: Aggregation Levels

| Level | Chart | X-axis Tick | Value per Tick | Trigger |
|-------|-------|-------------|----------------|---------|
| **Daily** | `CapacitySummaryChart` | 1 per calendar day | Actual values for that day | Aggregation toggle = "Daily Timeline" (default) |
| **Weekly Pattern** | `ForecastPatternChart` | 1 per day-of-week (Mon–Sun) | Average across all matching days in range | Aggregation toggle = "Weekly Pattern" |
| **Monthly roll-up** | `MonthlyRollupChart` | 1 per calendar month | Total MH for the month (demand, capacity, gap) + avg utilization % | Aggregation toggle = "Monthly" |

> **RESOLVED (G-01 + G-09):** Aggregation level is now an **independent 3-way toggle** (Daily / Weekly Pattern / Monthly), decoupled from the lens selector. Any of the 7 lenses works with any aggregation mode. The Forecast lens no longer forces the chart type.

---

## Axis 3 Detail: Capacity Model Modes

| Mode | Computation Path | DB Tables Used | Status |
|------|-----------------|----------------|--------|
| **Rotation-based** | `resolveStaffingForCapacity()` → `computeDailyCapacityFromStaffing()` | `staffing_configs`, `staffing_shifts`, `rotation_patterns` | **Active** (current DB has config id=1) |
| **Headcount-plan-based** | `computeDailyCapacityV2()` with `resolveHeadcount()` | `headcount_plans`, `headcount_exceptions` | Implemented but **inactive** (headcount_plans is empty) |
| **Zero capacity** | Fallback when neither path has data | *(none)* | Triggers when both tables empty |

> **RESOLVED (G-05):** A `ComputeModeToggle` component in the page header allows users to both see and switch the active capacity model. Mode switching is backed by the API `mode` query param (e.g. `?mode=rotation` or `?mode=headcount`). The earlier read-only `ComputeModeBadge` (E-05) was superseded by this interactive control.

---

## Lens View Definitions

| Lens | Primary Purpose | Overlay Added | Chart Type | Position in Timeline |
|------|----------------|---------------|------------|----------------------|
| **Planned** | Baseline demand vs capacity | None | `CapacitySummaryChart` | Past + Future |
| **Allocated** | Contracted demand vs WP demand | Allocated demand line (contract-based) | `CapacitySummaryChart` | Past + Future |
| **Events** | Flight event coverage vs demand | Flight event blocks | `CapacitySummaryChart` | Past + Future |
| **Forecast** | Typical weekly pattern + rate forecast + rolling 8W forecast | Rolling 8W forecast line (daily); Forecasted demand line (weekly); OR Projected MH swap | Chart depends on aggregation toggle | Past (avg) + Future (projected) |
| **Worked** | Actual hours vs demand and capacity | Worked hours line (time_bookings) | `CapacitySummaryChart` | **Past only** |
| **Billed** | Billable hours vs demand and capacity | Billed hours line (billing_entries) | `CapacitySummaryChart` | **Past only** |
| **Concurrent** | Concurrency pressure on capacity | Peak concurrency line | `CapacitySummaryChart` | Past + Future (estimated) |

---

## Decision Tree

```
ENTRY: User opens /capacity page
│
├── AXIS 1: What time window am I looking at?
│   ├── Short range (≤ 7 days) ──────────────────────────────────────┐
│   ├── Standard range (1–4 weeks) ──────────────────────────────────┤ → proceeds to Axis 2
│   ├── Long range (1–3 months) ────────────────────────────────────┤
│   └── Extended range (3+ months) ──────────────────────────────────┘
│
├── AXIS 2: What level of aggregation do I need?
│   ├── Daily (exact dates) ──────────────────────────── → CapacitySummaryChart
│   │   └── Proceeds to Axis 3 + Lens selection
│   ├── Weekly pattern (Mon–Sun averages) ─────────────── → ForecastPatternChart
│   │   └── [RESOLVED G-01] Independent toggle — any lens works with weekly pattern
│   └── Monthly roll-up ──────────────────────────────── → MonthlyRollupChart
│       └── [RESOLVED G-09] Independent toggle — monthly buckets with total MH + avg utilization
│
├── AXIS 3: Which capacity model is active?
│   ├── Rotation-based (active) ─────────── capacity from staffing_shifts + rotation_patterns
│   ├── Headcount-plan-based (inactive) ─── capacity from headcount_plans + exceptions
│   └── [RESOLVED G-05] ComputeModeToggle — interactive switch via API mode query param
│
└── LENS: What insight layer do I want?
    │
    ├── PLANNED ─────────────────────────────────────────────────────────────
    │   Chart: CapacitySummaryChart (daily)
    │   Bars: totalDemandMH (or per-shift, or per-customer)
    │   Lines: productiveMH (capacity, dashed), utilizationPercent (solid, right axis)
    │   Overlay: None
    │   Use when: "What is my raw demand vs capacity baseline?"
    │   Works for: Past ✓ | Future ✓ | By Shift ✓ | By Customer ✓
    │
    ├── ALLOCATED ───────────────────────────────────────────────────────────
    │   Chart: CapacitySummaryChart (daily)
    │   Bars: totalDemandMH
    │   Lines: capacity (dashed), utilization (solid), allocatedDemandMH (accent line)
    │   Overlay: demand_contracts → demand_allocation_lines aggregated by date+shift
    │   Use when: "Are contracted demand allocations in line with actual WP demand?"
    │   Works for: Past ✓ | Future ✓ | By Shift ✓ | By Customer ✓
    │   [RESOLVED G-01] Allocated lens now works on weekly pattern chart via aggregation toggle
    │
    ├── EVENTS ──────────────────────────────────────────────────────────────
    │   Chart: CapacitySummaryChart (daily)
    │   Bars: totalDemandMH
    │   Lines: capacity (dashed), utilization (solid), flight event coverage overlay
    │   Overlay: flight_events → coverage MH per shift per date
    │   Use when: "How do aircraft coverage windows affect demand distribution?"
    │   Works for: Past ✓ | Future ✓ | By Shift ✓ | By Customer ✓ [RESOLVED G-10]
    │
    ├── FORECAST ────────────────────────────────────────────────────────────
    │   Chart: ForecastPatternChart (weekly pattern Mon–Sun)
    │   Bars: avgDemandByShift (historical avg) OR projectedByShift (when Projected toggle ON)
    │   Lines: avgCapacityByShift (dashed, always historical avg)
    │   Overlay: avgForecastedDemand (rate-based forecast) OR projected MH (swaps bars)
    │   Use when: "What does a typical week look like? What should I expect next week?"
    │   Works for: Past (avg) ✓ | Future (projected) ✓ | By Shift ✓ | By Customer ✓
    │   [RESOLVED G-02/E-01] Rolling 8W forecast line now available on daily timeline
    │   [RESOLVED G-04] Projected toggle accessible from daily timeline for future dates
    │   [RESOLVED G-03/E-01] Forecast uses configurable history window (default 8 weeks), not just filter range
    │
    ├── WORKED ──────────────────────────────────────────────────────────────
    │   Chart: CapacitySummaryChart (daily)
    │   Bars: totalDemandMH
    │   Lines: capacity (dashed), utilization (solid), workedMH (accent line)
    │   Overlay: time_bookings aggregated by date+shift
    │   Use when: "How did actual worked hours compare to demand and available capacity?"
    │   Works for: **Past only** ✓ | Future ✗ (no worked data for future) | By Shift ✓ | By Customer ✓
    │   [RESOLVED G-06/E-06] Today reference line + future-date shading added
    │
    ├── BILLED ──────────────────────────────────────────────────────────────
    │   Chart: CapacitySummaryChart (daily)
    │   Bars: totalDemandMH
    │   Lines: capacity (dashed), utilization (solid), billedMH (accent line)
    │   Overlay: billing_entries aggregated by date+shift
    │   Use when: "How does revenue-generating work compare to total demand and capacity?"
    │   Works for: **Past only** ✓ | Future ✗ | By Shift ✓ | By Customer ✓
    │   [OPEN G-07] No worked vs billed comparison in a single lens — cross-lens comparison planned
    │
    └── CONCURRENT ──────────────────────────────────────────────────────────
        Chart: CapacitySummaryChart (daily)
        Bars: totalDemandMH
        Lines: capacity (dashed), utilization (solid), peakConcurrency (accent line)
        Overlay: concurrency analysis from work packages (peak simultaneous aircraft)
        Use when: "Is my peak concurrency (simultaneous aircraft) exceeding shift capacity?"
        Works for: Past ✓ | Future ✓ | By Shift ✓ | By Customer ✗ (concurrency is shift-level)
```

---

## Full Combination Matrix

For each Lens × Aggregation × Time Position combination, what can currently be shown:

| Lens | Daily Timeline | Weekly Pattern | Monthly Roll-up | Past | Future | By Shift | By Customer |
|------|---------------|----------------|-----------------|------|--------|----------|-------------|
| Planned | ✅ | ✅ (G-01) | ✅ (G-09) | ✅ | ✅ | ✅ | ✅ |
| Allocated | ✅ | ✅ (G-01) | ✅ (G-09) | ✅ | ✅ | ✅ | ✅ |
| Events | ✅ | ✅ (G-01) | ✅ (G-09) | ✅ | ✅ | ✅ | ✅ (G-10) |
| Forecast | ✅ (E-01) | ✅ | ✅ (G-09) | ✅ (avg) | ✅ (projected) | ✅ | ✅ |
| Worked | ✅ | ✅ (G-01) | ✅ (G-09) | ✅ | ⚠️ past-only (E-06 today line) | ✅ | ✅ |
| Billed | ✅ | ✅ (G-01) | ✅ (G-09) | ✅ | ⚠️ past-only (E-06 today line) | ✅ | ✅ |
| Concurrent | ✅ | ✅ (G-01) | ✅ (G-09) | ✅ | ✅ (est.) | ✅ | ❌ not per-customer |

**Remaining gaps:**
- **Concurrent** lens is not per-customer (shift-level metric by nature)
- All other gaps resolved: G-01 (aggregation), G-07 (cross-lens comparison), G-09 (monthly roll-up), G-10 (events per-customer)

---

## Gap Inventory

### G-01: Aggregation level is coupled to the Forecast lens — RESOLVED
**Status:** Implemented. Aggregation is now an independent toggle (Daily Timeline / Weekly Pattern) decoupled from lens selection. Any of the 7 lenses works with either aggregation mode.
**Commit:** Part of capacity enhancements on `feat/capacity-layout`.

### G-02: No daily forecast line — RESOLVED (by E-01)
**Status:** Implemented via rolling 8-week forecast engine. An emerald dashed line on `CapacitySummaryChart` shows per-day forecasted demand using recency-weighted DOW averages with hyperbolic decay.
**Divergence from spec (I-05):** Uses hyperbolic decay `1/(1 + weeksAgo * 0.15)` instead of spec's exponential decay `0.85^weeksAgo`. Hyperbolic provides gentler drop-off for sparse historical data.

### G-03: Weekly pattern averages are scope-limited — RESOLVED (by E-01)
**Status:** The rolling 8-week forecast engine uses a configurable history window (default 8 weeks) independent of the filter date range. Confidence levels (high/medium/low) are sample-count-based, not horizon-distance-based.
**Divergence from spec (I-06):** Confidence is based on sample count per DOW (high: 8+ samples, medium: 4–7 samples, low: 1–3 samples), not on forecast horizon distance.

### G-04: Projected toggle not accessible from daily timeline — RESOLVED
**Status:** Weekly MH projections are now accessible from the daily timeline with a per-customer-per-shift breakdown overlay. Projections toggle is available regardless of active lens or aggregation mode.

### G-05: No model mode visibility or toggle — RESOLVED (G-05)
**Status:** `ComputeModeToggle` component in the page header allows users to see the active capacity model and switch between modes via the API `mode` query param. The initial read-only `ComputeModeBadge` (E-05) was upgraded to this interactive toggle. Uses `computeMode` and `activeStaffingConfigName` from the Zustand store.
**Upgrade note:** E-05 delivered a read-only badge; G-05 upgraded it to a full interactive toggle that switches the capacity model on the backend via `?mode=rotation` / `?mode=headcount`.

### G-06: Worked/Billed have no future-date behavior — RESOLVED (by E-06)
**Status:** A dashed "Today" reference line and subtle future-date shading are now rendered on the daily chart. Lines for Worked/Billed naturally end at today's date, and the visual context makes clear that future data is unavailable for past-only lenses.

### G-07: No cross-lens comparison — RESOLVED (OI-071)
**Status:** Cross-lens comparison implemented. `CompareSelector` dropdown allows selecting a secondary lens; its data is rendered as a muted overlay (1.5px stroke, dashed, 60% opacity) on all 3 chart types (daily `CapacitySummaryChart`, weekly-pattern `ForecastPatternChart`, monthly `MonthlyRollupChart`). A KPI delta card (`fa-code-compare`) appears in the KPI strip showing the average daily MH difference. The detail table gains a secondary column with "(compare)" header and CSV export includes the comparison data. 4 eligible secondary lenses: allocated, forecast, worked, billed. Secondary lens state is page-local (`useState<CapacityLensId | null>`, D-051). Hidden in gap mode. Auto-clears when primary matches secondary.

### G-08: No gap analysis view — RESOLVED (by E-03)
**Status:** Gap analysis engine (`computeGapSummary()`) + diverging bar "Gap" view mode + gap KPI card are implemented. Surplus bars extend upward (green), deficit bars extend downward (red). Gap classification uses frequency-based approach (deficit-day ratio across the range).
**Divergence from spec:** Gap classification is frequency-based (what fraction of days are in deficit), not magnitude-based (spec proposed percentage thresholds per individual day). This better answers "how often am I short?" vs "how short am I on any given day?"

### G-09: Monthly roll-up aggregation — RESOLVED ✅
**Implemented:** `MonthlyRollupChart` component + `aggregateMonthlyRollup()` pure engine. Third aggregation toggle option (Daily / Weekly Pattern / Monthly). Supports all 4 view modes (Total/By Shift/By Customer/Gap), lens overlays, secondary comparison (G-07), and scenario-adjusted data. 3 new files, 4 modified, 16 new tests.

### G-10: Events lens not per-customer — RESOLVED
**Status:** Per-customer event attribution engine implemented (`aggregateCoverageByCustomer`, `summarizeEventsByCustomer`, `buildCustomerCoverageMap`). KPI strip shows top 3 customers by event count + "+N more" badge when Events lens is active. No schema migration needed — `flight_events.customer` already existed as a NOT NULL field.
**Commit:** `df5db72` — `feat(capacity): add per-customer event attribution engine (G-10)`

---

## Priority Tiers for Gap Resolution

### Tier 1 — High impact, relatively contained — ALL RESOLVED
| Gap | Status |
|-----|--------|
| G-01: Decouple aggregation from lens | **RESOLVED** — independent toggle |
| G-02: Daily forecast line | **RESOLVED** (E-01) — rolling 8W forecast |
| G-03: History window for pattern | **RESOLVED** (E-01) — configurable history window |
| G-06: Today line + future shading | **RESOLVED** (E-06) — today line + shading |

### Tier 2 — Medium complexity, significant value — ALL RESOLVED
| Gap | Status |
|-----|--------|
| G-04: Projections on daily timeline | **RESOLVED** — per-customer-per-shift breakdown |
| G-05: Model mode visibility + toggle | **RESOLVED** (G-05) — ComputeModeToggle (interactive, API mode param) |
| G-08: Gap analysis view mode | **RESOLVED** (E-03) — gap engine + diverging bars |

### Tier 3 — Larger scope changes — 1 of 3 resolved, 1 open, 1 deferred
| Gap | Status |
|-----|--------|
| G-07: Cross-lens comparison | **RESOLVED** (OI-071) — secondary overlay + KPI delta + table column |
| G-09: Monthly roll-up | **RESOLVED** (OI-072) — engine + chart + 3-way toggle |
| G-10: Events per-customer | **RESOLVED** — no schema change needed |

---

## Implemented UI Layout (G-01 + G-02 resolved)

The aggregation toggle is now independent of the lens selector, exactly as proposed:

```
/capacity page — current layout:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  LENS: [Planned] [Allocated] [Events] [Forecast] [Worked] [Billed] [Concurrent]
  │                                                                         │
  │  AGGREGATION: [Daily Timeline] [Weekly Pattern]     ComputeModeBadge   │
  │                                                                         │
  │  SCENARIO: ( Baseline ) ( +10% Demand )     [8W Forecast: ON/OFF]      │
  │                                                                         │
  │  KPI Strip (4 cards, context-aware based on active lens + scenario)     │
  │                                                                         │
  │  CHART: determined by AGGREGATION toggle, not by LENS                  │
  │  OVERLAY: determined by LENS selection, not by AGGREGATION             │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Next recommended action:** G-07 (Cross-Lens Comparison) — allow secondary lens overlay with different accent color.

---

## Enhancement Plan: Forecasting, Scenarios & Gap Analysis — ALL IMPLEMENTED

> **Status:** All four enhancements (E-01–E-04) plus two additional enhancements (E-05, E-06) are implemented on `feat/capacity-layout`. 574 tests passing, build clean.
>
> The sections below preserve the original spec with implementation notes and intentional divergences documented inline.

### E-01: Rolling 8-Week Forecast Line — IMPLEMENTED

**What:** A recency-weighted DOW forecast line overlaid on `CapacitySummaryChart` (daily timeline), shown as an emerald dashed line.

**Engine: `computeRolling8WeekForecast()`** (pure function in `forecast-pattern-engine.ts`)
- Input: `demand: DailyDemandV2[]`, `capacity: DailyCapacityV2[]`, `forecastWeeks: number` (default 8)
- Algorithm (as implemented):
  1. Compute day-of-week averages from historical demand using configurable history window (default 8 weeks)
  2. **Divergence I-05:** Uses **hyperbolic decay** `1/(1 + weeksAgo * 0.15)` instead of spec's exponential decay `0.85^weeksAgo`. Hyperbolic provides gentler drop-off for sparse data.
  3. Generate one `ForecastPoint` per calendar day for the next `forecastWeeks × 7` days
  4. **Divergence I-06:** Confidence is **sample-count-based** (high: 8+ samples, medium: 4–7 samples, low: 1–3 samples), not horizon-distance-based as spec proposed.
- Output: `RollingForecastResult { points: ForecastPoint[], horizonStart: string, horizonEnd: string, basedOnWeeks: number }`

**Chart integration (as implemented):**
- Rendered as an **emerald dashed line** on `CapacitySummaryChart`
- Controlled by "8W Forecast" toggle button
- In `byShift` mode: 3 per-shift forecast lines
- In `total` mode: 1 aggregate forecast line

**Resolved gaps:** G-02 (daily forecast line) and G-03 (history window)

---

### E-02: Scenario Toggle — Baseline vs +10% Demand — IMPLEMENTED

**What:** Demand multiplier engine with Baseline (1.0×) and +10% Demand (1.1×) scenarios. Utilization is recomputed per scenario.

**Implementation notes:**
- **Divergence I-01:** No `capacityMultiplier` field — only `demandMultiplier` is implemented. Capacity is a physical constraint (headcount/rotation), not a variable to scale.
- Lens overlay values (allocated, forecasted, worked, billed) are **NEVER scaled by scenarios** — they represent real data, not hypotheticals.
- Scenario state is **page-local** (`useState`), not in Zustand — intentional scoping to avoid global side effects.
- Rolling forecast uses **original demand**, not scenario-adjusted demand.

---

### E-03: Gap Metrics Per Scenario — IMPLEMENTED

**What:** Gap analysis engine + diverging bar "Gap" view mode + gap KPI card. Resolves G-08.

**Implementation notes:**
- `computeGapSummary()` pure function in gap engine
- Diverging bar chart: surplus (green upward) / deficit (red downward)
- Gap KPI card in the KPI strip
- **Divergence:** Gap classification uses **frequency-based** approach (deficit-day ratio across the range), not the magnitude-based per-day thresholds (surplus >20%, balanced ±20%, etc.) proposed in the spec. This better answers "how often am I short?" as a management question.
- **Divergence I-03:** Single-scenario gap view only — spec proposed side-by-side baseline vs scenario bars, but implementation shows gap for the active scenario only (simpler, less cluttered).

---

### E-04: Scenario Controls UI Integration — IMPLEMENTED

**What:** Scenario selector, KPI strip wiring, and effective data routing to charts.

**Implementation notes:**
- **Divergence I-04:** Scenario state is `useState` in the page component, NOT in Zustand store as spec proposed. This is intentional — scenario is page-local state that resets on navigation, not global persistent state.
- Forecast toggle (`showForecastLine`) remains in Zustand as it's a user preference.
- Rolling forecast uses **original demand** (not scenario-adjusted), and the drilldown drawer also uses original demand.
- Zero API changes — all scenario/forecast computation is client-side.
- Lens overlay values are NEVER scaled by scenarios.

---

### Enhancement Summary Table

| Enhancement | Addresses Gaps | Status | Intentional Divergences |
|------------|---------------|--------|------------------------|
| E-01: 8-Week Forecast Line | G-02, G-03 | **IMPLEMENTED** | I-05 (hyperbolic decay), I-06 (sample-count confidence) |
| E-02: Scenario Toggle | *(new)* | **IMPLEMENTED** | I-01 (no capacityMultiplier) |
| E-03: Gap Metrics | G-08 | **IMPLEMENTED** | I-03 (single-scenario gap view), frequency-based classification |
| E-04: Scenario Controls | *(new)* | **IMPLEMENTED** | I-04 (page-local useState, not Zustand) |
| E-05: Compute Mode Badge | G-05 (partial) | **SUPERSEDED** | Upgraded to ComputeModeToggle (G-05) |
| E-06: Today Line + Shading | G-06 | **IMPLEMENTED** | — |

### Intentional Divergences from Spec (documented in REVIEW-E01-E04.md)

| ID | Spec Said | Implementation Did | Rationale |
|----|-----------|-------------------|-----------|
| I-01 | `ScenarioConfig` has `capacityMultiplier` | Only `demandMultiplier` | Capacity is physical (headcount/rotation), not a scaling variable |
| I-03 | Gap chart shows both scenarios side-by-side | Shows gap for active scenario only | Simpler, less visual clutter |
| I-04 | Scenario state in Zustand store | `useState` in page component | Scenarios are page-local, should reset on navigation |
| I-05 | Exponential decay `0.85^weeksAgo` | Hyperbolic decay `1/(1 + w * 0.15)` | Gentler drop-off for sparse data |
| I-06 | Confidence by forecast horizon distance | Confidence by DOW sample count | More meaningful with variable data density |

---

## Open Items Status

### Resolved (8 of 10 gaps closed)
| Gap | Resolution | OI |
|-----|-----------|-----|
| G-01 | Independent aggregation toggle | Resolved |
| G-02 | Rolling 8W forecast (E-01) | Resolved |
| G-03 | Configurable history window (E-01) | Resolved |
| G-04 | Projections on daily timeline | Resolved |
| G-05 | ComputeModeToggle (G-05) — interactive, API mode param; supersedes E-05 badge | Resolved |
| G-06 | Today line + shading (E-06) | Resolved |
| G-08 | Gap analysis engine (E-03) | Resolved |
| G-10 | Per-customer event attribution | Resolved |

### Still Open
| Gap | Status | OI |
|-----|--------|-----|
| **G-07** | Cross-lens comparison — **RESOLVED** ✅ | OI-071 |
| **G-09** | Monthly roll-up — **RESOLVED** ✅ | OI-072 |
