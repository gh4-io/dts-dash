# Component Cleanup Tracker

> Oversized capacity components identified during pre-merge code review (2026-02-25).
> Each exceeds 300 lines and would benefit from sub-component extraction.
> Review and refactor when touching these files for other reasons.

## Components for Review

| # | Component | Lines | Location | Complexity Source |
|---|-----------|-------|----------|-------------------|
| 1 | `CapacitySummaryChart` | 827 | `src/components/capacity/capacity-summary-chart.tsx` | 4 view modes (total/byShift/byCustomer/gap), forecast overlay, secondary lens overlay, today line, rolling forecast line |
| 2 | `ShiftDrilldownDrawer` | 777 | `src/components/capacity/shift-drilldown-drawer.tsx` | Per-shift detail cards for all 7 lenses, drawer chrome, data formatting |
| 3 | `CapacityTable` | 670 | `src/components/capacity/capacity-table.tsx` | TanStack Table, dynamic lens columns, expandable sub-rows (byShift/byCustomer), CSV export, secondary lens column |
| 4 | `MonthlyRollupChart` | 601 | `src/components/capacity/monthly-rollup-chart.tsx` | 4 view modes, lens overlays, secondary comparison, scenario label |
| 5 | `ForecastPatternChart` | 545 | `src/components/capacity/forecast-pattern-chart.tsx` | DOW pattern bars, per-shift lines, projection overlay, secondary lens overlay |

## Extraction Strategy (suggestions)

### CapacitySummaryChart (827 lines)
- Extract `GapViewBars` sub-component (diverging bar rendering)
- Extract `ForecastOverlayLines` (rolling forecast + today line)
- Extract `LensOverlayLines` (primary + secondary lens line rendering)
- Extract `ChartTooltipContent` (custom tooltip formatter)

### ShiftDrilldownDrawer (777 lines)
- Extract per-lens detail card renderers into `drawer-cards/` folder
- Each lens card (Allocated, Events, Forecast, Worked, Billed, Concurrent) becomes its own component

### CapacityTable (670 lines)
- Extract `CsvExporter` utility function
- Extract `SubRowRenderer` for byShift/byCustomer expansion
- Extract column definition builders into a separate config file

### MonthlyRollupChart (601 lines)
- Same pattern as CapacitySummaryChart — extract view-mode-specific bar groups
- Share tooltip formatter pattern with daily chart

### ForecastPatternChart (545 lines)
- Extract projection overlay logic (OI-067 — may be removed entirely)
- Extract secondary lens line rendering (shared pattern with daily chart)

## Rules
- Do NOT refactor just for line count — only when touching a file for other reasons
- Maintain same props interface (no breaking changes to parent)
- Keep all Recharts config co-located with the chart that uses it
- Test manually after any extraction (no automated chart tests exist)

## Status
- [ ] CapacitySummaryChart — not started
- [ ] ShiftDrilldownDrawer — not started
- [ ] CapacityTable — not started
- [ ] MonthlyRollupChart — not started
- [ ] ForecastPatternChart — not started
