# Handoff Document — Post Capacity Phase 3

**Created:** 2026-02-25
**Branch:** `feat/capacity-phase3`
**Repo:** `gh4-io/dts-dash`
**Latest Commit:** `9932512` — `docs: mark Capacity Phase 3 complete — full pipeline verified`
**Tests:** 590 passing (23 files)
**Build:** Clean
**Lint:** 0 errors, 0 warnings
**Migration Counter:** M019 (demand_contracts priority)

---

## What Just Happened

Capacity Phase 3 (Contract MH Pipeline) is **COMPLETE**. All 4 ROADMAP items verified done:

1. `computeEffectiveMH()` 4-level chain: manual > WP MH > contract PER_EVENT > default
2. `MHSource "contract"` in type system, all views consume it
3. Null WP MH import support (warns, doesn't reject)
4. Contract priority field (M019, D-052) — lowest priority number wins

The priority field was the final missing piece — implemented this session. The rest of the pipeline was already built in prior sessions but tracking docs hadn't been updated.

---

## Immediate Next Steps

### 1. Merge & Release

`feat/capacity-phase3` is ready to merge into `master`. All gates pass.

```bash
git checkout master
git merge feat/capacity-phase3
# Tag release (MINOR bump per D-028 — new features, backwards-compatible)
# Update package.json version if needed
```

**Branches to delete after merge:**
- `feat/capacity-phase3`
- `feat/capacity-layout` (already merged into phase3)

---

## Open Items — Prioritized Backlog

### Bugs (fix first)

| OI | Title | Priority | Notes |
|----|-------|----------|-------|
| OI-074 | Dashboard Aircraft & Turns section date mismatch | P2 | Chart/table ignores FilterBar date selection |
| OI-047 | Flight Board chart color reset on rapid clicks | P2 | ECharts re-render race condition |
| OI-043 | Chunked upload Location header returns localhost behind proxy | P2 | Only affects reverse-proxy deployments |

### Partial / In-Progress

| OI | Title | Priority | Notes |
|----|-------|----------|-------|
| OI-042 | Dashboard chart issues & enhancements | P1 | Partially resolved — some chart items remain |
| OI-044 | Generic db:cleanup + data retention policy | P2 | Partially resolved — needs retention policy |

### Temporary Code (remove when stable)

| OI | Title | Priority | Notes |
|----|-------|----------|-------|
| OI-066 | Capacity Dev Overview page | P3 | "DEV" badge — remove when capacity is production-stable |
| OI-067 | Weekly MH Projections | P3 | "TEMP" badge — M018 table, remove when no longer needed |

### Enhancements (P1)

| OI | Title | Notes |
|----|-------|-------|
| OI-038 | Interactive fuzzy match resolution (Data Hub) | Import field mapping UX improvement |
| OI-040 | Dashboard layout: utilization + turns + combined analytics | Multi-section layout redesign |
| OI-059 | Time/date indicator display area | Better placement for current time display |

### Enhancements (P2–P3)

| OI | Title | Notes |
|----|-------|-------|
| OI-041 | Collapsible sidebar with icon-only mode | Also OI-054 (duplicate) |
| OI-046 | Customer SP ID mapping | Future: map SharePoint IDs to customers |
| OI-048 | Rate limiting as system preference | server.config.yml setting |
| OI-049 | Admin Settings tab layout redesign | UX improvement |
| OI-051 | iPad quick info panel (long press) | Touch UX |
| OI-052 | Flight Board toggle: Gantt vs list view | Alternative visualization |
| OI-053 | iOS home screen installation (PWA) | manifest.json + service worker |
| OI-055 | Sticky time headers on flight board | Horizontal scroll UX |
| OI-056 | Shift highlighting with visual time separators | Flight board visual enhancement |
| OI-057 | Integrate react-to-print for print/export | Cross-page print support |

### Features (P2)

| OI | Title | Notes |
|----|-------|-------|
| OI-050 | AOG aircraft condition & visual tracking | Needs discovery on data source |

---

## Tech Debt: Component Cleanup

Five capacity components exceed 300 lines (identified during pre-merge review). See `.claude/COMPONENT_CLEANUP.md` for extraction strategies. Rule: refactor only when touching the file for other reasons.

| Component | Lines | File |
|-----------|-------|------|
| CapacitySummaryChart | 827 | `src/components/capacity/capacity-summary-chart.tsx` |
| ShiftDrilldownDrawer | 777 | `src/components/capacity/shift-drilldown-drawer.tsx` |
| CapacityTable | 670 | `src/components/capacity/capacity-table.tsx` |
| MonthlyRollupChart | 601 | `src/components/capacity/monthly-rollup-chart.tsx` |
| ForecastPatternChart | 545 | `src/components/capacity/forecast-pattern-chart.tsx` |

---

## Key Architecture Context

- All capacity engines are **pure functions** (zero DB imports) in `*-engine.ts`
- All DB access through `*-data.ts` layer (Drizzle queries)
- **D-047 barrel import trap**: `"use client"` components use direct imports from `@/lib/capacity/lens-config`, NOT the barrel (`@/lib/capacity`) which re-exports server-only modules
- **D-028 semver**: STOP and NOTIFY before any backwards-incompatible change
- **D-049 timezone**: Shift hours stored in local time + `timezone` IANA field
- Transformer caching: `cachedContractMap` is module-level, lazy-initialized

## Key Files

| File | Purpose |
|------|---------|
| `.claude/ROADMAP.md` | Full project status — start here |
| `.claude/OPEN_ITEMS.md` | All tracked issues (74 items, 14 open) |
| `.claude/DECISIONS.md` | Decision log (D-001 through D-052) |
| `.claude/COMPONENT_CLEANUP.md` | Capacity component refactoring tracker |
| `src/lib/data/transformer.ts` | Core effectiveMH pipeline + contract cache |
| `src/lib/capacity/` | All capacity engines + data layer |
