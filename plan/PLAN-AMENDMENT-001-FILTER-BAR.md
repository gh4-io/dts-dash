# Plan Amendment 001: Global Filter Bar

> **Date**: 2026-02-13
> **Status**: Proposed
> **Amends**: FINAL-PLAN.md (Sections 3, 5, 6, 8, 10)
> **Churn**: Minimal — adds 1 new type, 1 new component, updates 3 existing stores/APIs

---

## 1. Background

### Requirement
Every page that displays board/list/report-style data must have a global filter bar with:
- **Start Date/Time** (datetime picker)
- **End Date/Time** (datetime picker)
- **Station** (locked to "CVG"; displayed but not editable)
- **Timezone** (default "UTC"; select dropdown)
- **Operator** (multi-select; = Customer in our data model)
- **Aircraft** (searchable multi-select; registration list)
- **Type** (multi-select; B777/B767/B747/B737)

Filters must support **URL query params** for deep-linking.

### Evidence from CargoJet's Production System (HAR Analysis)

The `airways.cargojet.com` HAR file reveals the actual filter fields used in CargoJet's Oracle APEX flight board (page 92):

| APEX Field | Label | Type | Value Example |
|-----------|-------|------|---------------|
| `P92_STRDAT` | "Start Date" | datetime | `13-FEB-2026+09:28` |
| `P92_ENDDAT` | "End Date" | datetime | `15-FEB-2026+03:28` |
| `P92_ARPCOD` | "Airport" | text (select) | `""` (blank = all) |
| `P92_UTCLCL` | "UTC/Local Time" | select | `"LOCAL"` or `"UTC"` |

The Gantt response returns:
- `start`/`end`: Overall data range
- `viewportStart`/`viewportEnd`: Visible window
- `rows[].id`: Fleet number (e.g., "500")
- `rows[].label`: Fleet-Registration (e.g., "501-FKCJ")
- `rows[].tasks[].label`: Route string (e.g., "YYC 584 YHM")
- `rows[].tasks[].customTooltip`: Multi-line tooltip with Flight #, Tail #, Leg, Departure, Arrival, Status
- `rows[].tasks[].svgClassName`: Color class (`demo-f-green`, `demo-f-departed`)

**Flight statuses observed**: SCHEDULED, NEW-FLIGHT, ARRIVED, DEPARTED

Our filter bar extends CargoJet's 4-field design with 3 additional multi-selects (Operator, Aircraft, Type) that CargoJet handles through a separate sidebar nav.

---

## 2. Pages Affected

| Page | Route | Has Data View? | Needs FilterBar? | Notes |
|------|-------|---------------|-------------------|-------|
| Flight Board | `/flight-board` | Gantt timeline | **Yes** | Primary consumer; filters determine Gantt viewport + data |
| Dashboard | `/dashboard` | KPI cards + charts | **Yes** | All KPIs and charts must respect the active filter |
| Capacity | `/capacity` | Utilization chart + table | **Yes** | Date range + operator filter affect demand calculations |
| Settings | `/settings` | Config form | **No** | No data view; configuration only |

All three data pages share the **same filter state**. Changing filters on the Flight Board, then navigating to Dashboard, should show the same filtered data.

---

## 3. Data Model Addition

### 3.7 Filter State Schema (NEW)

Add to `src/types/filters.ts`:

```typescript
/**
 * Global filter state shared across all data pages.
 * Serializable to/from URL query params.
 */
interface FilterState {
  // Time range
  startDate: string;         // ISO 8601 datetime, e.g. "2026-02-13T09:00:00Z"
  endDate: string;           // ISO 8601 datetime, e.g. "2026-02-15T03:00:00Z"

  // Station (locked)
  station: "CVG";            // Always "CVG"; displayed but not editable

  // Timezone for display
  timezone: TimezoneOption;  // Default: "UTC"

  // Multi-select filters (empty array = "all" / no filter)
  operators: CustomerName[]; // Empty = all operators shown
  aircraft: string[];        // Registration strings; empty = all aircraft shown
  aircraftTypes: AircraftType[]; // Empty = all types shown
}

type TimezoneOption = "UTC" | "America/New_York" | "America/Chicago" | "America/Los_Angeles";

// URL query param mapping
interface FilterQueryParams {
  start?: string;     // ISO datetime
  end?: string;       // ISO datetime
  tz?: string;        // "UTC" | "America/New_York" | ...
  op?: string;        // Comma-separated operator names
  ac?: string;        // Comma-separated registrations
  type?: string;      // Comma-separated: "B777,B767"
  // station is never in URL (always CVG)
}
```

