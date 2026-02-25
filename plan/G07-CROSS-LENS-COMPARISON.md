# G-07: Cross-Lens Comparison — Implementation Plan

**Created:** 2026-02-24
**Branch:** `feat/capacity-layout`
**Gap:** G-07 from `REQ_CapacityDecisionTree.md`
**Status:** Planning

---

## Summary

Allow users to select a **secondary lens overlay** on top of the primary lens, enabling
visual comparison (e.g., Planned primary + Worked secondary overlay). The secondary lens
renders as a distinct, muted line alongside the primary lens overlay.

---

## 1. State Model

### Where secondary lens lives
- **Page-local `useState`** in `CapacityPageInner` (matches scenario/aggregation pattern — not Zustand)
- Type: `CapacityLensId | null`
- Default: `null` (no comparison)

### State shape
```typescript
const [secondaryLens, setSecondaryLens] = useState<CapacityLensId | null>(null);
```

### Clearing rules
| Trigger | Action |
|---------|--------|
| Primary lens changes to match secondary | Auto-clear secondary (`setSecondaryLens(null)`) |
| User clicks the dismiss chip | Clear secondary |
| User selects "None" in compare dropdown | Clear secondary |
| View aggregation changes to weekly-pattern | Keep secondary (ForecastPatternChart has limited support — graceful fallback) |
| Gap view mode active | Secondary overlay hidden in chart (state preserved) |

### No Zustand changes
The Zustand store (`use-capacity-v2.ts`) is **not modified**. Secondary lens is ephemeral
UI state — it does not affect data fetching, API calls, or store shape.

---

## 2. UI Component: `CompareSelector`

### New file: `src/components/capacity/compare-selector.tsx`

A compact dropdown that lets users pick a secondary lens for comparison.

### Placement
In the existing control row on `page.tsx`, next to the LensSelector:

```
┌─ LensSelector [Planned][Allocated][Events]... ─┐  ┌─ ComputeModeBadge ─┐
│                                                  │  │                     │
│  ┌─ CompareSelector ─┐                          │  │                     │
│  │ Compare: [▼ None] │  ← NEW                   │  │                     │
│  │ or                 │                          │  │                     │
│  │ 🔖 vs Worked  ✕   │  ← when active           │  │                     │
│  └────────────────────┘                          │  │                     │
└──────────────────────────────────────────────────┘  └─────────────────────┘
```

### Design
- **Collapsed state**: Small button/pill labeled "Compare" with a chevron
- **Expanded state**: Dropdown listing available secondary lenses, filtered to exclude:
  - The current primary lens
  - `events` and `concurrent` (no overlay line config — these lenses render block/pressure data, not MH lines)
- **Active state**: Pill chip showing `"vs {SecondaryLabel}"` with a dismiss `✕` button
- Visual style: matches the existing pill-button aesthetic of AggregationToggle / ScenarioSelector

### Props
```typescript
interface CompareSelectorProps {
  primaryLens: CapacityLensId;
  secondaryLens: CapacityLensId | null;
  availableLenses: Set<CapacityLensId>;
  onSecondaryChange: (lens: CapacityLensId | null) => void;
}
```

### Lenses eligible as secondary
Only lenses that have entries in `LENS_LINE_CONFIG` (i.e., that produce an overlay line):
- `allocated` — has overlay line (amber, dashed)
- `forecast` — has overlay line (teal, dashed)
- `worked` — has overlay line (green, solid)
- `billed` — has overlay line (indigo, solid)

