<original_task>
Implement Dashboard print support: the "Arrivals / Departures / On Ground" (CombinedChart / Recharts) should render across the full page width when printed, with KPI tiles tiled below it left-to-right, learning from the Flight Board print implementation. The core problem across the entire session: the chart consistently renders with NO visible bars, NO line, and NO data in the printed PDF — only axes/grid/legend appear (or nothing at all after the last change).
</original_task>

<work_completed>
## Print layout architecture — complete and user-accepted

`src/app/(authenticated)/dashboard/page.tsx`:
- Added `flushSync` import from `react-dom`
- Added `printMode` state: `const [printMode, setPrintMode] = useState(false)`
- Added `handleBeforePrint`: `async () => { flushSync(() => setPrintMode(true)); }`
- Added `handleAfterPrint`: `() => { setPrintMode(false); }`
- `PrintButton` wired with both callbacks, `contentRef={printRef}`, `documentTitle="Dashboard — CVG Line Maintenance"`

Print layout (3 rows) — accepted by user:
- Row 1 (full width): card wrapper + `<CombinedChart snapshots={displaySnapshots} timezone={timezone} timeFormat={timeFormat} height={200} width={928} />`
- Row 2 (3-col grid): `<AvgGroundTimeCard>` | `<TotalAircraftCard filterStart={start} filterEnd={end} timezone={timezone}>` | `<AircraftByTypeCard>`
- Row 3 (full width): `<OperatorPerformance focusedOperator={null} onOperatorClick={() => {}}>`

User corrections already applied:
- Uses existing `TotalAircraftCard` (labelled "Aircraft & Turns") and `AircraftByTypeCard` ("Total Aircraft By Type") — not custom inline KPI divs
- `MhByOperatorCard` and `CustomerDonut` excluded from print (user approved)
- OperatorPerformance on its own full-width row (not crammed into a column — avoids table overflow at ~374px)

## CombinedChart props extension — complete

`src/components/dashboard/combined-chart.tsx`:
- Added `height?: number` (default 340) — allows print to pass `height={200}`
- Added `width?: number` — when provided, bypasses ResponsiveContainer entirely
- Added print render path: `if (width !== undefined) { return <ComposedChart width={width} height={height}>...</ComposedChart>; }`
- Stats bar (`selectionStats` display) now only rendered when `onSelectionChange !== undefined` — hides in print mode (cleaner output, saves ~30px)

## LAST CHANGE THIS SESSION — made things "worse" (needs revert)

The `chartChildren` variable was changed from a JSX Fragment to a keyed array. User reported this was worse than before. This change should be reverted as the first step in the next session.
</work_completed>

<work_remaining>
## STEP 1 — Revert the keyed-array change (restore Fragment)

In `src/components/dashboard/combined-chart.tsx`, lines ~338-468, `chartChildren` is currently a keyed array. Revert it to a Fragment. The Fragment was always working for the screen chart (user never reported a broken screen chart). The screen chart must not be broken.

```tsx
// Restore this form:
const chartChildren = (
  <>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.2} horizontal={true} vertical={false} />
    {midnightHours.map((m) => (
      <ReferenceLine key={`midnight-${m.hour}`} x={m.hour} stroke="hsl(var(--foreground))" strokeWidth={1} strokeDasharray="6 3" opacity={0.5}
        label={{ value: m.dateLabel, position: "insideTopRight", fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 700, offset: 4 }} />
    ))}
    {nowHourKey && (
      <ReferenceLine key="now" x={nowHourKey} stroke="#ef4444" strokeWidth={2}
        label={{ value: "NOW", position: "insideTopLeft", fill: "#ef4444", fontSize: 10, fontWeight: 700, offset: 4 }} />
    )}
    {activeSelectionBounds && (
      <ReferenceArea key="selection" x1={activeSelectionBounds.x1} x2={activeSelectionBounds.x2} fill="hsl(var(--primary))" fillOpacity={0.12} stroke="none" />
    )}
    <XAxis dataKey="hour" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} ticks={alignedTicks}
      tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }} axisLine={{ stroke: "hsl(var(--muted-foreground))" }} tickFormatter={formatTick} />
    <YAxis tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={35} />
    <Tooltip active={dragStart ? false : undefined} contentStyle={{ ... }} labelFormatter={...} />
    <Legend wrapperStyle={{ ... }} formatter={...} />
    <Bar dataKey="arrivals" name="Arrivals" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} />
    <Bar dataKey="departures" name="Departures" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={8} />
    <Line dataKey="onGround" name="On Ground" type="monotone" stroke="#eab308" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
  </>
);
```