### Validation Rules

| Field | Rule | On Violation |
|-------|------|-------------|
| `startDate` | Must be valid ISO 8601 | Fall back to `now - 6h` |
| `endDate` | Must be valid ISO 8601 | Fall back to `startDate + 3 days` |
| `endDate` vs `startDate` | `endDate > startDate` | Swap values silently |
| `endDate - startDate` | Max 30 days | Clamp to 30 days from startDate |
| `operators` | Each must be valid `CustomerName` | Remove invalid entries |
| `aircraft` | Each must exist in loaded dataset | Remove invalid entries (show warning) |
| `aircraftTypes` | Each must be valid `AircraftType` | Remove invalid entries |
| `timezone` | Must be valid `TimezoneOption` | Fall back to "UTC" |

### Default Values (when no URL params)

```typescript
const DEFAULT_FILTERS: FilterState = {
  startDate: toISO(startOfToday()),           // Today 00:00 UTC
  endDate: toISO(addDays(startOfToday(), 3)), // Today + 3 days
  station: "CVG",
  timezone: "UTC",
  operators: [],     // = all
  aircraft: [],      // = all
  aircraftTypes: [], // = all
};
```

---

## 4. Component Design

### 4.1 FilterBar Component

**File**: `src/components/shared/filter-bar.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FilterBar                                                                    │
│                                                                              │
│ ┌───────────────────┐ ┌───────────────────┐ ┌─────────┐ ┌────────────────┐ │
│ │ fa-calendar-alt   │ │ fa-calendar-alt   │ │ fa-map  │ │ fa-clock       │ │
│ │ Start Date/Time   │ │ End Date/Time     │ │ Station │ │ Timezone       │ │
│ │ [Feb 13, 09:00]   │ │ [Feb 15, 03:00]   │ │ CVG 🔒  │ │ [UTC ▼]        │ │
│ └───────────────────┘ └───────────────────┘ └─────────┘ └────────────────┘ │
│                                                                              │
│ ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────────────┐ │
│ │ fa-building        │ │ fa-plane           │ │ fa-plane-circle-check    │ │
│ │ Operator           │ │ Aircraft           │ │ Type                     │ │
│ │ [All Operators ▼]  │ │ [Search aircraft…] │ │ [All Types ▼]            │ │
│ │ ☑ CargoJet         │ │ ☑ C-FOIJ           │ │ ☑ B777  ☑ B767           │ │
│ │ ☑ Aerologic        │ │ ☑ C-FPIJ           │ │ ☐ B747  ☐ B737           │ │
│ │ ☑ Kalitta Air      │ │ ☑ N774CK           │ │                          │ │
│ │ ...                │ │ ...                │ │                          │ │
│ └────────────────────┘ └────────────────────┘ └──────────────────────────┘ │
│                                                            [Reset Filters]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Desktop Layout (≥1280px)
- **Row 1**: Start Date | End Date | Station | Timezone — inline, equal-width columns
- **Row 2**: Operator | Aircraft | Type | Reset button — inline
- Border-bottom separator, `bg-card` background, `p-3` padding

#### Tablet Layout (768–1279px)
- **Row 1**: Start Date | End Date | Station | Timezone — 2×2 grid
- **Row 2**: Operator | Aircraft | Type — full-width stacked or 3-col
- Reset button floats right

#### Mobile Layout (<768px)
- All filters collapsed into a **Sheet** (slide-up panel) triggered by a single "Filters" button with FA `fa-filter` icon + active filter count badge
- Inside Sheet: all fields stacked vertically, full-width
- "Apply" + "Reset" buttons at bottom of Sheet

### 4.2 Sub-Components

| Component | File | UI Element | Library |
|-----------|------|-----------|---------|
| `DateTimePicker` | `components/shared/datetime-picker.tsx` | Date + time input | shadcn/ui Popover + Calendar + time input |
| `MultiSelect` | `components/shared/multi-select.tsx` | Searchable multi-select with checkboxes | shadcn/ui Popover + Command |
| `StationBadge` | (inline in FilterBar) | Locked "CVG" badge | shadcn/ui Badge (variant=secondary, disabled) |
| `TimezoneSelect` | (inline in FilterBar) | Simple Select dropdown | shadcn/ui Select |

### 4.3 Font Awesome Icons Used

| Field | Icon | Class |
|-------|------|-------|
| Start Date | Calendar | `fa-solid fa-calendar` |
| End Date | Calendar | `fa-solid fa-calendar-check` |
| Station | Map pin | `fa-solid fa-location-dot` |
| Timezone | Clock | `fa-solid fa-clock` |
| Operator | Building | `fa-solid fa-building` |
| Aircraft | Plane | `fa-solid fa-plane` |
| Type | Plane-circle-check | `fa-solid fa-plane-circle-check` |
| Filter (mobile) | Filter | `fa-solid fa-filter` |
| Reset | Rotate-left | `fa-solid fa-rotate-left` |

---

## 5. State Management: Updated `use-filters` Store

**Amends**: FINAL-PLAN.md Section 5.6 — replaces the existing `use-filters.ts` spec.

```typescript
// src/lib/hooks/use-filters.ts
import { create } from "zustand";

