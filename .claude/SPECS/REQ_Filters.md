# REQ: Global Filter Bar

> **What changed and why (2026-02-13):** Updated from photo-driven UI reconciliation pass. Confirmed instant filtering on desktop (per CargoJet reference). Added active filter pill display pattern. Added refresh button to FilterBar or page toolbar. Confirmed mobile sheet uses Apply-on-close model.
> Authoritative spec for all filter controls. Referenced by page specs.

## Overview

A shared `<FilterBar />` component appears on all data pages (Flight Board, Dashboard, Capacity). It does NOT appear on the Settings page. All three pages share the same Zustand-backed filter state, synced bidirectionally with URL query params.

## Filter Fields

### 1. Start Date/Time

| Property | Value |
|----------|-------|
| **Label** | "Start Date" |
| **Icon** | `fa-solid fa-calendar` |
| **Control** | DateTime picker (shadcn/ui Popover + Calendar + time input) |
| **Default** | Today 00:00 UTC |
| **Validation** | Must be valid ISO 8601. On invalid: fall back to `now - 6h` |
| **URL param** | `start` (ISO 8601, e.g., `?start=2026-02-13T09:00:00Z`) |
| **Interaction** | Changing start auto-adjusts end if end < start (swap) |
| **Persistence** | Via URL; no localStorage for v0 |

### 2. End Date/Time

| Property | Value |
|----------|-------|
| **Label** | "End Date" |
| **Icon** | `fa-solid fa-calendar-check` |
| **Control** | DateTime picker (same as Start) |
| **Default** | Today + 3 days (00:00 UTC) |
| **Validation** | Must be > Start. Max range: 30 days. On violation: clamp to 30d from start |
| **URL param** | `end` (ISO 8601) |
| **Interaction** | Same swap logic as Start |
| **Persistence** | Via URL |

### 3. Station

| Property | Value |
|----------|-------|
| **Label** | "Station" |
| **Icon** | `fa-solid fa-location-dot` |
| **Control** | Badge (shadcn/ui Badge, variant=secondary, disabled state) |
| **Default** | "CVG" |
| **Validation** | Always "CVG". Not editable. |
| **URL param** | None (never in URL, never sent to API) |
| **Interaction** | Display only. Shows lock indicator. |
| **Persistence** | Hardcoded |

### 4. Timezone

| Property | Value |
|----------|-------|
| **Label** | "Timezone" |
| **Icon** | `fa-solid fa-clock` |
| **Control** | Select dropdown (shadcn/ui Select) |
| **Default** | "UTC" |
| **Options (UI)** | `UTC`, `America/New_York` (displayed as "UTC" and "Eastern") |
| **Options (code)** | Any valid IANA timezone string accepted by internal APIs and formatters (D-014) |
| **Validation** | Must be valid IANA timezone. UI dropdown shows only the 2 above. On invalid: fall back to UTC |
| **URL param** | `tz` (e.g., `?tz=America/New_York`) |
| **Interaction** | Display-only conversion; does NOT re-fetch data. Times in all views update. |
| **Persistence** | Via URL |

### 5. Operator (= Customer)

| Property | Value |
|----------|-------|
| **Label** | "Operator" |
| **Icon** | `fa-solid fa-building` |
| **Control** | Multi-select with checkboxes (shadcn/ui Popover + Command) |
| **Default** | Empty array = "All Operators" |
| **Options** | Dynamically populated from loaded data: CargoJet Airways, Aerologic, Kalitta Air, DHL Air UK, Kalitta Charters II, 21 Air |
| **Option display** | Color dot + customer name |
| **Validation** | Each value must be a valid `CustomerName`. Invalid entries silently dropped. |
| **URL param** | `op` (comma-separated, URL-encoded: `?op=CargoJet+Airways,Aerologic`) |
| **Interaction** | Filters data: `customer IN selected`. Empty = all. AND with other filters. |
| **Persistence** | Via URL |

### 6. Aircraft

| Property | Value |
|----------|-------|
| **Label** | "Aircraft" |
| **Icon** | `fa-solid fa-plane` |
| **Control** | Searchable multi-select (shadcn/ui Popover + Command with search input) |
| **Default** | Empty array = "All Aircraft" |
| **Options** | Dynamically populated: all unique registrations in loaded data (57 in sample) |
| **Validation** | Each must exist in current dataset. Unknown entries silently dropped, console warning. |
| **URL param** | `ac` (comma-separated: `?ac=C-FOIJ,C-FPIJ`) |
| **Interaction** | Filters data: `aircraftReg IN selected`. Empty = all. AND with other filters. |
| **Persistence** | Via URL |

### 7. Type (Aircraft Type)

