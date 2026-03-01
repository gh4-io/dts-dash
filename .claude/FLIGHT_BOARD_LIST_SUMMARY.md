# Flight Board List View — Summary & Specs

> **Design Goal**: Compact mobile layout showing critical operational data at a glance
> **Component**: `FlightBoardListCard` + `FlightBoardListView`
> **Used on**: Phone devices (`device.type === 'phone'`) as default view

---

## Quick Visual

```
┌──────────────────────────────────────────────────────┐
│ FILTER BAR (stacked, mobile-friendly)               │
├──────────────────────────────────────────────────────┤
│                                                      │
│ C-FOIJ ● CargoJet Airways                       New  │
│ 05:38 → 10:00 UTC (4h 22m)                    WP: ✓ │
│ Tap for B767, CJT507, 3.0 MH                        │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ N774CK ● DHL                                 Approved│
│ 08:15 → 14:30 EDT (6h 15m)                    WP: — │
│ Tap for B737, CJT508, 2.5 MH                        │
│                                                      │
├──────────────────────────────────────────────────────┤
│ [More cards...]                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Data Hierarchy

### Tier 1: CRITICAL (Always Visible)
These 6 elements must be visible at all times — they drive operational decisions:

| Element | Example | Why Critical |
|---------|---------|-------------|
| **Registration** | C-FOIJ | Identifies specific aircraft |
| **Operator dot** | ● (green) | Quickly identifies customer by color |
| **Operator name** | CargoJet Airways | Identifies which operator |
| **Arrival time** | 05:38 UTC | When aircraft is arriving |
| **Departure time** | 10:00 UTC | When aircraft is departing |
| **WP indicator** | ✓ or — | Does this aircraft have a work package? |
| **Status** | New / Approved | What's the current status? |

### Tier 2: HIGH (Context)
Helpful context, but not immediately operational:

| Element | Example |
|---------|---------|
| Ground duration | (4h 22m) |

### Tier 3: SECONDARY (On Demand)
Nice-to-have info, shown as hint; available on tap:

| Element | Example |
|---------|---------|
| Aircraft type | B767 |
| Flight ID | CJT507 |
| Man-hours | 3.0 MH |

---

## Layout Decision: Why 3 Lines?

**Goal**: Show Tier 1 + Tier 2 in minimal space; Tier 3 on tap.

**Alternative layouts considered**:

| Layout | Pros | Cons | Selected? |
|--------|------|------|-----------|
| **1 line** (C-FOIJ 05:38→10:00) | Most compact | Misses status, WP indicator, operator name | ❌ |
| **2 lines** (Reg + times / WP + status) | Compact, shows most data | Operator name cut, hard to scan | ❌ |
| **3 lines** (Reg+Op+Status / Times+WP / Hint) | Shows all Tier 1+2, Tier 3 on tap | Slightly taller (~85px) | ✅ |
| **4+ lines** (Card per element) | Crystal clear | Takes too much space (~120px+) | ❌ |

**Result**: 3 lines strikes perfect balance — 85px height allows 8–10 cards per screen without scrolling.

---

## Data Layout Detail

### Line 1: Identification + Status
```
C-FOIJ ● CargoJet Airways                              New
^reg   ^dot ^operator name                         ^status
```
- **Why this order?** Registration first (how staff identify aircraft), operator name context, status right-aligned (scan direction).
- **Why the dot?** Color coding is faster to scan than text.
- **Why not side-by-side with times?** Operator name may be long; separated lines prevent wraparound.

### Line 2: Schedule + WP Status
```
05:38 → 10:00 UTC (4h 22m)                         WP: ✓
^arrival ^departure ^timezone ^ground             ^WP critical
```
- **Why this order?** Schedule is primary (when work happens), WP indicator right-aligned (completion check).
- **Why group times?** Arrival → Departure is a time span; shows visually where the aircraft is in the timeline.
- **Why abbreviated timezone?** "UTC" or "EDT" vs full "America/New_York" saves space.
- **Why ground in parentheses?** Secondary but useful context (how long on ground).

### Line 3: Secondary Info (Hint)
```
Tap for B767, CJT507, 3.0 MH
     ^ lightweight hint, italic gray
