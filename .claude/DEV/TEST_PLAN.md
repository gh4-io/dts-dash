# Test Plan

## v0 Strategy: Manual + Build Verification

No automated test framework for v0. Testing is manual with build-time validation.

## Build-Time Gates

| Gate | Command | Pass Criteria |
|------|---------|--------------|
| TypeScript | `npm run build` | No type errors |
| ESLint | `npm run lint` | No errors or warnings |
| Production Build | `npm run build` | Completes without errors |
| Dev Server | `npm run dev` | All pages render |

## Manual Test Checklist

### Data Layer
- [ ] API `/api/work-packages` returns all 86 records when unfiltered
- [ ] API returns filtered subset when query params applied
- [ ] `TotalGroundHours` string → number parsing works (no NaN)
- [ ] Records with null `TotalMH` default to 3.0 MH
- [ ] `effectiveMH` formula respects priority: override > WP MH > default

### FilterBar
- [ ] Start/End datetime pickers open and close
- [ ] Changing Start auto-adjusts End if End < Start
- [ ] Range clamped to 30 days max (toast shown)
- [ ] Station displays "CVG" and is not editable
- [ ] Timezone defaults to UTC
- [ ] Operator multi-select shows all 6 customers with color dots
- [ ] Aircraft multi-select is searchable
- [ ] Type multi-select shows B777/B767/B747/B737
- [ ] Empty selection = "All" (no filtering)
- [ ] Reset button restores defaults
- [ ] URL params update on filter change (300ms debounce)
- [ ] Refreshing page restores filters from URL
- [ ] Navigating between pages preserves filter state

### Flight Board
- [ ] Gantt renders with aircraft on Y-axis, time on X-axis
- [ ] Bars colored by customer
- [ ] Tooltip shows all 9 fields on hover
- [ ] Zoom in/out works (5 levels)
- [ ] Filters reduce visible aircraft

### Dashboard
- [ ] 4 KPI cards show correct values
- [ ] Bar+line chart renders demand/capacity
- [ ] Donut chart shows customer distribution
- [ ] Charts update when filters change

### Capacity
- [ ] Daily demand calculated correctly
- [ ] Shift headcounts reflected in capacity
- [ ] Utilization % = demand / real capacity
- [ ] Config changes (slider) update calculations

### Settings
- [ ] Default MH slider (0.5–10.0) works
- [ ] WP MH include/exclude toggle works
- [ ] Shift headcount editing works
- [ ] Config persists to data/config.json

### Pagination (D-017)
- [ ] `/api/work-packages?page=1&pageSize=10` returns 10 records + correct meta
- [ ] `/api/work-packages` without pagination params returns all records
- [ ] `/api/work-packages/all` always returns full dataset (no pagination)
- [ ] Table page controls: next/prev/jump-to-page work
- [ ] Rows-per-page selector respects user preference (`tablePageSize`)
- [ ] Changing page size resets to page 1

### Aircraft Type Mapping (D-015)
- [ ] Default seed mappings normalize "747-4R7F" → B747
- [ ] Default seed mappings normalize "737-200" → B737
- [ ] Unknown raw type falls back to "Unknown"
- [ ] Admin can add a new mapping rule
- [ ] Admin can edit/delete existing rule
- [ ] Test input field shows real-time match result
- [ ] Reset Defaults restores seed mappings

### Data Import (D-016)
- [ ] File upload accepts valid OData JSON
- [ ] File upload rejects non-JSON files
- [ ] Paste-JSON validates and shows preview
- [ ] Paste-JSON rejects malformed JSON with clear error
- [ ] Preview shows record count, customer count, aircraft count, date range, warnings
- [ ] Import commits data to `data/input.json`
- [ ] Import logged to `import_log` table
- [ ] Import history displays on page

### Theme Presets (D-018)
- [ ] Classic preset applies (neutral dark)
- [ ] Ocean preset applies (blue tones)
- [ ] Lavender preset applies (purple tones)
- [ ] Midnight preset applies (dark + amber)
- [ ] Each preset works in Light, Dark, and System color modes
- [ ] Accent color override applies on top of preset
- [ ] Preference persists across sessions

### Responsive
- [ ] Desktop (≥1280px): expanded sidebar, 2-row FilterBar
- [ ] Tablet (768–1279px): collapsed sidebar, grid FilterBar
- [ ] Mobile (<768px): sheet sidebar, sheet FilterBar

### Theme
- [ ] Dark mode is default
- [ ] Light mode toggle works
- [ ] No FOUC on page load

## Future: Automated Testing

When the project matures, add:
- **Vitest** for unit tests (data layer, utility functions)
- **React Testing Library** for component tests
- **Playwright** for E2E (filter flow, navigation)

Priority test targets:
1. `capacity-engine.ts` — math-heavy, high value
2. `transformer.ts` — data normalization edge cases
3. `aircraft-type.ts` — normalization service with pattern matching (D-015)
4. `filter-helpers.ts` — validation logic
5. Filter URL sync round-trip
6. Pagination utility — boundary cases (page 0, pageSize > max, empty results)
