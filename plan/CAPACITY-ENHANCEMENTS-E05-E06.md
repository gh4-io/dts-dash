# Capacity Model Enhancements E-05 + E-06: Implementation Plan

**Created:** 2026-02-24
**Branch:** `feat/capacity-layout`
**Depends on:** E-01 through E-04 (assumes implemented)
**Spec:** `.claude/SPECS/REQ_CapacityDecisionTree.md` (gaps G-05, G-06)
**Status:** Ready for implementation

## Context

After E-01–E-04, the remaining high-value low-effort gaps are:
- **G-05:** Capacity model mode is invisible to the user (rotation vs headcount-plan)
- **G-06:** No visual boundary between historical and future data on the daily chart

Both are UI-only changes. No new engines, no API changes, no types to add. Combined scope fits a single session.

## Gap Status After E-01–E-04

| Gap | Addressed By | Remaining? |
|-----|-------------|------------|
| G-01 | Not addressed | Yes — aggregation still coupled to Forecast lens |
| G-02 | Partially by E-01 | Rate-based forecast still weekly-only |
| G-03 | E-01 | No — rolling forecast uses configurable history window |
| G-04 | Not addressed | Yes — projections only on ForecastPatternChart |
| G-05 | **E-05 (this plan)** | No |
| G-06 | **E-06 (this plan)** | No |
| G-07 | Not addressed | Yes — Tier 3 |
| G-08 | E-03 | No — gap view mode implemented |
| G-09 | Not addressed | Yes — Tier 3 |
| G-10 | Not addressed | Yes — Tier 3 |

---

## E-05: Compute Mode Visibility Badge (G-05)

### Purpose

Show which capacity computation path is active (rotation-based vs headcount-plan-based) and the name of the active staffing configuration. All data already exists in the Zustand store — this is purely a rendering task.

### Files

| File | Action |
|------|--------|
| `src/components/capacity/compute-mode-badge.tsx` | **Create** |
| `src/app/(authenticated)/capacity/page.tsx` | Modify — destructure + render badge |

### No New Types Required

Already exist in the store:
- `computeMode: CapacityComputeMode` — `"headcount" | "staffing"`
- `activeStaffingConfigName: string | null`

Both are returned by `useCapacityV2()` (confirmed at `use-capacity-v2.ts` lines 157, 159).

### Component: `ComputeModeBadge`

```typescript
// src/components/capacity/compute-mode-badge.tsx
"use client";

import type { CapacityComputeMode } from "@/types";

interface ComputeModeBadgeProps {
  computeMode: CapacityComputeMode;
  activeStaffingConfigName: string | null;
}

export function ComputeModeBadge({
  computeMode,
  activeStaffingConfigName,
}: ComputeModeBadgeProps) {
  const isStaffing = computeMode === "staffing";
  const icon = isStaffing ? "fa-calendar-days" : "fa-people-group";
  const modeLabel = isStaffing ? "Rotation" : "Headcount Plan";
  const configName = activeStaffingConfigName ?? "Default";

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px]
        bg-muted/50 text-muted-foreground border border-border"
      title={`Capacity model: ${modeLabel}${isStaffing ? ` (${configName})` : ""}`}
    >
      <i className={`fa-solid ${icon} text-[9px]`} />
      <span className="font-medium">{modeLabel}</span>
      {isStaffing && activeStaffingConfigName && (
        <>
          <span className="text-border">|</span>
          <span className="truncate max-w-[120px]">{configName}</span>
        </>
      )}
    </div>
  );
}
```

### Page Integration

In `CapacityPageInner`, destructure from existing hook:
```typescript
const {
  // ...existing...
  computeMode,
  activeStaffingConfigName,
} = useCapacityV2();
```

Place badge after the lens/scenario selectors, before the KPI strip:
```tsx
<div className="flex items-center gap-2 flex-wrap">
  <ComputeModeBadge
    computeMode={computeMode}
    activeStaffingConfigName={activeStaffingConfigName}
  />
</div>
```

### Edge Cases

| Case | Handling |
|------|----------|
| No active staffing config | `computeMode` = "headcount", badge shows "Headcount Plan" |
| Very long config name | Truncated at 120px with CSS `truncate` |
| Page loading | Badge not rendered until `isLoading` is false (gated by existing conditional) |
| Both tables empty (zero capacity) | Badge still renders — shows "Headcount Plan" (the default mode) |

### Verification

Manual:
1. With rotation config active → badge shows "Rotation | Default Configuration"
2. Badge tooltip shows full description
3. Badge is visually unobtrusive — does not compete with KPI cards
4. Long config names truncate with ellipsis

---

## E-06: Today Line + Future Date Shading (G-06)

### Purpose

Add a vertical "Today" reference line and subtle future-date shading to `CapacitySummaryChart`. This eliminates confusion when Worked/Billed lenses show overlay lines that stop abruptly at present.

### Files

| File | Action |
|------|--------|
| `src/components/capacity/capacity-summary-chart.tsx` | Modify — add ReferenceLine + ReferenceArea |

### No New Files, Types, or Engines

This is purely a chart rendering change.

### Algorithm