Note: The `chartChildren` Fragment is fine for the normal path inside ResponsiveContainer. The print path (`if (width !== undefined)`) should be expanded inline (not use `chartChildren` at all) so the two paths can have different props.

## STEP 2 — Primary fix: disable Recharts animations in print path

**Highest-confidence untested root cause**: Recharts `Bar` and `Line` animate on mount by default:
- `Bar` animation: bar height starts at 0 and animates upward (~400ms)
- `Line` animation: uses SVG strokeDasharray trick, path length starts at 0% and animates to 100% (~1500ms)

When `flushSync(() => setPrintMode(true))` renders the chart and react-to-print immediately clones the DOM, Recharts' animation is at frame 0: bars have height 0, line has length 0 — nothing is visible in the cloned SVG even though the data is present.

**The fix**: In the print render path (`if (width !== undefined)`), expand children inline and add `isAnimationActive={false}` to all three data elements:

```tsx
if (width !== undefined) {
  return (
    <ComposedChart
      data={chartData}
      width={width}
      height={height}
      margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.2} horizontal={true} vertical={false} />
      {midnightHours.map((m) => (
        <ReferenceLine key={`midnight-${m.hour}`} x={m.hour} stroke="hsl(var(--foreground))" strokeWidth={1} strokeDasharray="6 3" opacity={0.5}
          label={{ value: m.dateLabel, position: "insideTopRight", fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 700, offset: 4 }} />
      ))}
      <XAxis dataKey="hour" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} ticks={alignedTicks}
        tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }} axisLine={{ stroke: "hsl(var(--muted-foreground))" }} tickFormatter={formatTick} />
      <YAxis tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={35} />
      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "hsl(var(--foreground))", pointerEvents: "none" }}
        formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
      <Bar dataKey="arrivals" name="Arrivals" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} isAnimationActive={false} />
      <Bar dataKey="departures" name="Departures" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={8} isAnimationActive={false} />
      <Line dataKey="onGround" name="On Ground" type="monotone" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
    </ComposedChart>
  );
}
```

No `<Tooltip>` needed in print path (non-interactive). No `activeSelectionBounds` needed (print never has a live drag). No mouse handlers needed on the print ComposedChart — remove `onMouseDown/Move/Up/Leave` from `chartProps` or just don't spread chartProps in the print branch.

## STEP 3 — Verification
1. `npm run lint` — 0 warnings, 0 errors
2. `npm run build` — passes
3. Print Dashboard → bars (blue/red) and yellow on-ground line visible
4. Print 2–3 times consecutively → consistent results
5. Close print dialog → screen chart fully interactive (drag-to-select, cross-filter)
6. Screen chart shows midnight separators, NOW line, bars, on-ground line as before

## FALLBACK — if animation disable doesn't fix it

If bars/line are still blank after `isAnimationActive={false}`:

**Diagnose first**: In `handleBeforePrint`, after `flushSync(...)`, add:
```ts
const svg = printRef.current?.querySelector('.recharts-wrapper svg');
console.log('SVG innerHTML length:', svg?.innerHTML.length);
console.log('First rect height:', svg?.querySelector('rect[height]')?.getAttribute('height'));
```
This tells you: (a) is the SVG present at all, and (b) do bar rects have non-zero height.

**If SVG is present but empty (no rects)**: Recharts didn't finish rendering. Try adding one RAF delay after flushSync:
```ts
flushSync(() => setPrintMode(true));
await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
```

