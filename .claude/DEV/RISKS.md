# Risks & Mitigations

## Active Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R2 | Recharts dual Y-axis bar+line chart rendering issues | Low | Medium | Use single Y-axis; only split if scale differs >10x |
| R3 | 86 records × hourly granularity = ~384 data points | Low | Low | Pre-compute server-side, cache in API response |
| R4 | Aircraft type inference wrong for some registrations | High | Low | Show "Unknown" type; make rules editable in Settings |
| R5 | `TotalGroundHours` string parsing fails (NaN) | Low | Medium | Explicit NaN check; fallback to `(departure - arrival)` calc |
| R6 | Font Awesome webfont paths break in production build | Medium | Low | Test `npm run build && npm start` early; use relative paths in CSS |
| R7 | Tailwind v4 breaking changes from v3 syntax | Medium | Medium | Reference Tailwind v4 migration guide; use `@import "tailwindcss"` syntax |
| R8 | next-themes FOUC on initial load | Medium | Low | `suppressHydrationWarning` on `<html>`, `attribute="class"` |
| R9 | Zustand SSR hydration mismatch | Medium | Medium | `skipHydration` option; client-side fetch only via `useEffect` |
| R10 | Large JSON read on every API call | Low | Low | Cache parsed data in module-level variable; invalidate on import |
| R11 | ECharts SSR error in Next.js (requires `window`) | Medium | Medium | `dynamic(() => import(...), { ssr: false })` + `transpilePackages: ['echarts', 'zrender']` |
| R12 | ECharts `renderItem` limitations for complex bar content | Low | Low | The custom-gantt-flight example proves colored bars + text labels work; sufficient for our needs |
| R13 | ECharts + Recharts bundle overlap bloat | Low | Low | Independent renderers, no shared deps. Tree-shake ECharts via `echarts/core`. Flight board page loads ECharts only. |
| R14 | Aircraft type mapping regex performance with many rules | Low | Low | Rules evaluated in priority order; short-circuit on first match. Mapping table cached in memory after first load. |
| R15 | Paste-JSON import with malformed or adversarial input | Medium | Medium | Server-side validation with schema checking before any write. Preview step requires explicit user confirmation. Size limit: 10MB. |
| R16 | Theme preset CSS custom properties conflict with shadcn/ui tokens | Low | Medium | Presets only override `--accent` and surface variables; don't touch shadcn/ui's internal component tokens. Test each preset against all components. |
| R17 | `analytics_events` table grows unbounded if retention pruning fails | Low | Medium | Auto-prune on startup + nightly. Alert in Admin Analytics if table exceeds 100K rows. |
| R18 | Event tracking adds latency to user actions | Low | Low | Fire-and-forget: `trackEvent()` is async, never awaited in the UI path. Write is a single INSERT into SQLite (sub-ms). |
| R19 | Operational KPIs diverge between Dashboard and Capacity pages due to different computation paths | Medium | High | Single source of truth: both pages call the same API endpoints with the same filter params. KPI formulas defined once in `src/lib/data/engines/`. |

## Risk Response Protocol

1. **Before M0 complete**: Verify FA paths in production build (R6)
2. **During M0**: Confirm Tailwind v4 `@import` syntax works (R7); seed aircraft type mappings and verify normalization (R14)
3. **During M1**: Test TotalGroundHours parsing with all 86 records (R5); test pagination with full dataset (D-017)
4. **During M2**: Prototype ECharts flight board with sample data (R11, R12)
5. **During M5**: Test all theme presets against component library (R16)
6. **During M1**: Verify event tracking fire-and-forget adds no perceptible latency (R18)
7. **During M3**: Verify KPI values are identical on Dashboard and Capacity pages for same filters (R19)
8. **During M7**: Test paste-JSON import with malformed data (R15)
9. **After launch**: Monitor `analytics_events` table size; confirm auto-prune runs (R17)

## Resolved Risks

| ID | Risk | Resolution | Date |
|----|------|-----------|------|
| R1 | SVAR React Gantt MIT edition missing features | Replaced with Apache ECharts (D-008). SVAR had known issues: horizontal scroll freeze on Next.js 15 (GitHub #10), per-task colors required CSS workarounds, small community (89 stars). | 2026-02-13 |