**Step 1: Compute today string**
```typescript
const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
```

**Step 2: Find today's formatted label (if in range)**
```typescript
const todayLabel = useMemo(() => {
  if (chartData.length === 0) return null;
  const dates = chartData.map((r) => (r as Record<string, unknown>).date as string).filter(Boolean);
  if (dates.length === 0) return null;
  if (todayStr < dates[0] || todayStr > dates[dates.length - 1]) return null;
  return formatDate(todayStr);
}, [chartData, todayStr]);
```

**Step 3: Get last chart label for shading boundary**
```typescript
const lastChartLabel = useMemo(() => {
  if (chartData.length === 0) return null;
  return (chartData[chartData.length - 1] as Record<string, unknown>).label as string;
}, [chartData]);
```

**Step 4: Render ReferenceLine + ReferenceArea**
```tsx
// Import ReferenceArea from recharts (add to existing import)

// Inside <ComposedChart>, after <CartesianGrid>:
{todayLabel && (
  <>
    <ReferenceLine
      yAxisId="mh"
      x={todayLabel}
      stroke="hsl(var(--foreground))"
      strokeDasharray="2 2"
      strokeWidth={1.5}
      strokeOpacity={0.4}
      label={{
        value: "Today",
        position: "top",
        fill: "hsl(var(--muted-foreground))",
        fontSize: 9,
      }}
    />
    {lastChartLabel && todayLabel !== lastChartLabel && (
      <ReferenceArea
        yAxisId="mh"
        x1={todayLabel}
        x2={lastChartLabel}
        fill="hsl(var(--muted-foreground))"
        fillOpacity={0.04}
        strokeOpacity={0}
      />
    )}
  </>
)}
```

### Interaction with Existing Features

| Feature | Behavior |
|---------|----------|
| **Worked lens** | Overlay line ends at/before today. Future shading makes the gap visually clear. |
| **Billed lens** | Same as Worked. |
| **Planned/Allocated/Events/Concurrent** | These can project into the future. Today line acts as a contextual marker. |
| **Gap view mode (E-03)** | Today line renders normally. Gap bars span both zones. |
| **8W Forecast toggle (E-01)** | Today line is in the historical section. Forecast boundary marker (from E-01) is at end of historical data. Both visible simultaneously. |
| **Scenario toggle (E-02/E-04)** | No interaction — today line is independent of scenario selection. |

### Edge Cases

| Case | Handling |
|------|----------|
| Range entirely in the past | `todayLabel` = null → no line, no shading |
| Range entirely in the future | `todayLabel` = null → no line, no shading |
| Today is last day in range | Line at end, no shading (condition: `todayLabel !== lastChartLabel`) |
| Very narrow range (1-3 days) | "Today" label may crowd x-axis. Acceptable — `fontSize: 9` keeps it small. |
| Forecast toggle ON | Two vertical markers: today + forecast boundary. Distinguishable by style (today = dashed, forecast boundary = solid from E-01). |

### Assumptions

1. **`ReferenceArea` works with categorical x-axis** — Recharts supports this for `ComposedChart` with categorical `dataKey`. **Risk:** Low.
2. **`hsl(var(--foreground))` resolves in chart context** — If not, fallback to `#888888`. Other chart reference lines use hardcoded hex, so this is slightly inconsistent but more theme-aware.
3. **`ReferenceArea` z-index renders behind bars** — At `fillOpacity={0.04}`, overlap is barely visible either way.

### Verification

Manual:
1. Date range spanning today → vertical dashed "Today" line visible
2. Future zone has faint background shading (barely visible, does not interfere)
3. Range entirely past → no today line
4. Range entirely future → no today line
5. Worked lens → overlay line stops before today, future zone is visually "empty"
6. Billed lens → same
7. Gap view mode → today line still renders
8. 8W Forecast ON → both today line and forecast boundary visible without conflict
9. Resize browser → today line repositions correctly

---

## Regression Risks

| Risk | Mitigation |
|------|-----------|
| `ReferenceArea` import missing | It's in the standard `recharts` package, already a project dependency |
| Today label collides with other reference labels | "Today" at `position: "top"`, existing lines at `position: "right"` |
| Shading covers tooltip hover | `fillOpacity={0.04}` is near-invisible, no interaction interference |
| `formatDate` label mismatch | Both x-axis and today use the same `formatDate()` function |
| Badge layout breaks page flow | Badge is a separate div, not inline with KPI cards |

---

## Post-Implementation Gates

```bash
npm run build       # clean
npm run lint        # no new warnings
npx vitest run      # all existing tests still pass (no new engine tests)
```

Full manual verification per the checklists above.

---

## Complete File Inventory

### New Files (1)
| File | Purpose |
|------|---------|
| `src/components/capacity/compute-mode-badge.tsx` | E-05: Capacity model mode badge |

### Modified Files (2)
| File | Changes |
|------|---------|
| `src/app/(authenticated)/capacity/page.tsx` | Wire computeMode + configName to badge |
| `src/components/capacity/capacity-summary-chart.tsx` | Add ReferenceArea import, today line, future shading |

### No Changes To
- Types, engines, barrel exports, API routes, Zustand store, tests