NOT eligible:
- `planned` — no overlay (it's the base view)
- `events` — overlay is coverage blocks, not a line
- `concurrent` — overlay is peak concurrency, rendered differently

The dropdown additionally filters out:
- The current primary lens (can't compare a lens to itself)
- Lenses not in `availableLenses` (no data for the period)

---

## 3. Chart Changes — `CapacitySummaryChart`

### 3a. New props

```typescript
interface CapacitySummaryChartProps {
  // ... existing props ...
  /** Secondary lens for cross-lens comparison (G-07) */
  secondaryLens?: CapacityLensId | null;
}
```

### 3b. Secondary lens line config

A new constant alongside `LENS_LINE_CONFIG`:

```typescript
/** Muted/distinct style for secondary comparison overlay */
const SECONDARY_LINE_STYLE = {
  strokeWidth: 1.5,        // slightly thinner than primary (2)
  strokeDasharray: "8 4",  // longer dash pattern — visually distinct
  opacity: 0.6,            // muted
  dot: { r: 2 },           // smaller dots
};
```

The secondary lens reuses the *same color* from `LENS_LINE_CONFIG[secondaryLens]` but with
the muted style above. This keeps colors semantically consistent (worked = green, billed = indigo)
while making primary vs secondary visually distinct through dash pattern + opacity.

### 3c. Data computation

The `chartData` useMemo already computes `lensOverlayMH` and `lensOverlay_{shift}` for the
primary lens. For the secondary lens, we add **parallel fields**:

**In total mode:**
```typescript
row.secondaryOverlayMH = <value from secondaryLens field on DailyDemandV2>
```

**In byShift/byCustomer mode:**
```typescript
row[`secondaryOverlay_${shift.code}`] = <value from secondaryLens field on ShiftDemandV2>
```

The switch logic mirrors the existing `lensOverlayMH` switch but reads from the secondary lens:
```typescript
const secondaryLineConfig = secondaryLens && secondaryLens !== "planned"
  ? LENS_LINE_CONFIG[secondaryLens] ?? null
  : null;

// In the data mapping:
if (secondaryLineConfig && dem) {
  switch (secondaryLens) {
    case "allocated": secondaryVal = dem.totalAllocatedDemandMH ?? null; break;
    case "forecast":  secondaryVal = dem.totalForecastedDemandMH ?? null; break;
    case "worked":    secondaryVal = dem.totalWorkedMH ?? null; break;
    case "billed":    secondaryVal = dem.totalBilledMH ?? null; break;
  }
  if (secondaryVal != null) row.secondaryOverlayMH = round1(secondaryVal);
}
```

### 3d. Rendering

Add `<Line>` elements after the existing lens overlay section:

**Total mode — single secondary line:**
```tsx
{viewMode === "total" && secondaryLineConfig && (
  <Line
    yAxisId="mh"
    dataKey="secondaryOverlayMH"
    name={`${secondaryLineConfig.name} (compare)`}
    type="monotone"
    stroke={secondaryLineConfig.stroke}
    strokeWidth={SECONDARY_LINE_STYLE.strokeWidth}
    strokeDasharray={SECONDARY_LINE_STYLE.strokeDasharray}
    strokeOpacity={SECONDARY_LINE_STYLE.opacity}
    dot={{ r: 2, fill: secondaryLineConfig.stroke, strokeWidth: 0, opacity: 0.6 }}
    activeDot={{ r: 4, strokeWidth: 0 }}
    connectNulls
  />
)}
```

**Per-shift mode — 3 secondary lines:**
```tsx
{viewMode !== "total" && viewMode !== "gap" && secondaryLineConfig &&
  activeShifts.map((shift, i) => (
    <Line
      key={`secondary_${shift.code}`}
      yAxisId="mh"
      dataKey={`secondaryOverlay_${shift.code}`}
      name={i === 0 ? `${secondaryLineConfig.name} (compare)` : `${secondaryLineConfig.name} (${shift.name}, compare)`}
      type="monotone"
      stroke={secondaryLineConfig.stroke}
      strokeWidth={SECONDARY_LINE_STYLE.strokeWidth}
      strokeDasharray={SECONDARY_LINE_STYLE.strokeDasharray}
      strokeOpacity={SECONDARY_LINE_STYLE.opacity}
      dot={{ r: 2, fill: secondaryLineConfig.stroke, strokeWidth: 0, opacity: 0.6 }}
      activeDot={{ r: 4, strokeWidth: 0 }}
      connectNulls
      legendType={i === 0 ? undefined : "none"}
    />
  ))}
```

### 3e. Gap mode
When `viewMode === "gap"`, the secondary overlay is **not rendered**. Gap mode is already
visually dense (diverging bars per shift). The secondary lens state is preserved but hidden.

### 3f. Legend entries
- Primary lens: `"Worked"` (existing label, existing color, existing style)
- Secondary lens: `"Allocated (compare)"` (same color as allocated, but with longer dash + muted opacity)
- Both appear in the legend with clear differentiation

---

## 4. Chart Changes — `ForecastPatternChart`

### Limited support
ForecastPatternChart has its own `LENS_LINE_CONFIG` with only `forecast` and `allocated`.
For secondary lens support:

- If `secondaryLens` is in the ForecastPatternChart's `LENS_LINE_CONFIG` → render it with muted style
- If `secondaryLens` is NOT in the config (e.g., `worked`, `billed`) → gracefully skip (no error, no line)

### New prop
```typescript
interface ForecastPatternChartProps {
  // ... existing ...
  secondaryLens?: CapacityLensId | null;
}
```

### Implementation
Add the same secondary overlay computation + rendering pattern. The weekly pattern chart
averages values by day-of-week, so the secondary lens data gets averaged the same way.
This is lower priority and may be **deferred to session 2** depending on time.

---

## 5. KPI Strip Changes

### Optional comparison delta card
When a secondary lens is active, the KPI strip can show **one additional card** with a
comparison metric. This is kept intentionally simple:

```
┌──────────────────────────┐
│ Primary vs Secondary     │
│ Avg Daily Gap: -12.3 MH  │
│ (Worked avg - Allocated avg)│
└──────────────────────────┘
```

### Implementation
- New prop on `CapacityKpiStripProps`: `secondaryLens?: CapacityLensId | null`
- Compute: average primary overlay MH - average secondary overlay MH across all days
- Only shown when both primary and secondary have overlay data
- **Deferred to session 2** — the chart overlay is the core deliverable

---

## 6. Feature Interaction Table

| Feature | Secondary Lens Behavior |
|---------|------------------------|
| **Gap view mode** | Secondary overlay hidden (gap mode too dense) |
| **8W Forecast toggle** | Both visible — forecast is emerald dashed, secondary uses its own color + muted style |
| **Scenario toggle** | Secondary overlay uses scenario-adjusted `effectiveDemand` (same as primary) |
| **Aggregation: Daily** | Full support — secondary renders on CapacitySummaryChart |
| **Aggregation: Weekly Pattern** | Partial support — only if secondary lens is in ForecastPatternChart's LENS_LINE_CONFIG |
| **By Shift view** | Secondary adds 3 more lines (muted) — one per shift |
| **By Customer view** | Secondary overlay renders per-shift (same as primary lens overlay behavior) |
| **Total view** | Secondary adds 1 more line (muted) |
| **Primary = Planned** | No primary overlay line (planned has none); secondary overlay still renders |
| **Drilldown drawer** | Not affected — uses original demand data, no secondary lens concept |
| **Heatmap** | Not affected — heatmap colors from utilization, not lens overlay |
| **Pie charts** | Not affected |
| **Detail table** | Not affected (session 2: could add secondary lens column) |

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| Secondary = primary | Disallowed — filtered from dropdown options |
| Primary changes to match secondary | Auto-clear secondary in a `useEffect` |
| Worked/Billed as secondary on future-heavy range | Line stops at today — acceptable (data is `null` for future dates, `connectNulls` handles gracefully) |
| Events/Concurrent as secondary | Not offered in dropdown (no `LENS_LINE_CONFIG` entry) |
| No data for secondary lens in period | Not offered in dropdown (not in `availableLenses`) |
| Both primary and secondary are solid lines | Differentiated by opacity (0.6) + dash pattern ("8 4") — always distinct |
| Legend overflow with many lines | In byShift mode with secondary: 6 lens lines + 3 capacity + 3 utilization = dense. `legendType="none"` on shift variants keeps legend compact |

---

## 8. Session Scoping

### Session 1 (this session) — Core Deliverable
1. ✅ `CompareSelector` component (dropdown + active chip)
2. ✅ `page.tsx` state management (secondary lens state, auto-clear effect, prop passing)
3. ✅ `CapacitySummaryChart` — secondary overlay rendering (total + byShift + byCustomer modes)
4. ✅ Build + lint + test verification

### Session 2 (deferred)
1. `ForecastPatternChart` secondary overlay support
2. KPI strip comparison delta card
3. Detail table secondary lens column
4. Additional refinements based on user feedback

---

## 9. Files Modified

| File | Action | Changes |
|------|--------|---------|
| `src/components/capacity/compare-selector.tsx` | **Create** | New component: dropdown + chip UI |
| `src/components/capacity/capacity-summary-chart.tsx` | **Modify** | Add `secondaryLens` prop, secondary data computation, secondary Line rendering |
| `src/app/(authenticated)/capacity/page.tsx` | **Modify** | Add `secondaryLens` useState, auto-clear useEffect, pass to chart + CompareSelector |
| `src/types/index.ts` | **No change** | CapacityLensId already has all 7 values |
| `src/lib/capacity/lens-config.ts` | **No change** | Lens metadata already sufficient |
| `src/lib/hooks/use-capacity-v2.ts` | **No change** | Secondary lens is page-local state |

### Files NOT modified (guardrails)
- No engine files (`*-engine.ts`)
- No API routes
- No data computation changes
- No Zustand store changes
- Existing primary lens behavior unchanged
- Scenarios, gap view, forecast toggle, today line, aggregation toggle all untouched

---

## 10. Regression Risks

| Risk | Mitigation |
|------|-----------|
| Extra `<Line>` elements slow chart rendering | Secondary adds at most 3 lines (byShift) or 1 (total) — negligible |
| `chartData` useMemo deps change | Adding `secondaryLens` + `secondaryLineConfig` to deps array |
| Legend overflow | `legendType="none"` on per-shift secondary variants |
| Tooltip gets crowded | Secondary lines use standard Recharts tooltip — rows are labeled with "(compare)" |
| Existing lens overlay breaks | Primary overlay code path is UNTOUCHED — secondary is additive only |

---

## 11. Verification Checklist

### Functional
- [ ] CompareSelector renders next to LensSelector
- [ ] Dropdown excludes: primary lens, events, concurrent, planned, unavailable lenses
- [ ] Selecting secondary shows active chip with dismiss button
- [ ] Chart renders secondary overlay line with muted style (longer dash, lower opacity)
- [ ] Switching primary lens to match secondary auto-clears secondary
- [ ] Gap view mode hides secondary overlay
- [ ] 8W Forecast toggle + secondary lens both visible simultaneously
- [ ] Scenario toggle applies to secondary overlay data
- [ ] By Shift mode shows 3 secondary lines (muted variants)
- [ ] Total mode shows 1 secondary line
- [ ] Legend has "(compare)" label for secondary entries
- [ ] No secondary overlay when `secondaryLens` is null

### Technical
- [ ] `npx vitest run` — all 574+ tests pass
- [ ] `npm run build` — clean
- [ ] `npm run lint` — no new errors
- [ ] No engine files modified
- [ ] No API changes
- [ ] No Zustand store changes