**If SVG is absent**: ComposedChart standalone isn't mounting in the synchronous flushSync path. Consider rendering the print chart as a permanently-mounted hidden element (not conditionally rendered) and showing/hiding it via CSS — this avoids the mount timing issue entirely.

**If SVG has rects with non-zero height but they're invisible**: CSS variable resolution failure in the print iframe. Switch stroke/fill values to hardcoded hex everywhere in the print path.

**Nuclear option (SVG img-swap)**: Same technique as ECharts but for SVG:
```ts
const svg = printRef.current?.querySelector('.recharts-wrapper svg') as SVGElement;
const serialized = new XMLSerializer().serializeToString(svg);
const dataUrl = 'data:image/svg+xml;base64,' + btoa(serialized);
const img = document.createElement('img');
img.src = dataUrl; img.width = 928; img.height = 200;
svg.parentElement!.replaceChild(img, svg);
// store reference to restore in handleAfterPrint
```
</work_remaining>

<attempted_approaches>
## Attempt 1: Pass `width={928}` to ResponsiveContainer
Thought setting the width prop on ResponsiveContainer would pre-size it. WRONG: ResponsiveContainer initializes `containerWidth = -1` and only updates via ResizeObserver callback (async). Style prop sets CSS but does not initialize internal state. Chart rendered empty.

## Attempt 2: Double RAF delay in handleBeforePrint
```ts
await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
```
Two animation frames are not enough for ResizeObserver → React state → re-render cycle to complete. Chart still empty.

## Attempt 3: Bypass ResponsiveContainer (print path with explicit width/height)
Added `if (width !== undefined)` branch rendering `<ComposedChart width={width} height={height}>` directly. This is architecturally correct — `ComposedChart` IS documented to work standalone with explicit `width` and `height`. However, introduced a shared `chartChildren` variable (Fragment) that gets passed to both paths. Chart still empty (for unknown reason at this point — animation was never disabled).

## Attempt 4: Fragment → keyed array (LAST CHANGE — "worse")
Diagnosed the Fragment as the cause: "Recharts uses `React.Children.map` internally; a Fragment is treated as one opaque child." This diagnosis was **wrong**. The screen chart always worked with the Fragment — Recharts v2 internally unwraps Fragments. Converting to a keyed array made things worse (user confirmed). The change needs to be reverted.

## What was NEVER tried
- `isAnimationActive={false}` — most likely root cause, never tested
- Inspecting the print DOM to verify what's actually in the SVG at capture time
- SVG serialization / img-swap approach
- Permanently-hidden print chart that avoids conditional-mount timing
</attempted_approaches>

<critical_context>
## How react-to-print works
`useReactToPrint` awaits `onBeforePrint`, then calls `cloneNode(true)` on `contentRef.current`, injects the clone into a hidden iframe, copies all `<style>` and `<link rel="stylesheet">` tags from the parent document, then calls `iframe.contentWindow.print()`. CSS custom properties (`hsl(var(--...))`) should be available in the iframe because all stylesheets are copied.

## Why SVG is different from ECharts canvas
ECharts renders to a `<canvas>` element. `canvas.cloneNode(true)` creates a blank canvas — pixel data is NOT copied. That's why Flight Board needed `getDataURL()` → img swap. Recharts renders SVG which IS part of the DOM tree and IS copied faithfully by `cloneNode(true)`. The img-swap technique is not needed for Recharts IF the SVG was fully rendered before cloning.

## Recharts animation — the likely culprit
- Default: `isAnimationActive={true}` on `<Bar>` and `<Line>`
- Bar animation: `<rect>` starts at height 0, animates up via CSS transform. Duration ~400ms
- Line animation: `<path>` uses `strokeDasharray` trick starting at 0% path length, animates to 100%. Duration ~1500ms
- At frame 0 (immediately after mount), bars have zero height and line has zero length → both invisible
- `flushSync` triggers a synchronous React render (component mounts, initial state set) but Recharts then kicks off animations using its own internal `requestAnimationFrame` / `setTimeout` — those are NOT synchronous and are NOT affected by `flushSync`
- Result: react-to-print captures the DOM before animations complete → blank chart

