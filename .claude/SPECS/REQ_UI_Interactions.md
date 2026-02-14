# REQ: UI Interactions & Cross-Page Behavior

## State Management

### Zustand Stores
| Store | File | Scope |
|-------|------|-------|
| `useFilters` | `src/lib/hooks/use-filters.ts` | Global filter state (shared across pages) |
| `useWorkPackages` | `src/lib/hooks/use-work-packages.ts` | Fetched + filtered work packages |
| `useCapacity` | `src/lib/hooks/use-capacity.ts` | Demand/capacity/utilization data |
| `useConfig` | `src/lib/hooks/use-config.ts` | App configuration |
| `useCustomers` | `src/lib/hooks/use-customers.ts` | Customer colors from SQLite (D-010) |
| `usePreferences` | `src/lib/hooks/use-preferences.ts` | Per-user preferences (theme, pageSize, etc.) |

### Data Fetching Pattern
- All data fetched client-side via `useEffect` on filter changes
- API routes read JSON from filesystem (server-side)
- No SSG for data pages (data changes on import; would be stale)
- `skipHydration` option on Zustand to avoid SSR mismatch

## Cross-Page Filter Persistence
- Filters stored in URL query params → survives navigation
- Navigating from `/flight-board?op=CargoJet+Airways` to `/dashboard` carries `?op=CargoJet+Airways`
- Each page's `useFilterUrlSync()` hook hydrates from URL on mount
- See [REQ_Filters.md](REQ_Filters.md) for full URL sync spec

## Responsive Behavior

| Breakpoint | Sidebar | FilterBar | Content |
|-----------|---------|-----------|---------|
| ≥1280px (xl) | Expanded (240px) | 2-row inline | Full layout |
| ≥768px (md) | Collapsed (64px) | 2×2 grid | 2-col grid |
| <768px (sm) | Sheet overlay | Sheet overlay | Single column |

## Theme
- Dark default, light available via toggle
- `next-themes` with `attribute="class"` on `<html>`
- `suppressHydrationWarning` to prevent FOUC
- CSS custom properties for neutral palette (see `/plan/FINAL-PLAN.md` Appendix B)

## Loading States
- Skeleton components for all data-dependent areas
- Show immediately; replace with data when fetched

## Empty States
- Font Awesome icon + message + action button
- Example: `fa-plane-slash` + "No aircraft match the current filters" + "Reset Filters"

## Error Handling
- Error boundaries per page
- User-friendly message + "Try again" button
- Console logging for debugging (no external error service for v0)

## Pagination & Lazy Loading (D-017)

### Table Pagination
- All table views (Capacity detail, Admin user list, Admin import history) use TanStack Table pagination
- Default: 30 rows/page, configurable per user via `tablePageSize` preference (10/25/30/50/100)
- UI controls: page number, prev/next, jump-to-page, rows-per-page selector
- Server-side pagination: API returns only requested page via `?page=N&pageSize=N` params

### Chart/Gantt Data Loading
- Charts and Gantt always receive the **full filtered dataset** (no pagination)
- Data is fetched via dedicated unpaginated endpoints (`/api/work-packages/all`, `/api/hourly-snapshots`)
- Loading state shows skeleton while data transfers

### Lazy Loading Pattern
- On initial page load, show skeleton immediately
- Fetch data in parallel (filters → API → render)
- For large tables, load the first page immediately; prefetch page 2 in background
- No infinite scroll — use traditional pagination controls for predictability

## Keyboard Navigation
- Tab through FilterBar fields
- Escape closes open popovers/sheets
- Enter applies selection in multi-selects

## Toast Notifications
- Auto-correction events (date swap, range clamp) → info toast
- Import success/failure → success/error toast
- Duration: 3 seconds, dismissible
