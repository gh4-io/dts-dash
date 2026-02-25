# G-01: Decouple Aggregation Level from Lens Selection

**Gap:** Aggregation (Daily vs Weekly Pattern) is implicitly coupled to the Forecast lens.
Selecting "Forecast" is the _only_ way to view the `ForecastPatternChart`.

**Goal:** Make aggregation an independent UI control so any lens can be viewed in either chart mode.

**Branch:** `feat/capacity-layout`
**Baseline:** 557 tests passing, build clean

---

## 1. Pre-Implementation Verification

- [x] `npx vitest run` — 557 pass
- [ ] `npm run build` — clean
- [ ] `npm run lint` — clean

---

## 2. State Model

| State | Type | Location | Default | Notes |
|-------|------|----------|---------|-------|
| `viewAggregation` | `"daily" \| "weekly-pattern"` | `useState` on `page.tsx` | `"daily"` | Matches scenario pattern (page-local, not Zustand) |

**No Zustand changes.** The `activeLens` stays in Zustand. `viewAggregation` is ephemeral page state (resets on navigation, like `activeScenario`).

**No new types file changes.** The union `"daily" | "weekly-pattern"` is inlined at the `useState` call site. If reuse is needed later, extract to types then.

---

## 3. UI Control: Aggregation Toggle

**Component:** `AggregationToggle` — new file `src/components/capacity/aggregation-toggle.tsx`

**Visual pattern:** Match the existing `ScenarioSelector` pattern (bordered pill group with label).

```
┌──────────────────────────────────────────────────────────────────────┐
│  LENS: [Planned] [Allocated] [Events] [Forecast] ...               │
│                                                                      │
│  VIEW: ( Daily ●) ( Weekly Pattern )    SCENARIO: ( Baseline ●) ... │
└──────────────────────────────────────────────────────────────────────┘
```

**Placement:** On the same row as `ScenarioSelector` (the `sm:justify-between` row), left-aligned before the scenario pills. This keeps the lens selector on its own row and groups the two secondary controls together.

**Props:**
```typescript
interface AggregationToggleProps {
  value: "daily" | "weekly-pattern";
  onChange: (v: "daily" | "weekly-pattern") => void;
}
```

**Buttons:**
| Label | Value | Icon (optional) |
|-------|-------|-----------------|
| Daily | `"daily"` | `fa-solid fa-calendar-day` |
| Weekly Pattern | `"weekly-pattern"` | `fa-solid fa-calendar-week` |

---

## 4. Chart Routing Logic

**Current (page.tsx line ~250):**
```tsx
{activeLens === "forecast" ? (
  <ForecastPatternChart demand={demand} capacity={capacity} ... />
) : (
  <CapacitySummaryChart capacity={capacity} demand={effectiveDemand} ... />
)}
```

**New:**
```tsx
{viewAggregation === "weekly-pattern" ? (
  <ForecastPatternChart
    demand={effectiveDemand}   // ← changed from `demand` (scenario support)
    capacity={capacity}
    shifts={shifts}
    activeLens={activeLens}
    fillHeight
  />
) : (
  <CapacitySummaryChart
    capacity={capacity}
    demand={effectiveDemand}
    utilization={effectiveUtilization}
    shifts={shifts}
    activeLens={activeLens}
    fillHeight
    rollingForecast={rollingForecast}
    activeScenarioLabel={activeScenario.label}
  />
)}
```

**Key changes:**
1. Condition: `activeLens === "forecast"` → `viewAggregation === "weekly-pattern"`
2. `ForecastPatternChart` now receives `effectiveDemand` (scenario-adjusted) instead of raw `demand`, so +10% scenario applies to weekly-pattern bars too
3. `ForecastPatternChart` receives whatever `activeLens` is active (no longer forced to "forecast")

---

## 5. Lens x Aggregation Compatibility Matrix

For each lens, what renders in each aggregation mode:

| Lens | Daily (`CapacitySummaryChart`) | Weekly Pattern (`ForecastPatternChart`) |
|------|------|------|
| **Planned** | Demand bars + capacity line + utilization line | DOW avg demand bars + DOW avg capacity line |
| **Allocated** | Demand bars + allocated overlay line (amber) | DOW avg demand + DOW avg allocated overlay (amber) |
| **Events** | Demand bars + event lens (no overlay line config) | DOW avg demand bars only (no events DOW data) |
| **Forecast** | Demand bars + forecast overlay line (teal) | DOW avg demand + DOW avg forecast overlay (teal) + projected toggle |
| **Worked** | Demand bars + worked overlay line (green, past only) | DOW avg demand bars only (no worked DOW data) |
| **Billed** | Demand bars + billed overlay line (indigo, past only) | DOW avg demand bars only (no billed DOW data) |
| **Concurrent** | Demand bars + concurrency lens (no overlay line) | DOW avg demand bars only (no concurrency DOW data) |