| Property | Value |
|----------|-------|
| **Label** | "Type" |
| **Icon** | `fa-solid fa-plane-circle-check` |
| **Control** | Multi-select with checkboxes |
| **Default** | Empty array = "All Types" |
| **Options** | `B777`, `B767`, `B747`, `B757`, `B737` (canonical types from D-015) |
| **Validation** | Each must be valid `AircraftType`. Invalid entries silently dropped. |
| **URL param** | `type` (comma-separated: `?type=B777,B767`) |
| **Interaction** | Filters data: `inferredType IN selected`. Empty = all. AND with other filters. |
| **Persistence** | Via URL |

## Filter Logic

All filters combine with **AND**:
```
visible = (departure > startDate)
       AND (arrival < endDate)
       AND (operators.length === 0 OR customer IN operators)
       AND (aircraft.length === 0 OR aircraftReg IN aircraft)
       AND (types.length === 0 OR inferredType IN types)
```

## Refresh Behavior

- **Desktop — Live update**: Filters apply immediately on change (no "Apply" button). Confirmed by CargoJet flight board reference (image 1) — no Apply button in filter row.
- **Mobile Sheet — Apply-on-close**: Changes batched during editing, applied when sheet closes. Prevents excessive re-renders on mobile.
- **Debounce**: URL update debounced 300ms to prevent excessive history entries
- **Data re-fetch**: Triggered on start/end/operator/aircraft/type change
- **Timezone change**: Display-only; no re-fetch
- **Manual refresh**: Refresh button (`fa-solid fa-arrows-rotate`) in page toolbar re-fetches data without changing filters. Derived from CargoJet "Refresh Sched" button (reference image 1).

## Active Filter Display

When non-default filters are active, show dismissible pills below the FilterBar (desktop) or at the top of the Sheet (mobile):

```
[✕ Operator: CargoJet Airways] [✕ Type: B767, B777] [Clear All]
```

- Pills use shadcn/ui Badge with dismiss button
- Only shown for filters with non-default values (not dates, not timezone)
- "Clear All" resets all entity filters (operator, aircraft, type) to empty (= "all")
- See [UI_FILTER_PATTERNS.md](../UI/UI_FILTER_PATTERNS.md) for component details

## Reset

- **Button**: "Reset Filters" with `fa-solid fa-rotate-left` icon
- **Action**: Restores all fields to defaults; clears URL params
- **Position**: End of filter row 2 (desktop); bottom of Sheet (mobile)

## URL Sync

| Direction | Trigger | Behavior |
|-----------|---------|----------|
| URL → Store | Page load / navigation | Read search params, validate, hydrate Zustand |
| Store → URL | Filter change | `router.replace()` with updated params (no scroll, no push) |
| Cross-page | Navigation | URL params carry across routes; store re-hydrates |
| Back/Forward | Browser buttons | URL change triggers store re-hydration |

## Responsive Layout

| Breakpoint | Layout |
|-----------|--------|
| Desktop ≥1280px | 2 rows: Row 1 (Start, End, Station, TZ), Row 2 (Operator, Aircraft, Type, Reset) |
| Tablet 768–1279px | 2×2 grid per row |
| Mobile <768px | Collapsed into Sheet overlay. Trigger: `fa-solid fa-filter` button + active filter count badge |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty results | Show empty state: `fa-solid fa-plane-slash` + "No aircraft match" + Reset button |
| end < start | Auto-swap; toast "Date range corrected" |
| Range > 30 days | Clamp to 30d; toast "Maximum 30-day window applied" |
| All operators deselected | Treat as "all" (empty array) |
| Unknown operator in URL | Silently drop |
| Unknown aircraft in URL | Silently drop; console.warn |

## TypeScript Types

```typescript
// src/types/filters.ts
interface FilterState {
  startDate: string;         // ISO 8601 UTC
  endDate: string;           // ISO 8601 UTC
  station: "CVG";            // Locked
  timezone: TimezoneOption;  // Default "UTC"
  operators: CustomerName[]; // Empty = all
  aircraft: string[];        // Empty = all
  aircraftTypes: AircraftType[];
}

// UI-visible options (D-014)
type TimezoneUIOption = "UTC" | "America/New_York";

// Code accepts any IANA timezone string; UI only surfaces the above two
type TimezoneOption = string; // IANA timezone identifier

interface FilterQueryParams {
  start?: string;
  end?: string;
  tz?: string;
  op?: string;   // Comma-separated
  ac?: string;   // Comma-separated
  type?: string; // Comma-separated
}
```

## Files

| File | Purpose |
|------|---------|
| `src/types/filters.ts` | Types above |
| `src/components/shared/filter-bar.tsx` | Main FilterBar component |
| `src/components/shared/datetime-picker.tsx` | Date+time picker |
| `src/components/shared/multi-select.tsx` | Searchable multi-select |
| `src/lib/hooks/use-filters.ts` | Zustand store |
| `src/lib/hooks/use-filter-url-sync.ts` | URL ↔ Store sync |
| `src/lib/utils/filter-helpers.ts` | Validation, defaults, serialization |