interface FiltersState {
  // Current filter values
  filters: FilterState;

  // Available options (populated from data)
  availableOperators: CustomerName[];
  availableAircraft: string[];         // All registrations in dataset
  availableAircraftTypes: AircraftType[];

  // Actions
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setTimezone: (tz: TimezoneOption) => void;
  setOperators: (ops: CustomerName[]) => void;
  setAircraft: (regs: string[]) => void;
  setAircraftTypes: (types: AircraftType[]) => void;
  resetFilters: () => void;

  // Hydration
  hydrateFromParams: (params: FilterQueryParams) => void;
  toQueryParams: () => FilterQueryParams;

  // Initialize available options from data
  initAvailableOptions: (packages: WorkPackage[]) => void;
}
```

### URL Sync Hook

**File**: `src/lib/hooks/use-filter-url-sync.ts`

```typescript
/**
 * Bi-directional sync between Zustand filter state and URL query params.
 * Uses Next.js useSearchParams + useRouter.
 *
 * On page load: reads URL params → hydrates Zustand store
 * On filter change: updates URL params (replace, not push)
 */
function useFilterUrlSync(): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { filters, hydrateFromParams, toQueryParams } = useFilters();

  // On mount: URL → Store
  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    hydrateFromParams(params as FilterQueryParams);
  }, []);

  // On filter change: Store → URL (debounced 300ms)
  useEffect(() => {
    const queryParams = toQueryParams();
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(queryParams)) {
      if (v) sp.set(k, v);
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [filters]);
}
```

### Query Param Format

| Param | Format | Example |
|-------|--------|---------|
| `start` | ISO 8601 | `?start=2026-02-13T09:00:00Z` |
| `end` | ISO 8601 | `?end=2026-02-15T03:00:00Z` |
| `tz` | IANA timezone | `?tz=UTC` |
| `op` | Comma-separated | `?op=CargoJet+Airways,Aerologic` |
| `ac` | Comma-separated | `?ac=C-FOIJ,C-FPIJ` |
| `type` | Comma-separated | `?type=B777,B767` |

**Full deep-link example**:
```
/flight-board?start=2026-02-13T09:00:00Z&end=2026-02-15T03:00:00Z&tz=UTC&op=CargoJet+Airways
```

---

## 6. API Layer Impact

### Updated API Contract

All data API routes now accept filter query params:

#### `GET /api/work-packages`

**Before** (FINAL-PLAN.md):
```
?customer=X&from=ISO&to=ISO&status=New|Approved
```

**After** (this amendment):
```
?start=ISO&end=ISO&op=CSV&ac=CSV&type=CSV&status=New|Approved
```

| Param | Maps To | Filter Logic |
|-------|---------|-------------|
| `start` | `startDate` | `departure >= start` (still on ground after start) |
| `end` | `endDate` | `arrival <= end` (arrived before end) |
| `op` | `operators` | `customer IN (op1, op2, ...)` |
| `ac` | `aircraft` | `aircraftReg IN (ac1, ac2, ...)` |
| `type` | `aircraftTypes` | `inferredType IN (type1, type2, ...)` |
| `status` | — | `status IN (New, Approved)` (unchanged) |

**Filter logic for "on ground in window"**:
```
A work package is visible if:
  departure > startDate AND arrival < endDate