```
- **Why italic?** Suggests this is secondary, not critical.
- **Why gray?** Reduces visual weight; doesn't compete with Tier 1 data.
- **Why on same line?** Saves vertical space vs separate "Aircraft Type" / "Flight ID" / "MH" rows.
- **Why "Tap for"?** Tells user how to access full info (detail drawer).

---

## Component Specs

### FlightBoardListCard

**Props**:
```typescript
interface FlightCardProps {
  workPackage: WorkPackage;
  customerColor: string; // e.g., "#22c55e"
  onTap: (wpId: string) => void;
}
```

**Renders**:
- 3-line card with critical/secondary data
- Tap opens FlightDetailDrawer (full WP info)
- Hover: Light accent background (desktop), none (mobile)

**Height**: 80–90px (12px padding + 3 lines @ 16–14px + 6px gaps)

**Width**: Full container (minus gutters)

### FlightBoardListView

**Props**:
```typescript
interface FlightBoardListViewProps {
  workPackages: WorkPackage[];
  customers: CustomerColor[];
  onSelectFlightId: (wpId: string) => void;
}
```

**Features**:
- Lists all work packages as FlightBoardListCard components
- **Sorting**: Click header (Arrival, Departure, Ground, Status)
- **Sort state**: Persisted to localStorage (per device, D-056)
- **Empty state**: Shows when no flights match filters
- **Pagination**: Optional for lists >50 flights (lazy load or react-window)
- **Legend**: Hidden on phone (colors shown inline on each card)

---

## CSS Classes (Tailwind)

```tailwind
/* Card container */
.flight-card {
  @apply border-b p-3 bg-card cursor-pointer hover:bg-accent/10 active:bg-accent/20 transition-colors;
}

/* Line 1: Header */
.card-header {
  @apply flex items-center justify-between mb-1;
}

.registration {
  @apply font-bold text-base;
}

.operator-dot {
  @apply w-1.5 h-1.5 rounded-full flex-shrink-0;
}

.operator-name {
  @apply text-sm text-muted-foreground truncate flex-1;
}

.status-badge {
  @apply text-xs flex-shrink-0 ml-2;
}

/* Line 2: Schedule + WP */
.card-schedule {
  @apply flex items-center justify-between mb-1 text-sm;
}

.schedule-group {
  @apply flex items-baseline gap-1 flex-1 min-w-0;
}

.arrival-departure {
  @apply whitespace-nowrap;
}

.timezone-ground {
  @apply text-xs text-muted-foreground truncate flex-1;
}

.wp-indicator {
  @apply whitespace-nowrap flex-shrink-0 ml-2 font-semibold;
}

.wp-indicator.has-wp {
  @apply text-success;
}

/* Line 3: Hint */
.card-hint {
  @apply text-xs italic text-muted-foreground;
}
```

---

## Accessibility

- **Keyboard**: Tab through cards, Enter to open detail drawer
- **Screen reader**: Announces registration, operator, times, status, WP indicator
- **Focus visible**: Clear outline on :focus-visible
- **Color contrast**: All text ≥4.5:1 (WCAG AA)
- **Touch targets**: Entire card clickable, ≥44px × 44px
- **Hint text**: Optional/supplementary (not essential for operation)

---

## Testing Checklist

**Visual**:
- [ ] Card 80–90px height (fills screen with 8–10 visible)
- [ ] All 3 lines visible, no overflow
- [ ] Operator dot color matches customer color
- [ ] Status badge styles correct
- [ ] WP indicator shows ✓ or — correctly

**Interaction**:
- [ ] Tap card → opens detail drawer
- [ ] Detail drawer shows aircraft type, flight ID, MH
- [ ] Detail drawer has all Tier 1 + contextual data
- [ ] Sorting works (click header, sorts correctly)
- [ ] Sort state persists (reload page, sort is preserved)

**Responsive**:
- [ ] Works at 375px (iPhone SE)
- [ ] Works at 667px (iPhone landscape)
- [ ] No layout shift as data loads
- [ ] Smooth scroll (no jank)

**Accessibility**:
- [ ] Keyboard navigation (Tab, Enter)
- [ ] Screen reader announces critical data
- [ ] Color contrast ≥4.5:1
- [ ] Touch targets ≥44px
- [ ] Focus visible on all interactive elements

---

## Implementation Order

1. **Create FlightBoardListCard** (single card component)
   - Render 3-line layout
   - Use Tailwind classes above
   - Handle all data types (missing aircraft type, flight ID, MH)

2. **Create FlightBoardListView** (container)
   - Map work packages to cards
   - Add sorting logic
   - Persist sort state to localStorage
   - Add empty state

3. **Wire up to flight-board-page.tsx**
   - Default to list view on phone
   - Keep Gantt option on tablet/desktop

4. **Hide legend on phone**
   - Conditional render based on `device.type`

5. **Test** (full checklist above)

---

## Future Enhancements

- **Virtualization**: For lists >100 flights (react-window)
- **Swipe actions**: Swipe to open detail drawer (not MVP)
- **Gesture support**: Long-press for context menu (not MVP)
- **Desktop list variant**: More columns, wider layout (optional, Gantt is default)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/components/flight-board/flight-board-list-card.tsx` | Single card component |
| `src/components/flight-board/flight-board-list-view.tsx` | List container + sorting |
| `src/app/flight-board/page.tsx` | Integration (list default on phone) |
| [FLIGHT_BOARD_LIST_DESIGN.md](FLIGHT_BOARD_LIST_DESIGN.md) | Detailed design specs |