**Explanation of "no DOW data" lenses:**
- `computeDayOfWeekPattern()` currently aggregates: demand, capacity, forecast rates, and allocated MH by day-of-week.
- It does **not** aggregate: worked hours, billed hours, events, or concurrency by DOW.
- When those lenses are active in weekly-pattern mode, the base chart (demand vs capacity pattern) still renders correctly — only the lens-specific overlay line is absent.
- This is an acceptable limitation for G-01 scope. Future work (G-02+) can extend the pattern engine to average worked/billed/events by DOW.

**ForecastPatternChart already handles this gracefully:** The `LENS_LINE_CONFIG` lookup returns `null` for lenses without config (`events`, `planned`, `worked`, `billed`, `concurrent`), so no overlay line renders — exactly the right behavior.

---

## 6. Feature Interaction Table

| Feature | Daily Aggregation | Weekly Pattern Aggregation | Action Needed |
|---------|---|---|---|
| **Gap view mode** (E-03) | Available — diverging bars | **Not available** — no DOW gap engine | Auto-reset `viewMode` to `"byShift"` if `"gap"` was selected when switching to weekly-pattern. Gap mode lives inside CapacitySummaryChart only. |
| **8W Forecast toggle** (E-01) | Available — dotted forecast line | **Not applicable** — forecast line is daily | Toggle is inside CapacitySummaryChart. Simply not rendered when weekly-pattern is active. No state reset needed. |
| **Today reference line** (E-06) | Available — vertical line + future shading | **Not applicable** — DOW chart has no timeline | Today line lives inside CapacitySummaryChart. Not rendered when weekly-pattern. |
| **Scenario toggle** (E-02) | Affects demand bars + utilization | Affects DOW avg demand bars (via `effectiveDemand`) | Pass `effectiveDemand` to ForecastPatternChart (change from `demand`). |
| **Projected toggle** | Not available (forecast-pattern only) | Available — swaps bars to projected MH | Already inside ForecastPatternChart. Works regardless of which lens is active. |
| **Compute mode badge** (E-05) | Shown | Shown | No change — badge is above the chart. |
| **KPI strip** | Shows scenario gap summary | Shows scenario gap summary | No change — KPI strip uses `effectiveUtilization`, independent of aggregation. |
| **Heatmap** | Always uses daily utilization data | Always uses daily utilization data | No change — heatmap is in the right column, independent of chart aggregation. |
| **Pie charts** | Always uses daily demand data | Always uses daily demand data | No change — pies are in the right column. |
| **Detail table** | Always uses daily data | Always uses daily data | No change. |

---

## 7. Edge Cases

### 7a. Gap mode + switch to weekly-pattern
**Scenario:** User is in `CapacitySummaryChart` with `viewMode="gap"`, then switches to weekly-pattern.
**Issue:** `ForecastPatternChart` does not have a gap view mode.
**Resolution:** No action required. Each chart manages its own `viewMode` state independently. Switching aggregation swaps the entire chart component — the ForecastPatternChart starts with its own default `viewMode="byShift"`. When the user switches back to daily, the CapacitySummaryChart remounts with its default `viewMode="byShift"` too (React unmounts/remounts on ternary swap). This is acceptable since view mode is a per-chart concern.

### 7b. 8W Forecast toggle ON + switch to weekly-pattern
**Scenario:** User has the 8W forecast line visible, then switches to weekly-pattern.
**Issue:** The forecast line is a `CapacitySummaryChart` feature. In weekly-pattern, ForecastPatternChart renders instead.
**Resolution:** No action. The `showForecast` state lives inside CapacitySummaryChart. When the user switches back to daily, CapacitySummaryChart remounts with `showForecast=false` (its default). This is fine — the forecast toggle is a chart-local control.

### 7c. Worked/Billed lens + weekly-pattern
**Scenario:** User selects "Worked" lens then switches to weekly-pattern.
**Issue:** No DOW-averaged worked hours data exists in the pattern engine.
**Resolution:** ForecastPatternChart renders the base DOW demand vs capacity pattern with no overlay line. The LENS_LINE_CONFIG lookup for "worked"/"billed" returns `undefined` in ForecastPatternChart, so graceful fallback. The lens pill still shows as active. No error, no visual glitch — just no overlay.

### 7d. Events/Concurrent lens + weekly-pattern
**Same as 7c.** No DOW data for these lenses. Base pattern renders normally. No overlay.

### 7e. Scenario-adjusted demand in weekly-pattern
**Scenario:** User activates +10% demand, then views weekly-pattern.
**Issue:** Currently ForecastPatternChart receives raw `demand` (not scenario-adjusted).
**Resolution:** Pass `effectiveDemand` instead of `demand`. The `computeDayOfWeekPattern()` engine inside the chart will average the scenario-adjusted demand, producing +10% higher DOW average bars. This is the correct behavior — the user should see their scenario reflected in both aggregation modes.