```
This catches aircraft that arrive before the window but depart during it, and aircraft that arrive during the window but depart after it.

#### `GET /api/hourly-snapshots`

**Before**: `?from=ISO&to=ISO`
**After**: `?start=ISO&end=ISO&op=CSV&ac=CSV&type=CSV`

Same filter logic — snapshots computed only for matching work packages.

#### `GET /api/capacity`

**Before**: `?from=ISO&to=ISO`
**After**: `?start=ISO&end=ISO&op=CSV&ac=CSV&type=CSV`

Filters applied to the demand side only. Capacity (headcount/shifts) is not affected by operator/aircraft/type filters.

---

## 7. Data Flow Diagram (Updated)

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Client)                       │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │              FilterBar Component                  │    │
│  │  [Start] [End] [CVG🔒] [TZ] [Op▼] [AC▼] [Type▼] │    │
│  └──────────────────────┬───────────────────────────┘    │
│                          │ onChange                       │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │            Zustand: useFilters()                  │    │
│  │  filters: { startDate, endDate, station,          │    │
│  │             timezone, operators, aircraft, types } │    │
│  └──────────┬───────────────────────┬───────────────┘    │
│             │                       │                    │
│     ┌───────▼───────┐      ┌───────▼────────┐          │
│     │ URL Sync Hook │      │ Data Fetch Hook│          │
│     │ (read/write   │      │ (useEffect on  │          │
│     │  searchParams)│      │  filter change)│          │
│     └───────────────┘      └───────┬────────┘          │
│                                     │ fetch             │
│                                     │ /api/work-packages│
│                                     │ ?start=&end=&op=  │
└─────────────────────────────────────┼────────────────────┘
                                      │
┌─────────────────────────────────────┼────────────────────┐
│                Next.js Server       │                     │
│                                     ▼                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │          API Route: /api/work-packages            │    │
│  │  1. Parse query params → FilterState              │    │
│  │  2. readRawWorkPackages()                         │    │
│  │  3. transformWorkPackages()                       │    │
│  │  4. Apply filters:                                │    │
│  │     a. departure > start AND arrival < end        │    │
│  │     b. customer IN operators (if non-empty)       │    │
│  │     c. aircraftReg IN aircraft (if non-empty)     │    │
│  │     d. inferredType IN types (if non-empty)       │    │
│  │  5. Return { data, meta }                         │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Empty results** (no matching records) | Show empty state: FA `fa-plane-slash` icon + "No aircraft match the current filters" + "Reset Filters" button |
| **Invalid date range** (`end < start`) | Auto-swap start/end; show toast notification "Date range corrected" |
| **Date range > 30 days** | Clamp to 30 days; show toast "Maximum 30-day window applied" |
| **Missing start param** | Default to `now - 6h` (shows recent + upcoming) |
| **Missing end param** | Default to `start + 3 days` |
| **All operators deselected** | Treat as "all" (same as empty array); visually show "All Operators" |
| **Unknown operator in URL** | Silently drop it from the filter; use remaining valid ones |
| **Unknown aircraft in URL** | Silently drop; log warning to console |
| **Timezone change** | Display times change; data does NOT re-fetch (display-only conversion) |
| **Station is always CVG** | Shown as disabled badge; not included in URL params; not sent to API |
| **Cross-page navigation** | Filters persist in URL; navigating from `/flight-board?op=CargoJet+Airways` to `/dashboard` carries `?op=CargoJet+Airways` |
| **Browser back/forward** | URL sync restores filter state from URL params |

---

## 9. Timezone Handling

### Storage vs Display

| Layer | Timezone | Format |
|-------|----------|--------|
| **Input JSON** | UTC | `"2026-02-07T05:38:00Z"` |
| **Database/API** | UTC always | ISO 8601 with Z suffix |
| **URL params** | UTC always | ISO 8601 with Z suffix |
| **Zustand store** | UTC always | ISO strings |
| **Display** | Selected timezone | Formatted via `Intl.DateTimeFormat` or `date-fns-tz` |

### Display Conversion

```typescript
function formatInTimezone(isoUtc: string, tz: TimezoneOption): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz === "UTC" ? "UTC" : tz,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoUtc));
}
// "2026-02-07T05:38:00Z" + "America/New_York" → "Feb 7, 00:38"
// "2026-02-07T05:38:00Z" + "UTC" → "Feb 7, 05:38"
```

### Why Default to UTC (not America/New_York)

The requirement specifies `timezone: default "UTC"`. This aligns with:
1. Aviation convention: schedules are typically in UTC/Zulu
2. Data source: all timestamps are already UTC
3. Eliminates DST confusion for multi-timezone operators

**Supersedes**: FINAL-PLAN.md Section 3.4 which defaulted to `"America/New_York"`.

---

## 10. Files Touched / Created

### New Files

| File | Purpose | Priority |
|------|---------|----------|
| `src/types/filters.ts` | FilterState, FilterQueryParams, TimezoneOption types | P0 |
| `src/components/shared/filter-bar.tsx` | Main FilterBar layout component | P0 |
| `src/components/shared/datetime-picker.tsx` | Date+time picker (shadcn Popover+Calendar+time) | P0 |
| `src/components/shared/multi-select.tsx` | Searchable multi-select with checkboxes | P0 |
| `src/lib/hooks/use-filter-url-sync.ts` | Bi-directional URL ↔ Zustand sync | P0 |
| `src/lib/utils/filter-helpers.ts` | Validation, defaults, serialization | P0 |

### Modified Files

| File | Change | Impact |
|------|--------|--------|
| `src/lib/hooks/use-filters.ts` | **Rewrite** — expand from simple filters to full FilterState with available options | Medium |
| `src/lib/hooks/use-work-packages.ts` | Add `filters` parameter to `fetchPackages()` | Low |
| `src/app/api/work-packages/route.ts` | Add `op`, `ac`, `type` query param parsing + filtering | Low |
| `src/app/api/hourly-snapshots/route.ts` | Add filter params | Low |
| `src/app/api/capacity/route.ts` | Add filter params (demand only) | Low |
| `src/app/flight-board/page.tsx` | Add `<FilterBar />` above Gantt, wire `useFilterUrlSync` | Low |
| `src/app/dashboard/page.tsx` | Add `<FilterBar />` above dashboard grid | Low |
| `src/app/capacity/page.tsx` | Add `<FilterBar />` above config panel | Low |
| `src/types/config.ts` | Change `timezoneName` default from `"America/New_York"` to `"UTC"` | Trivial |
| `src/lib/constants.ts` | Add `DEFAULT_FILTERS`, `TIMEZONE_OPTIONS` | Trivial |
| `src/components/flight-board/gantt-toolbar.tsx` | **Remove** date/customer filter (moved to FilterBar) | Low (simplifies) |

### No-Change Files (confirmed)

- `src/app/settings/page.tsx` — No FilterBar needed
- `src/lib/data/reader.ts` — No change (still reads full dataset)
- `src/lib/data/transformer.ts` — No change (transforms full dataset)
- All engine files — No change (receive pre-filtered data)

---

## 11. Implementation Order

Insert these steps into FINAL-PLAN.md Phase 5 (Zustand Stores) and Phase 6 (Shared Components):

### Step 1: Types & Constants (30 min)
```
src/types/filters.ts                  — FilterState, FilterQueryParams, TimezoneOption
src/lib/constants.ts                  — Add DEFAULT_FILTERS, TIMEZONE_OPTIONS
src/types/config.ts                   — Change timezone default to "UTC"
```

### Step 2: Filter State Store (45 min)
```
src/lib/hooks/use-filters.ts          — Full rewrite with FilterState
src/lib/utils/filter-helpers.ts       — Validation, serialization, defaults
src/lib/hooks/use-filter-url-sync.ts  — URL ↔ Zustand sync
```

### Step 3: UI Controls (1.5 hours)
```
src/components/shared/datetime-picker.tsx  — Date+time picker
src/components/shared/multi-select.tsx     — Searchable multi-select
src/components/shared/filter-bar.tsx       — Main FilterBar (composes above)
```

### Step 4: Wire to Pages (30 min)
```
src/app/flight-board/page.tsx         — Add <FilterBar />, useFilterUrlSync()
src/app/dashboard/page.tsx            — Add <FilterBar />, useFilterUrlSync()
src/app/capacity/page.tsx             — Add <FilterBar />, useFilterUrlSync()
```

### Step 5: Wire to APIs (30 min)
```
src/app/api/work-packages/route.ts    — Parse new query params, apply filters
src/app/api/hourly-snapshots/route.ts — Parse new query params, apply filters
src/app/api/capacity/route.ts         — Parse new query params (demand only)
```

### Step 6: Update Gantt Toolbar (15 min)
```
src/components/flight-board/gantt-toolbar.tsx — Remove date+customer filters (now in FilterBar); keep zoom controls only
```

**Total estimated effort**: ~3.5 hours (integrated into M2 timeline)

---

## 12. Acceptance Criteria (Addendum)

| ID | Criterion |
|----|-----------|
| AC-FB-08 | FilterBar appears on Flight Board, Dashboard, and Capacity pages |
| AC-FB-09 | Start/End datetime pickers allow both date and time selection |
| AC-FB-10 | Station field shows "CVG" and is not editable (visual-only) |
| AC-FB-11 | Timezone dropdown defaults to "UTC" and offers 4 options |
| AC-FB-12 | Operator multi-select shows all 6 customers with color dots |
| AC-FB-13 | Aircraft multi-select is searchable (type to filter registrations) |
| AC-FB-14 | Type multi-select shows B777/B767/B747/B737 |
| AC-FB-15 | Changing any filter updates URL query params within 300ms |
| AC-FB-16 | Loading a URL with query params hydrates all filters correctly |
| AC-FB-17 | Navigating between pages preserves active filters in URL |
| AC-FB-18 | "Reset Filters" button returns all fields to defaults |
| AC-FB-19 | Empty results show a clear empty state (not a broken page) |
| AC-FB-20 | Invalid date range (end < start) auto-corrects with toast |
| AC-FB-21 | On mobile (<768px), filters collapse into a Sheet overlay |

---

## 13. HAR File Usage Recommendation

The HAR file at `/.claude/airways.cargojet.com.har` contains valuable reference data:

### Useful for Development
- **Gantt task structure**: Exact shape of CargoJet's Gantt data (rows, tasks, labels, tooltips)
- **Color scheme reference**: `demo-f-green` (scheduled), `demo-f-departed` (departed) CSS classes
- **Route label format**: `"YYC 584 YHM"` (origin + flight# + destination)
- **Tooltip format**: Multi-line: Flight #, Tail #, Leg, Departure, Arrival, Status
- **41 aircraft rows, 99 tasks** in a 2-day window — good baseline for performance testing

### Recommendation
- **Do not** try to replicate CargoJet's Oracle APEX implementation
- **Do** use the Gantt response shape as a reference for our task data mapping
- **Do** adopt the tooltip format (`Flight #, Tail #, Leg, Sch Dep, Sch Arr, Status`)
- **Do** consider adding flight status coloring (`SCHEDULED`, `ARRIVED`, `DEPARTED`, `NEW-FLIGHT`) as a future enhancement
- **Do** use the `start`/`end`/`viewportStart`/`viewportEnd` pattern for Gantt viewport management