## Print dimensions reference
- CSS reference pixel: 96 ppi
- Landscape Letter, `@page { margin: 0.5in }`: printable = 10" × 7.5" = **960 × 720 CSS px**
- Chart: `width={928}` to leave 16px for card `p-4` padding on each side
- Chart: `height={200}` — short to leave room for tile row + operator table below

## Current broken state of combined-chart.tsx
The keyed array (lines ~338-468) looks like:
```tsx
const chartChildren = [
  <CartesianGrid key="grid" ... />,
  ...midnightHours.map(...),
  nowHourKey ? <ReferenceLine key="now" ... /> : null,
  activeSelectionBounds ? <ReferenceArea key="selection" ... /> : null,
  <XAxis key="xaxis" ... />,
  <YAxis key="yaxis" ... />,
  <Tooltip key="tooltip" ... />,
  <Legend key="legend" ... />,
  <Bar key="bar-arrivals" ... />,     // no isAnimationActive={false}
  <Bar key="bar-departures" ... />,   // no isAnimationActive={false}
  <Line key="line-onground" ... />,   // no isAnimationActive={false}
];
```
Both the print path (`if (width !== undefined)`) and the normal path use this same variable. This must be split: Fragment for normal path, inline expanded JSX with `isAnimationActive={false}` for print path.

## Branch / git state
- Branch: `dev`
- `combined-chart.tsx` — dirty (modified, not committed). Current state has keyed array (broken).
- `dashboard/page.tsx` — dirty (modified, not committed). Current state has print layout (correct).
- `flight-board/page.tsx` — also dirty (from prior Flight Board print work, separate feature)
- `globals.css` — also dirty (from prior Flight Board print work)
- No commits have been made this session.

## Related: Flight Board print (already solved, for reference)
Solution used in `flight-board-chart.tsx` (ECharts / canvas):
1. `flushSync` → `setCc(PRINT_CC)`, `setChartWidth(PRINT_WIDTH)`, `setPrintMode(true)` — synchronous React render causes ECharts to call `setOption()` with correct tick density
2. `chart.getDataURL({ pixelRatio: 3 })` → base64 PNG
3. DOM manipulation: replace `<canvas>` with `<img src={base64}>` before react-to-print clones
4. `restoreAfterPrint`: remove img, restore original canvas + sizes
Lesson for Recharts: "freeze the data into the DOM before capture." For SVG, this means `isAnimationActive={false}` so the data shapes are at their final positions on first paint.
</critical_context>

<current_state>
## Deliverable status

| Item | Status |
|------|--------|
| Print button on Dashboard | ✅ Complete |
| handleBeforePrint / handleAfterPrint | ✅ Complete |
| Print layout (3-row structure) | ✅ Complete, user-accepted |
| KPI tiles (correct components) | ✅ Complete |
| CombinedChart `width`/`height` props | ✅ Complete |
| ResponsiveContainer bypass (print path) | ✅ Structurally in place |
| Chart renders with data in print | ❌ BROKEN — never worked across 4 attempts |
| Screen chart unbroken | ⚠️ POSSIBLY BROKEN — keyed array change may have broken it |

## What's in the files right now

**`dashboard/page.tsx`** — correct, no further changes needed

**`combined-chart.tsx`** — broken, needs 2 changes:
1. Revert `chartChildren` from keyed array back to Fragment (restores screen chart)
2. Expand print path inline with `isAnimationActive={false}` on Bar/Line (primary fix attempt)

## No commits made this session
All changes are unstaged dirty working tree edits. Can be reverted with `git diff` / `git checkout` if needed. The correct state to save: keep all `dashboard/page.tsx` changes, revert `combined-chart.tsx` keyed-array portion and replace with the animation fix approach.

## Next session priority
1. Revert `chartChildren` to Fragment in `combined-chart.tsx`
2. Expand print path inline + add `isAnimationActive={false}`
3. Test print — if bars/line appear, done
4. If still blank, inspect SVG DOM as described in fallback steps
</current_state>