### 7f. Empty data / no data state
**Scenario:** No demand data returned from API.
**Issue:** Both charts already handle empty states (show "No data" message).
**Resolution:** No change needed. The aggregation toggle still renders; whichever chart is active shows its empty state.

---

## 8. Files Modified

| File | Action | Change Description |
|------|--------|-------------------|
| `src/components/capacity/aggregation-toggle.tsx` | **Create** | New component: 2-button pill toggle (Daily / Weekly Pattern) |
| `src/app/(authenticated)/capacity/page.tsx` | **Modify** | Add `viewAggregation` useState, render AggregationToggle, change ternary condition, pass `effectiveDemand` to ForecastPatternChart |

**That's it.** Two files. The charts themselves need zero changes — they already accept `activeLens` as a prop and handle lens overlay rendering internally.

---

## 9. Regression Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ForecastPatternChart breaks with non-forecast lens | Low | Medium | Already tested: LENS_LINE_CONFIG returns null, no overlay renders. Verify manually. |
| Scenario-adjusted demand changes DOW averages unexpectedly | Low | Low | By design: scenario should affect pattern. Verify +10% shows higher bars. |
| Chart remount resets internal viewMode on aggregation switch | Expected | Low | Acceptable UX — each chart starts at its default view mode. Not a regression. |
| Component import adds to bundle | Negligible | None | AggregationToggle is tiny (~30 lines). |
| Existing "Forecast" lens behavior changes | **Medium** | Medium | Previously: selecting "Forecast" auto-switched chart. Now: selecting "Forecast" only changes the overlay, chart stays on current aggregation. **This is the intentional behavioral change.** Users who want the pattern view must now explicitly select "Weekly Pattern" aggregation. Mitigated by: the aggregation toggle is clearly visible. |

---

## 10. Verification Checklist

### Automated
- [ ] `npx vitest run` — 557 tests still pass (no test changes expected)
- [ ] `npm run build` — clean
- [ ] `npm run lint` — clean

### Manual (all on `/capacity` page)

**Basic aggregation switching:**
- [ ] Default aggregation is "Daily" — CapacitySummaryChart renders
- [ ] Click "Weekly Pattern" — ForecastPatternChart renders
- [ ] Click "Daily" — back to CapacitySummaryChart
- [ ] Aggregation toggle visible and styled consistently with ScenarioSelector

**Lens independence:**
- [ ] Select "Planned" lens → switch aggregations → both charts render (no overlay line)
- [ ] Select "Allocated" lens → switch to weekly-pattern → amber overlay line visible
- [ ] Select "Forecast" lens → daily view shows teal overlay → weekly-pattern shows teal overlay + projected toggle
- [ ] Select "Worked" lens → daily shows green overlay → weekly-pattern shows base bars only (no overlay)
- [ ] Select "Billed" lens → daily shows indigo overlay → weekly-pattern shows base bars only
- [ ] Select "Events" lens → both aggregations render (no overlay lines in either)
- [ ] Select "Concurrent" lens → daily renders → weekly-pattern shows base bars only

**Feature interactions:**
- [ ] Scenario: activate +10% demand → daily chart shows increased bars → switch to weekly-pattern → DOW averages also reflect +10%
- [ ] 8W Forecast: toggle ON in daily → visible → switch to weekly-pattern → switch back to daily → forecast toggle is OFF (remount reset) — acceptable
- [ ] Gap mode: select "Gap" view in daily chart → switch to weekly-pattern → ForecastPatternChart renders with byShift default → switch back to daily → CapacitySummaryChart renders with byShift default — acceptable
- [ ] Projected toggle: in weekly-pattern → toggle "Projected" → bars swap to projected MH → switch any lens → bars still projected (toggle is chart-internal)
- [ ] KPI strip: unchanged regardless of aggregation switch
- [ ] Heatmap: unchanged regardless of aggregation switch
- [ ] Pie charts: unchanged regardless of aggregation switch
- [ ] Detail table: unchanged regardless of aggregation switch

**Edge states:**
- [ ] Empty data: both aggregations show "No data" placeholder
- [ ] Single-day filter range: daily shows 1 bar → weekly-pattern shows DOW pattern (1 sample per day)

---

## Implementation Order

1. Create `aggregation-toggle.tsx` (~30 lines)
2. Modify `page.tsx`:
   a. Add `useState` for `viewAggregation`
   b. Add `AggregationToggle` to the controls row
   c. Change the chart ternary from `activeLens === "forecast"` to `viewAggregation === "weekly-pattern"`
   d. Change `ForecastPatternChart` `demand` prop from `demand` to `effectiveDemand`
3. Run verification gates
4. Manual test per checklist above