---

## 14. Additional HAR Analysis: Tasks Page (Page 45)

The second HAR file (`airways.cargojet.com_search_filter.har`) captures CargoJet's **Tasks** page (page 45) — an Interactive Grid showing open maintenance tasks.

### CargoJet Full Navigation Structure

| Page | Label | Relevance to Our Dashboard |
|------|-------|---------------------------|
| 40 | Status | Possible future "Status Board" page |
| 92 | **Flight Display** | Our Flight Board (Gantt) |
| 45 | **Tasks** | Task list / workload view (future) |
| 14 | Defects | Defect tracking (out of scope) |
| 32 | Materials | Materials management (out of scope) |
| 72 | Part Inquiry | Parts lookup (out of scope) |
| 1415 | COMAT | Company materials (out of scope) |
| 95 | Rotables | Rotable parts (out of scope) |
| 98 | Wheels | Wheel/brake tracking (out of scope) |
| 54 | Parts Issue | Parts issuing (out of scope) |
| 83 | Re-Stock | Restocking (out of scope) |
| 94 | PO Paperwork | Purchase orders (out of scope) |
| 38 | Reports | Reporting (partially in scope — our Dashboard/Capacity pages) |

### Tasks Page Columns

| Column ID | Label | Type |
|-----------|-------|------|
| DUEDAT | Scheduled | Date |
| REGNUM | Fleet # | Text (format: `NNN-RRRR`, e.g., `506-GTCJ`) |
| TSKSEQ | Task ID | Number (e.g., 172880) |
| WRKCRD | WC # | Text (work card number) |
| DESCRP | Defect Description | Text |
| ACTREQ | Action Required | Text |
| STNCOD | Station | Text (**always "CVG"** in this dataset) |
| DEP | Department | Text (e.g., "Line Maintenance") |
| CLOSE_TASK | Close Task | Action |
| STATUS | Status | Text (observed: "OPEN") |
| CREBY | Created By | Text (user initials, e.g., "CMOLICGO") |
| SHPTOO | Ship To Base | Text |

### Key Findings

1. **Station is always CVG** — confirms our locked-station design decision
2. **Fleet numbering convention**: `NNN-RRRR` where NNN is fleet number, RRRR is the last 4 chars of registration (e.g., `506-GTCJ` = C-GTCJ, fleet #506)
3. **Tasks grouped by Scheduled Date + Fleet #** — useful UX pattern for our capacity/workload views
4. **49 open tasks across 16 aircraft visits** — provides scale reference
5. **Task data includes defect descriptions and action required** — could be shown in detailed tooltips

### Recommendation: Fleet Number Mapping

Add to our data model:

```typescript
// Extract fleet number from CargoJet's label format
function parseFleetLabel(label: string): { fleetNumber: string; registrationSuffix: string } | null {
  const match = label.match(/^(\d+)-([A-Z]+)$/);
  if (!match) return null;
  return { fleetNumber: match[1], registrationSuffix: match[2] };
}
// "506-GTCJ" → { fleetNumber: "506", registrationSuffix: "GTCJ" }
// We can map "GTCJ" → "C-GTCJ" for CargoJet aircraft
```

This mapping could improve our Y-axis labels on the Gantt chart for CargoJet aircraft, showing fleet numbers alongside registrations.

---

*End of Plan Amendment 001*
