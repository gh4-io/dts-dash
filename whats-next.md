# Handoff Document — Capacity Charts Redesign + Capacity Zero Bug

**Created:** 2026-02-23
**Branch:** `feat/capacity-layout`
**Last Commit:** `2d1be9b` — `feat(capacity): enhance projection overlay with per-customer-per-shift breakdown`
**Repo:** `gh4-io/dts-dash`
**Status:** Chart redesign COMPLETE. Capacity-zero bug INVESTIGATION IN PROGRESS, root cause unknown.

---

<original_task>

Two tasks were requested this session:

1. **Implement "Grouped Bars by Day + Per-Shift Lines" chart redesign** — Rewrite both capacity chart components (`capacity-summary-chart.tsx` and `forecast-pattern-chart.tsx`) to change the X-axis from shift-per-tick (one tick per shift per day, using `flatMap`) to day-per-tick (one tick per day, using `map`) with 3 grouped bars per day (DAY/SWING/NIGHT). The prior v2 had used `flatMap` which created separate X-axis ticks for each shift — visually wrong. The new design keeps X-axis at day level with 3 grouped bars within each tick. Applies to `byShift` (3 grouped bars side-by-side) and `byCustomer` (N×3 stacked bars grouped by shift) view modes.

2. **Investigate why capacity shows 0 on Thursday, Friday, and Saturday** — User reported seeing zero capacity values on those days in the `/capacity` page charts, despite staffing rotation data existing for all days of the week.

</original_task>

---

<work_completed>

## Task 1: Chart Redesign — COMPLETE ✅ (All changes committed)

### Files Modified:

#### `src/components/capacity/capacity-summary-chart.tsx` (482 lines, full rewrite)
- **Data shape change**: Each `chartData` row represents 1 calendar day (`.map()` over `utilization` array), with per-shift field naming convention:
  - `demand_DAY`, `demand_SWING`, `demand_NIGHT` (bars, byShift mode)
  - `demand_DAY_CustomerName`, `demand_SWING_CustomerName` etc. (bars, byCustomer mode)
  - `capacity_DAY`, `capacity_SWING`, `capacity_NIGHT` (capacity lines)
  - `utilization_DAY`, `utilization_SWING`, `utilization_NIGHT` (utilization lines, right Y-axis)
  - `lensOverlay_DAY`, `lensOverlay_SWING`, `lensOverlay_NIGHT` (optional lens lines)
- **View mode rendering**:
  - `total`: 1 `<Bar>` per day (colored by utilization via `<Cell>`), 1 capacity line, 1 utilization line
  - `byShift`: 3 `<Bar>` components (no `stackId` → side-by-side grouped), 3 capacity lines (dashed, shift-colored), 3 utilization lines (solid, shift-colored)
  - `byCustomer`: `activeShifts.flatMap(shift => allCustomers.map(customer => <Bar>))` with `stackId={shift.code}` → 3 grouped stacks. Uses `legendType={shiftIdx === 0 ? undefined : "none"}` to avoid duplicate legend entries per customer.
- **Lines**: Per-shift modes render capacity lines (dashed) + utilization lines (solid). First shift gets legend entry, others get `legendType="none"`.
- **Lens overlays**: Supports allocated/forecast/worked/billed per-shift lens lines.
- **XAxis**: `dataKey="label"`, `interval={0}`, `height={30}`, no angle rotation needed anymore.

