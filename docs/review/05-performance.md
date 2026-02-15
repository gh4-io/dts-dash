# Phase 2 — Performance Review

**Date:** 2026-02-15

## Build Performance

- **Build time:** ~18s (Turbopack)
- **Bundle:** Static prerender for 5 pages, dynamic for all API routes
- **Tree-shaking:** ECharts and Recharts properly externalized

## Runtime Performance

### Data Layer
- **Module-level caching** in reader.ts and transformer.ts — avoids repeated disk I/O and DB queries
- **Batch normalization** — aircraft types normalized in one pass, not per-record
- **In-memory filtering** — work packages filtered in JS, no repeated DB queries

### Identified Issues (Not Fixed — Acceptable)

| Issue | Impact | Status |
|-------|--------|--------|
| Float precision in capacity MH calculations | < 0.01% error | Acceptable |
| `computeHourlySnapshots` ignores timezone param | Correct for UTC-only usage | Known limitation |
| `transformWorkPackages` re-queries on each API call | Mitigated by module-level cache | Acceptable |
| 22-dependency useMemo in TopMenuBar | Most deps are stable Zustand refs | Acceptable |
| ECharts setOption called every 60s for NOW line | Lightweight operation | Acceptable |

### Performance Characteristics
- **86 work packages** — well within in-memory processing limits
- **No N+1 queries** — batch loading with caching
- **No unnecessary re-renders** — Zustand with selective subscriptions
- **Canvas rendering** — ECharts Gantt handles large datasets efficiently

## Recommendations for Scale

If data grows beyond ~10,000 records:
1. Move filtering to SQL (server-side)
2. Add pagination to work-packages API (already supported)
3. Consider virtualized rendering for large tables
4. Add Redis or in-memory LRU cache with TTL
