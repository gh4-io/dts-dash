# UI: Filter Patterns

> **What changed and why (2026-02-14):** Major refactor to TopMenuBar architecture. FilterBar replaced with FilterDropdown component. Added ActiveChips component for dismissible filter pills. Added FormatDropdown for zoom/display controls. Updated component architecture to reflect current implementation.
>
> **Prior change (2026-02-13):** Updated from photo-driven UI reconciliation pass. Confirmed instant filtering on desktop, Apply-on-close for mobile sheet. Added active filter pill pattern (from CargoJet reference images 8-10). Added Column/Operator/Expression reference note (vNext only). Updated Type options to 5 canonical types.

Reusable patterns for filter controls used across the application. See [REQ_Filters.md](../SPECS/REQ_Filters.md) for the full spec.

## Component Architecture

### TopMenuBar Pattern (Current Implementation)

```
<TopMenuBar>
  ├── <FilterDropdown>
  │     ├── <DateTimePicker />          × 2 (start, end)
  │     ├── <Badge variant="secondary"> (station — display only)
  │     ├── <Select />                  (timezone)
  │     ├── <MultiSelect />             × 3 (operator, aircraft, type)
  │     └── <Button />                  (reset)
  ├── <ActionsMenu>                     (page-specific actions)
  ├── <FormatDropdown>                  (page-specific display controls)
  ├── <ThemeToggle />
  ├── <MobileNav />                     (mobile only)
  └── <UserMenu />
</TopMenuBar>

<ActiveChips>                           (shown below TopMenuBar when filters active)
  ├── <Badge />                         × N (one per active filter)
  └── <Button />                        (clear all)
</ActiveChips>
```

### Legacy FilterBar Pattern (Removed 2026-02-14)

Previously used a dedicated FilterBar component. Replaced with FilterDropdown in TopMenuBar for better space efficiency and consistency with ActionsMenu/FormatDropdown patterns.

## DateTimePicker Pattern

Combines shadcn/ui Popover + Calendar + time input.

```
┌─ Popover Trigger ─────────────────┐
│ 📅 Feb 13, 2026 09:00 UTC        │
└───────────────────────────────────┘
       ↓ (click to open)
┌─ Popover Content ─────────────────┐
│ ┌─ Calendar ────────────────────┐ │
│ │      February 2026            │ │
│ │  Su Mo Tu We Th Fr Sa         │ │
│ │              ...  [13] 14     │ │
│ └───────────────────────────────┘ │
│ Time: [09] : [00]  ◀ 24h format  │
│ ┌─────────┐ ┌─────────┐          │
│ │  Cancel  │ │  Apply  │          │
│ └─────────┘ └─────────┘          │
└───────────────────────────────────┘
```

- Calendar uses shadcn/ui Calendar (day-picker)
- Time is two numeric inputs (HH, MM) with spin buttons
- All internal values stored as UTC ISO 8601
- Display converted per timezone selection

## MultiSelect Pattern

Used for Operator, Aircraft, and Type filters.

```
┌─ Trigger ─────────────────────────┐
│ ✈ Aircraft  (3 selected)         │
└───────────────────────────────────┘
       ↓ (click to open)
┌─ Popover ─────────────────────────┐
│ 🔍 Search aircraft...             │
│ ──────────────────────────────────│
│ ☑ C-FOIJ                          │
│ ☑ C-FPIJ                          │
│ ☑ C-GTCJ                          │
│ ☐ C-FKCJ                          │
│ ☐ N721CK                          │
│ ... (scrollable)                   │
│ ──────────────────────────────────│
│ ☐ Select All    Clear              │
└───────────────────────────────────┘
```

### Props Interface

```typescript
interface MultiSelectProps {
  label: string;
  icon: string;              // FA icon class
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchable?: boolean;      // true for Aircraft (57 options)
  placeholder?: string;
}
```

### Operator-Specific

- Each option shows a colored dot from `useCustomers()` store (D-010)
- Uses `CustomerBadge` component for display
- 6 options — no search needed, but checkbox list

### Aircraft-Specific

- 57+ options — search input required
- Shows registration only (no color dot)
- Sorted alphabetically

### Type-Specific

- 5 canonical types: B777, B767, B747, B757, B737 (D-015)
- No search needed
- Checkbox list

## Trigger Display Rules

| State | Trigger Text |
|-------|-------------|
| None selected | "All {Label}" (grayed) |
| 1 selected | Show the value |
| 2–3 selected | Show comma-separated |
| 4+ selected | "{N} selected" |

## Mobile Pattern (Sheet)

Below `md` breakpoint, the entire FilterBar collapses into a Sheet:

```
┌─ Sticky Header ───────────────────┐
│ [Filter Icon] 3 active            │
└───────────────────────────────────┘
       ↓ (tap to open Sheet)
┌─ Sheet ───────────────────────────┐
│ Filters                      ✕    │
│ ──────────────────────────────────│
│ Start Date    [Feb 13 09:00]      │
│ End Date      [Feb 16 09:00]      │
│ Station       CVG 🔒              │
│ Timezone      [UTC ▾]             │
│ Operator      [All Operators ▾]   │
│ Aircraft      [All Aircraft ▾]    │
│ Type          [All Types ▾]       │
│ ──────────────────────────────────│
│ [    Reset Filters    ]           │
│ [     Apply & Close   ]           │
└───────────────────────────────────┘
```

Mobile mode: Apply button required (no live update to reduce re-renders).

## FilterDropdown Pattern

Collapsible dropdown in TopMenuBar containing all filter controls.

```
┌─ TopMenuBar ──────────────────────────────────────────┐
│ [Filters ▾] [Actions ▾] [Format ▾]      [◐] [≡] [@] │
└───────────────────────────────────────────────────────┘
       ↓ (click Filters)
┌─ FilterDropdown Popover ──────────────────────┐
│ Start Date    [Feb 13 09:00 UTC]              │
│ End Date      [Feb 16 09:00 UTC]              │
│ Station       CVG 🔒                          │
│ Timezone      [UTC ▾]                         │
│ Operator      [All Operators ▾]              │
│ Aircraft      [All Aircraft ▾]               │
│ Type          [All Types ▾]                  │
│ ───────────────────────────────────────────  │
│ [    Reset Filters    ]                      │
└───────────────────────────────────────────────┘
```

- Uses Popover (shadcn/ui) triggered by TopMenuBar button
- All filters apply instantly (no Apply button on desktop)
- Reset button at bottom clears all filters to defaults
- Component: `src/components/shared/filter-dropdown.tsx`

## ActiveChips Pattern

Derived from CargoJet reference images (8-10). When filters have non-default values, show active filter state as dismissible pills below TopMenuBar.

```
┌─ Active Filters (below TopMenuBar, inline) ─────────────────┐
│ [✕ Operator: CargoJet] [✕ Type: B767, B777] [Clear All]     │
└───────────────────────────────────────────────────────────────┘
```

- Each active filter shows as a Badge (shadcn/ui) with dismiss X
- Clicking X removes that filter (reverts to "all")
- "Clear All" resets all filters to defaults
- Only shown when at least one filter has a non-default value
- Not shown for Start/End dates or Timezone (always have a value)
- Component: `src/components/shared/active-chips.tsx`

## FormatDropdown Pattern

Page-specific display controls (zoom, layout options) in TopMenuBar.

```
┌─ TopMenuBar ──────────────────────────────────────────┐
│ [Filters ▾] [Actions ▾] [Format ▾]      [◐] [≡] [@] │
└───────────────────────────────────────────────────────┘
                          ↓ (click Format)
┌─ FormatDropdown Popover (Flight Board) ───────────┐
│ Zoom Presets                                       │
│ [6h] [12h] [1d] [3d] [1w]                         │
│                                                    │
│ Zoom Controls                                      │
│ [Zoom In] [Zoom Out] [Now] [Reset]                │
│                                                    │
│ Display                                            │
│ ☐ Expanded Mode                                   │
│ [🔄 Refresh]                                       │
└────────────────────────────────────────────────────┘
```

- Content varies by page (Flight Board: zoom; Dashboard: chart toggles; etc.)
- Uses Popover (shadcn/ui) triggered by TopMenuBar button
- Component: `src/components/shared/format-dropdown.tsx` (generic wrapper)
- Page-specific: `src/components/flight-board/flight-board-format-panel.tsx`

## Filtering Model

| Context | Model | Rationale |
|---------|-------|-----------|
| Desktop | **Instant** — filters apply immediately on change | Responsive feel, no extra click needed |
| Mobile Sheet | **Apply-on-close** — changes batched, applied when sheet closes | Prevents excessive re-renders during multi-field changes on mobile |

The CargoJet reference (image 1) shows a compact filter row with no "Apply" button, confirming instant filtering for the main filter bar.

## Column/Operator/Expression Pattern (vNext Reference)

CargoJet's APEX system (image 12) uses a modal filter dialog with Column/Operator/Expression fields and Apply/Cancel/Delete buttons. This is a **reference pattern only** — not implemented in v1.

For vNext consideration: advanced filter mode with custom expressions (e.g., "Ground Time > 24h", "MH > 5.0"). Would use a modal with the Column/Operator/Expression form.

## State Flow

```
URL params → useFilterUrlSync() → Zustand store → FilterBar UI
                                                  ↓ (user change)
                                        Zustand store → URL params
                                                      → API re-fetch
                                                      → Page re-render
```

## References

- CargoJet filter chips: `.claude/assets/img/airways...(1-4).png`
- CargoJet filter dialog: `.claude/assets/img/airways...14011313998446___45__.png`
- [UI_REFERENCE_MAP.md](UI_REFERENCE_MAP.md) — images 8-12