#### `src/components/capacity/forecast-pattern-chart.tsx` (448 lines, full rewrite)
- Same grouped-bar structure but for "Typical Week Pattern" (7 day-of-week entries Mon–Sun).
- **Projection overlay system** (integrated from user's prior work + critical behavior fix):
  - Fetches `/api/capacity/weekly-projections` on mount → builds `ProjectionDayOverlay[]` via `buildProjectionOverlay()`
  - `showProjections` state toggle + `projectionOverlay` state
  - Toggle button appears only when `projectionOverlay !== null` (data was loaded and has non-zero values)
  - **CRITICAL FIX: "Projected" toggle swaps bar data source, does NOT add lines**
- **Data source swap logic** (chartData useMemo, lines 123–212):
  - `const useProjected = showProjections && projectionOverlay != null;`
  - When `useProjected === true`:
    - `byShift` mode: `row[demand_${shift.code}] = pDay.projectedByShift[shift.code] ?? 0`
    - `byCustomer` mode: `row[demand_${shift.code}_${customer}] = pDay.projectedByCustomerByShift[shift.code]?.[customer] ?? 0`
    - `total` mode: `avgDemandMH = pDay.projectedTotal`
  - When `useProjected === false`: uses pattern engine's historical averages
  - Lens overlays hidden when projected is active
  - Y-axis label: "Projected MH" vs "Avg Man-Hours"
  - Bar legend: "Projected" vs "Avg Demand"
- **`allCustomers` merge** (lines 102–121): Collects customers from both historical pattern (`patternResult.pattern[].avgDemandByCustomerByShift`) AND projection overlay (`projectionOverlay[].projectedByCustomer`) to handle customers that may appear in projections but not historical data.

#### `src/lib/capacity/projection-engine.ts` — `buildProjectionOverlay()` (lines 53–99)
- Added `byCustomerByShift` cross-product aggregation inside the main loop:
  ```typescript
  if (!byCustomerByShift[entry.shiftCode]) {
    byCustomerByShift[entry.shiftCode] = {};
  }
  byCustomerByShift[entry.shiftCode][entry.customer] =
    (byCustomerByShift[entry.shiftCode][entry.customer] ?? 0) + mh;
  ```
- Added rounding pass for customer×shift values before pushing to result.
- Result now includes `projectedByCustomerByShift: roundedByCustomerByShift`.

#### `src/types/index.ts` — `ProjectionDayOverlay` interface (line ~931)
- Added field: `projectedByCustomerByShift: Record<string, Record<string, number>>` with JSDoc `/** shiftCode → customer → projectedMH */`

### The Projected Behavior Fix (Critical Design Decision)
- **Before (wrong)**: "Projected" toggle added pink dashed `<Line>` series overlaying the bars. Values ~240 MH on projected lines compressed ~20 MH demand bars to near-invisible slivers.
- **After (correct)**: "Projected" toggle swaps the bar data source. No separate projected Line series. User's explicit correction: "the projected should replace the bars and not add lines."

### Build Verification
- `npm run build`: PASSES (verified)
- `npm run lint`: Clean (no new warnings)
- Tests: Not re-run this session (last known: 439 passing from prior session)

---

## Task 2: Capacity = 0 on Thu/Fri/Sat Investigation — IN PROGRESS ⏳

### Investigation Actions Taken:

1. **Queried all staffing/capacity DB tables via direct `better-sqlite3`** — All data present and correct (see DB state below)
2. **Manually reimplemented `isWorkingDay()` rotation logic** in a tsx script — Traced all 6 staffing shifts across 7 days (Feb 16–22). Result: ALL days have non-zero total headcount.
3. **Queried work packages by day-of-week** — Thu=95, Fri=88, Sat=99 WPs in February. No data gaps.
4. **Read all engine source code**: `resolveStaffingForCapacity()` (staffing-engine.ts:392), `resolveStaffingDay()` (staffing-engine.ts:81), `isWorkingDay()` (staffing-engine.ts:31), `computeDailyCapacityFromStaffing()` (capacity-core.ts:153), `computeDayOfWeekPattern()` (forecast-pattern-engine.ts:132)
5. **Attempted to execute actual engine pipeline via `npx tsx -e`** — FAILED (see Attempted Approaches)
6. **Could not hit the live API** — Auth required, no dev server running, curl redirects to /login

### Database State (all verified via direct SQL):

**`staffing_configs`**: 1 active config (id=1, "Default Configuration")

**`staffing_shifts`** (6 rows, all active, config_id=1):
| id | Name    | Category | Headcount | rotation_id | rotation_start_date |
|----|---------|----------|-----------|-------------|---------------------|
| 3  | WKD-10  | DAY      | 10        | 6           | 2026-01-04          |
| 6  | FSD-13  | DAY      | 20        | 7           | 2026-01-04          |
| 7  | SMD-13  | DAY      | 12        | 7           | **2026-01-05** (offset!) |
| 4  | WKS-10  | SWING    | 8         | 6           | 2026-01-04          |
| 5  | WDN-10  | NIGHT    | 20        | 6           | 2026-01-04          |
| 8  | WEN-13  | NIGHT    | 28        | 7           | 2026-01-04          |

**`rotation_patterns`** (2 active):
| id | Name    | Pattern (21-char)           |
|----|---------|-----------------------------|
| 6  | WKD-410 | `oxxxxoooxxxxoooxxxxoo`      |
| 7  | WKE-313 | `xooooxxxooooxxxooooxx`      |

**`capacity_shifts`** (3 base shifts, all active — used as mapping keys):
| id | code  | Name  | start_hour | end_hour | paid_hours | min_headcount | sort_order |
|----|-------|-------|------------|----------|------------|---------------|------------|
| 1  | DAY   | Day   | 7          | 15       | 8          | 1             | 0          |
| 2  | SWING | Swing | 15         | 23       | 8          | 1             | 1          |
| 3  | NIGHT | Night | 23         | 7        | 8          | 1             | 2          |

**`headcount_plans`**: EMPTY (0 rows) — confirmed by user: "we only use staffing rotation now"

**`capacity_assumptions`**: `paid_to_available=0.89`, `available_to_productive=0.65`, `night_productivity_factor=1.0`, `demand_curve=WEIGHTED`, `allocation_mode=DISTRIBUTE`

### Manual Rotation Trace (Feb 16–22, 2026):
```
Mon 2026-02-16: DAY=22 SWING=8  NIGHT=20 total=50
  WKD-10=WORK(idx=1) FSD-13=off(idx=1)  SMD-13=WORK(idx=0) WDN-10=WORK(idx=1) WEN-13=off(idx=1)  WKS-10=WORK(idx=1)

Tue 2026-02-17: DAY=10 SWING=8  NIGHT=20 total=38
  WKD-10=WORK(idx=2) FSD-13=off(idx=2)  SMD-13=off(idx=1)  WDN-10=WORK(idx=2) WEN-13=off(idx=2)  WKS-10=WORK(idx=2)

Wed 2026-02-18: DAY=10 SWING=8  NIGHT=20 total=38
  WKD-10=WORK(idx=3) FSD-13=off(idx=3)  SMD-13=off(idx=2)  WDN-10=WORK(idx=3) WEN-13=off(idx=3)  WKS-10=WORK(idx=3)

Thu 2026-02-19: DAY=10 SWING=8  NIGHT=20 total=38
  WKD-10=WORK(idx=4) FSD-13=off(idx=4)  SMD-13=off(idx=3)  WDN-10=WORK(idx=4) WEN-13=off(idx=4)  WKS-10=WORK(idx=4)

Fri 2026-02-20: DAY=20 SWING=0  NIGHT=28 total=48
  WKD-10=off(idx=5)  FSD-13=WORK(idx=5) SMD-13=off(idx=4)  WDN-10=off(idx=5)  WEN-13=WORK(idx=5) WKS-10=off(idx=5)

Sat 2026-02-21: DAY=32 SWING=0  NIGHT=28 total=60
  WKD-10=off(idx=6)  FSD-13=WORK(idx=6) SMD-13=WORK(idx=5) WDN-10=off(idx=6)  WEN-13=WORK(idx=6) WKS-10=off(idx=6)

Sun 2026-02-22: DAY=32 SWING=0  NIGHT=28 total=60
  WKD-10=off(idx=7)  FSD-13=WORK(idx=7) SMD-13=WORK(idx=6) WDN-10=off(idx=7)  WEN-13=WORK(idx=7) WKS-10=off(idx=7)
```

**Key finding: No day has zero total capacity. But SWING = 0 on Fri/Sat/Sun.**

</work_completed>

---

<work_remaining>

## Primary: Resolve the "Capacity = 0 on Thu/Fri/Sat" Bug

### Step 1: Clarify the symptom with the user
- Which chart shows the zeros — "Demand vs Capacity" (summary chart, daily timeline) or "Typical Week Pattern" (forecast chart, Mon–Sun averages)? Or both?
- Which view mode — Total, By Shift, or By Customer?
- Is it ALL capacity = 0, or just certain shifts? (SWING is legitimately 0 on Fri/Sat/Sun — only WKD-410 has SWING category, and that rotation is off on weekends)

### Step 2: Hit the live API and inspect the response
- Start dev server (`npm run dev`), log in, open browser DevTools → Network tab
- Navigate to `/capacity` and capture the `/api/capacity/overview` XHR response
- Examine `response.capacity` array: for dates on Thu/Fri/Sat:
  - Is `totalProductiveMH` > 0?
  - What does `byShift[].productiveMH` show for each shift code (DAY/SWING/NIGHT)?
- **If API returns zeros** → bug is in server-side pipeline → go to Step 3
- **If API returns non-zero** → bug is in chart rendering → go to Step 4

### Step 3: Trace the server pipeline (if API returns zeros)
- Add logging to `src/app/api/capacity/overview/route.ts` after line 97:
  ```typescript
  log.info({ sampleCapacity: capacity.slice(0, 7).map(c => ({
    date: c.date, total: c.totalProductiveMH,
    byShift: c.byShift.map(s => ({ code: s.shiftCode, hc: s.rosterHeadcount, mh: s.productiveMH }))
  })) }, "Capacity sample");
  ```
- Also log `staffingMap` output from line 96 — check if Map has entries for the affected dates
- Verify `loadStaffingShifts(activeConfig.id)` returns all 6 shifts
- Verify `buildPatternMap(patterns)` correctly maps pattern id 6 and 7

### Step 4: Trace the chart rendering (if API returns non-zero)
- In browser DevTools, set breakpoint in `capacity-summary-chart.tsx` chartData useMemo (~line 102)
- Check that `cap?.byShift.find(s => s.shiftCode === shift.code)` returns matches for DAY/SWING/NIGHT
- Verify `capacity_DAY`, `capacity_SWING`, `capacity_NIGHT` fields are populated in each chartData row
- For forecast chart: verify `p.avgCapacityByShift[shift.code]` has values in the pattern result

### Step 5: Write a targeted vitest test (if engine inspection is needed)
- Create `src/__tests__/capacity/capacity-zero-debug.test.ts`:
  ```typescript
  import { resolveStaffingForCapacity, loadActiveStaffingConfig, loadStaffingShifts, loadRotationPatterns, buildPatternMap } from "@/lib/capacity";
  import { computeDailyCapacityFromStaffing, loadShifts, loadAssumptions } from "@/lib/capacity";

  test("capacity is non-zero on all days of week", () => {
    const config = loadActiveStaffingConfig()!;
    const staffingShifts = loadStaffingShifts(config.id);
    const patterns = loadRotationPatterns(true);
    const patternMap = buildPatternMap(patterns);
    const dates = ["2026-02-16","2026-02-17","2026-02-18","2026-02-19","2026-02-20","2026-02-21","2026-02-22"];
    const staffingMap = resolveStaffingForCapacity(dates, staffingShifts, patternMap);
    const shifts = loadShifts();
    const assumptions = loadAssumptions()!;
    const capacity = computeDailyCapacityFromStaffing(dates, shifts, staffingMap, assumptions);

    for (const day of capacity) {
      expect(day.totalProductiveMH).toBeGreaterThan(0);
    }
  });
  ```
- Run with `npx vitest run src/__tests__/capacity/capacity-zero-debug.test.ts`
- This works because vitest resolves `@/` aliases via tsconfig

### Step 6: Check the "SWING = 0 on weekends" hypothesis
- If user is looking at By Shift view: SWING bars WILL be 0 on Fri/Sat/Sun — this is correct behavior
- But this doesn't explain Thursday (SWING=8 on Thu in the trace)
- Present this finding to user and ask for clarification

## Secondary: Visual verification of chart redesign
- Open `/capacity` in browser, verify both charts render grouped bars correctly
- Test all 3 view modes (Total, By Shift, By Customer)
- Switch to Forecast lens, test the Projected toggle
- Verify projection data swap works in all view modes (total, byShift, byCustomer)

## Tertiary: Run test suite
- `npx vitest run` — verify all tests still pass (last known: 439)

</work_remaining>

---

<attempted_approaches>

## Approach 1: Execute actual engine pipeline via `npx tsx -e` — FAILED
- Tried: `npx tsx -e "import { resolveStaffingForCapacity } from './src/lib/capacity/staffing-engine'; ..."`
- Also tried: `const mod = require('./src/lib/capacity/staffing-engine');`
- **Why it failed**: `@/` path aliases (e.g., `@/types`, `@/lib/capacity`) don't resolve outside the Next.js build system. The `@/` is mapped to `./src/` in `tsconfig.json` but `tsx` doesn't read that config for `-e` evaluation.
- **Workaround used**: Reimplemented `isWorkingDay()` in plain JS within the `tsx -e` script, plus direct `better-sqlite3` queries.
- **Better approach**: Use vitest (has proper tsconfig path resolution) or write a temporary `.ts` file and run with `npx tsx path/to/file.ts` (file-based execution does resolve aliases).

## Approach 2: Direct SQL queries via `better-sqlite3` — SUCCEEDED
- `npx tsx -e "const Database = require('better-sqlite3'); const db = new Database('data/dashboard.db'); ..."` works fine
- Successfully extracted: staffing_configs, staffing_shifts (6 rows), rotation_patterns (2 rows), capacity_shifts (3 rows), headcount_plans (0 rows), capacity_assumptions, work_packages count by day-of-week
- Limitation: Can only inspect raw DB state, not computed engine output

## Approach 3: Manual rotation trace in plain JS — SUCCEEDED
- Reimplemented `isWorkingDay(targetDate, pattern, rotationStartDate)` in a tsx one-liner:
  ```javascript
  const target = new Date(targetDate + 'T00:00:00Z');
  const start = new Date(rotationStartDate + 'T00:00:00Z');
  const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000);
  const dayIndex = ((diffDays % pattern.length) + pattern.length) % pattern.length;
  return pattern[dayIndex] === 'x';
  ```
- Confirmed: All 6 shifts × 7 days trace correctly. Total headcount is non-zero every day.
- Limitation: This is static analysis of the math — doesn't prove the actual engine pipeline produces the same result (could be a data loading issue, caching issue, or runtime discrepancy)

## Approach 4: curl the API — BLOCKED
- `curl http://localhost:3000/api/capacity/overview` returns redirect to `/login`
- All capacity routes require authentication via Auth.js
- No dev server was running at the time

## SQL query gotchas encountered
- Initial queries used wrong column names (`is_active` not on `headcount_plans`; `scheduled_arrival` not on `work_packages` — actual column is `arrival`). Fixed by querying `PRAGMA table_info(table_name)` first.
- Triple-quoted strings (`"""`) don't work in TypeScript — caused `tsx` parse error. Fixed by using single-line SQL strings.

## Dead End: The rotation math is NOT the bug
- Manual trace exactly matches `isWorkingDay()` function logic
- All rotation patterns are correct, start dates are correct
- SMD-13's offset (2026-01-05 vs 01-04) is correctly handled by modulo arithmetic
- The computed headcount values (DAY=10-32, SWING=0-8, NIGHT=20-28) are reasonable
- **The bug must be elsewhere** — either in data loading, engine execution, or chart rendering

</attempted_approaches>

---

<critical_context>

## Architecture: How Capacity is Computed (Staffing Rotation Path)

The system has two capacity computation paths. The DB currently uses the staffing rotation path (headcount_plans table is empty).

```
API Route: GET /api/capacity/overview
  src/app/api/capacity/overview/route.ts

  1. loadActiveStaffingConfig() → config id=1 ✓
  2. loadStaffingShifts(config.id) → 6 staffing shifts
  3. loadRotationPatterns(true) → 2 active patterns
  4. buildPatternMap(patterns) → Map<patternId, RotationPattern>
  5. resolveStaffingForCapacity(dates, staffingShifts, patternMap)
     └─ Returns: Map<date, Map<categoryCode, {headcount, effectivePaidHours}>>
     └─ Iterates dates → resolveStaffingDay() → isWorkingDay() per shift
     └─ Aggregates by category (DAY/SWING/NIGHT), skips OTHER
     └─ KEY: if shift.isActive is false or rotation.isActive is false → skipped
  6. computeDailyCapacityFromStaffing(dates, baseShifts, staffingMap, assumptions)
     └─ For each date + each active base shift:
        staffing = staffingMap.get(date)?.get(shift.code)
        headcount = staffing?.headcount ?? 0  // ← defaults to 0 if key not in map
        effectiveHeadcount = headcount × paidToAvailable (0.89)
        productiveMH = effectiveHeadcount × paidHoursPerPerson × availableToProductive (0.65)
     └─ Returns: DailyCapacityV2[] with byShift breakdown
  7. Compute demand from work packages (only dates with WPs)
  8. Apply overlays: allocations, concurrency, forecast, worked, billed
  9. Compute utilization, return JSON
```

## Key Engine Functions (with locations):

| Function | File | Line | Purpose |
|----------|------|------|---------|
| `isWorkingDay` | staffing-engine.ts | 31 | Date diff mod 21 → pattern char check |
| `resolveStaffingDay` | staffing-engine.ts | 81 | Aggregate shifts by category for one date |
| `resolveStaffingForCapacity` | staffing-engine.ts | 392 | Build Map<date, Map<category, {headcount, eph}>> |
| `computeDailyCapacityFromStaffing` | capacity-core.ts | 153 | staffing map → DailyCapacityV2[] |
| `computeDayOfWeekPattern` | forecast-pattern-engine.ts | 132 | Aggregate demand+capacity by day-of-week |
| `computeDailyDemandV2` | demand-engine.ts | ~80 | WPs → DailyDemandV2[] (only dates with data) |

## Critical Mapping: Staffing Categories → Base Shift Codes

The `resolveStaffingForCapacity` output uses staffing shift **categories** (DAY/SWING/NIGHT) as map keys.
The `computeDailyCapacityFromStaffing` looks up using base **capacity_shifts[].code** (also DAY/SWING/NIGHT).
These MUST match exactly (case-sensitive string comparison). Currently they do match.

## SWING = 0 on Weekends is REAL (Not a Bug)

Only one staffing shift has category SWING: `WKS-10` (headcount=8, rotation=WKD-410).
Pattern WKD-410 = `oxxxxoooxxxxoooxxxxoo` — positions 0, 5, 6, 7, 8, 9, 10, ... have 'o' (off).
For dates that map to index 5, 6, or 7 in the 21-day cycle → SWING headcount = 0.
This means on approximately 3/21 ≈ 14% of days, SWING legitimately has zero capacity.
In the Feb 16–22 trace: Fri=0, Sat=0, Sun=0 for SWING.

## Chart Architecture

### Two chart components on `/capacity` page (page.tsx line 199):
```typescript
{activeLens === "forecast" ? (
  <ForecastPatternChart demand={demand} capacity={capacity} shifts={shifts} activeLens={activeLens} fillHeight />
) : (
  <CapacitySummaryChart capacity={capacity} demand={demand} utilization={utilization} shifts={shifts} activeLens={activeLens} fillHeight />
)}
```

1. **`CapacitySummaryChart`** — Daily bars + lines. Shown for all lenses EXCEPT "forecast".
2. **`ForecastPatternChart`** — Day-of-week averages (Mon–Sun). Shown ONLY when activeLens === "forecast".

Both charts use the same structure:
- **View modes**: `total`, `byShift`, `byCustomer` (toggle buttons in header)
- **Data shape**: 1 row per X-axis tick, per-shift fields: `demand_${shiftCode}`, `capacity_${shiftCode}`, etc.
- **Bars**: Demand values (grouped by shift in byShift mode, stacked by customer in byCustomer)
- **Lines**: Capacity (dashed), Utilization (solid, pct Y-axis), Lens overlays
- **Colors**: DAY=`#f59e0b` (amber), SWING=`#f97316` (orange), NIGHT=`#6366f1` (indigo)

### ForecastPatternChart Additional Features:
- Fetches `/api/capacity/weekly-projections` on mount → builds `ProjectionDayOverlay[]`
- "Projected" toggle button appears when projection data exists and is non-zero
- Toggle swaps bar data source (projected values replace historical averages)
- `allCustomers` merges historical + projection customers
- Uses `computeDayOfWeekPattern()` which only iterates over `demand[]` entries

### Important: Demand Engine Only Produces Entries for Dates WITH Work Packages
`computeDailyDemandV2()` in demand-engine.ts builds an accumulator map (`aggMap`) from WP ground-time calculations. Only dates with actual WP overlap get entries. Unlike capacity (which covers ALL dates in the range), demand can have gaps. The forecast pattern engine (`computeDayOfWeekPattern`) only processes dates present in the demand array — capacity is looked up by `capByDate.get(day.date)`.

## Environment Gotchas

1. **D-047 Client barrel import trap**: `"use client"` components CANNOT import from `@/lib/capacity` barrel — it re-exports server-only modules (better-sqlite3, node-cron). Use direct imports like `@/lib/capacity/forecast-pattern-engine`.
2. **`npx tsx -e` can't resolve `@/` aliases**: Use vitest (has tsconfig path resolution) or write a temp `.ts` file.
3. **CRLF/LF noise**: `git diff` shows 89 files "changed" but `git diff --ignore-cr-at-eol` returns empty. All real changes are committed.
4. **Auth required for API**: Can't curl capacity routes — redirects to `/login`. Need browser session.
5. **SMD-13 rotation offset**: rotation_start_date is `2026-01-05` vs `2026-01-04` for all others. Intentional staggering.

## Key Type Interfaces

```typescript
interface DailyCapacityV2 {
  date: string;
  totalProductiveMH: number;
  totalPaidMH: number;
  byShift: ShiftCapacityV2[];
  hasExceptions: boolean;
}

interface ShiftCapacityV2 {
  shiftCode: string;        // "DAY" | "SWING" | "NIGHT"
  shiftName: string;
  rosterHeadcount: number;
  effectiveHeadcount: number;
  paidHoursPerPerson: number;
  paidMH: number;
  availableMH: number;
  productiveMH: number;      // ← this is what charts show as "capacity"
  hasExceptions: boolean;
  belowMinHeadcount: boolean;
}

interface ProjectionDayOverlay {
  dayOfWeek: number;
  label: string;
  projectedTotal: number;
  projectedByShift: Record<string, number>;
  projectedByCustomer: Record<string, number>;
  projectedByCustomerByShift: Record<string, Record<string, number>>;  // Added this session
}
```

</critical_context>

---

<current_state>

## Git State
- **Branch**: `feat/capacity-layout`
- **HEAD**: `2d1be9b` — `feat(capacity): enhance projection overlay with per-customer-per-shift breakdown`
- **Working tree**: No actual code changes. 89 files appear modified due to CRLF→LF line-ending differences only. `git diff --ignore-cr-at-eol` returns zero changes. All real code is committed.
- **Temporary files**: `HANDOVER.md` at project root (draft handover, can be deleted). `whats-next.md` (this file).

## Deliverable Status

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Chart redesign (grouped bars) — summary chart | ✅ Complete | Committed at 2d1be9b |
| Chart redesign (grouped bars) — forecast chart | ✅ Complete | Committed at 2d1be9b |
| Projection overlay (bar data swap) | ✅ Complete | Committed at 2d1be9b |
| `projectedByCustomerByShift` type + engine | ✅ Complete | Committed at 2d1be9b |
| `npm run build` passes | ✅ Verified | |
| `npm run lint` clean | ✅ Verified | |
| Capacity = 0 bug — DB state verified | ✅ Complete | All tables have correct data |
| Capacity = 0 bug — rotation math verified | ✅ Complete | Manual trace: all days non-zero |
| Capacity = 0 bug — actual engine output verified | ❌ Not Done | Blocked by tsx alias resolution |
| Capacity = 0 bug — API response inspected | ❌ Not Done | Needs running dev server + auth |
| Capacity = 0 bug — root cause identified | ❌ Not Done | Unknown |
| Visual verification of charts in browser | ❌ Not Done | |
| Test suite re-run | ❌ Not Done | Last known: 439 passing |

## Most Likely Hypotheses for Capacity Bug (in priority order)

1. **User is seeing SWING=0 on weekends and misinterpreting it** — SWING has legitimately zero capacity on Fri/Sat/Sun because only WKD-410 rotation covers SWING, and it's off on those days. In By Shift view, the SWING bars would show 0. But this doesn't explain Thursday (SWING=8 on Thu in the trace).

2. **The chart is only showing capacity lines, which are hard to see** — The capacity lines are dashed and thin. If demand bars are tall, the capacity lines might appear to be at 0 when they're just small relative to demand.

3. **The rotation resolution in the actual engine produces different results** — There could be a data loading issue (e.g., `loadStaffingShifts` returns different data than what's in the DB, or `buildPatternMap` doesn't include a needed pattern). This needs live verification.

4. **The Forecast Pattern chart aggregation skews capacity** — `computeDayOfWeekPattern()` only processes dates present in the demand array. If some dates have demand but capacity lookup fails (returns undefined from `capByDate`), those dates would contribute 0 capacity to the day-of-week average, pulling it down.

## Immediate Next Step
Start the dev server, log in, navigate to `/capacity`, and inspect the actual API response in browser DevTools to determine if the zeros are in the data (server bug) or in the rendering (client bug). This is the critical fork point that determines all subsequent debugging steps.

</current_state>
