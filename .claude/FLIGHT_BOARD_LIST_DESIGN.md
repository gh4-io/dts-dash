# Flight Board List View — Mobile Compact Design

> **Component**: `FlightBoardListView` (mobile-optimized)
> **Used on**: Flight Board page, default for phone (`device.type === 'phone'`)
> **Alternative**: Gantt view on tablet/desktop (or phone with optional toggle)
> **Priority**: CRITICAL — handles 95% of mobile operations staff workflows

---

## Design Philosophy

**Goal**: Show essential operational data in minimal space without sacrificing readability or usability.

**Constraints**:
- Screen width: 375px (iPhone SE) to 667px (iPhone landscape)
- Max card height: 80–90px (3 lines + padding)
- Touch targets: ≥44px vertical hit area
- Data density: Show 8–10 cards per screen without scrolling

**Result**: Compact 3-line card design with critical info visible, secondary info accessible on tap.

---

## Card Anatomy

### Line 1: Registration + Operator + Status (Height: 24px)

```
C-FOIJ ● CargoJet Airways                              New
^      ^ ^                                              ^
reg   dot operator name (truncated if long)       status badge
```

**Elements**:
1. **Registration** (left-aligned)
   - Font: Bold, 16px
   - Color: `--foreground` (white/black)
   - Max width: ~60px (5–6 chars typical)
   - Example: "C-FOIJ", "N774CK"

2. **Operator Dot** (left, after reg)
   - Size: 6px circle
   - Color: Customer color from `useCustomers()` store
   - Margin: 6px left/right

3. **Operator Name** (left, after dot)
   - Font: 14px, medium weight
   - Color: `--muted-foreground` (gray)
   - Max width: Remaining space (flex-grow)
   - Overflow: `truncate` (ellipsis if too long)
   - Examples: "CargoJet Airways", "Aerologic", "DHL"

4. **Status Badge** (right-aligned)
   - Font: 11px, semibold
   - Variant: Outlined pill
   - Colors:
     - "New": Blue outline + text
     - "Approved": Green outline + text
     - "Other": Gray outline + text
   - Width: Auto (~40–60px)
   - Padding: 4px 8px

**Layout CSS**:
```css
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 6px;
}

.reg-operator-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0; /* Enable truncation */
  flex: 1;
}

.registration {
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
}

.operator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.operator-name {
  font-size: 14px;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.status-badge {
  font-size: 11px;
  padding: 4px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}
```

---

### Line 2: Schedule + WP Indicator (Height: 20px)

```
05:38 → 10:00 UTC (4h 22m)                         WP: ✓
^arrival ^departure ^timezone ^ground             ^WP indicator
```

**Elements**:
1. **Arrival Time** (left-aligned)
   - Font: 14px, regular
   - Format: `HH:mm` (timezone shown once, not per time)
   - Color: `--foreground`
   - Example: "05:38"

2. **Arrow Separator**
   - Text: "→" or "–>"
   - Margin: 4px left/right
   - Color: `--muted-foreground`

3. **Departure Time**
   - Font: 14px, regular
   - Format: `HH:mm`
   - Example: "10:00"

4. **Timezone + Ground Duration** (small, after departure)
   - Font: 12px, regular
   - Color: `--muted-foreground`
   - Format: `UTC (Xh Xm)` or `EDT (Xh Xm)`
   - Example: "UTC (4h 22m)"

5. **WP Indicator** (right-aligned)
   - Font: 14px, semibold
   - Format: "WP: ✓" (has WP) or "WP: —" (no WP)
   - Color: Green if "✓", gray if "—"
   - Width: 40px (flex-shrink to prevent overflow)

**Layout CSS**:
```css
.card-schedule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 4px;
  font-size: 14px;
}

.schedule-group {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.arrival-departure {
  white-space: nowrap;
}

.timezone-ground {
  font-size: 12px;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.wp-indicator {
  font-size: 14px;
  white-space: nowrap;
  flex-shrink: 0;
  text-align: right;
  width: 40px;
}

.wp-indicator.has-wp {
  color: var(--success);
}

.wp-indicator.no-wp {
  color: var(--muted-foreground);
}
```

---

### Line 3: Secondary Info Hint (Height: 16px)

```
Tap for B767, CJT507, 3.0 MH
     ^ aircraft type, flight ID, man-hours (secondary)
```

**Elements**:
1. **Hint Text** (full width, left-aligned)
   - Font: 12px, italic
   - Color: `--muted-foreground`
   - Style: Lightweight, suggestive (not demanding)
   - Content: `"Tap for [type], [flight ID], [MH]"`

**Layout CSS**:
```css
.card-hint {
  font-size: 12px;
  font-style: italic;
  color: var(--muted-foreground);
}
```

---

## Card Container

**Padding**: 12px (12px vertical = 44px+ touch target)
**Border**: Bottom border only (separator between cards)
**Background**: `--card` (slightly elevated from background)
**Hover/Active**: Light accent background on hover (desktop), full opacity on mobile
**Transition**: `transition-colors 150ms ease-out` (smooth on desktop, none on mobile)

**Dimensions**:
- Min height: 84px (3 lines @ 16px each + padding + gaps)
- Max width: Full container width
- Margin: 0 (flush to edges)

**Container CSS**:
```css
.flight-card {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  transition: background-color 150ms ease-out;
}

.flight-card:hover {
  background-color: var(--accent-50); /* Light accent tint */
}

.flight-card:active {
  background-color: var(--accent-100); /* Darker on mobile tap */
}

@media (max-width: 600px) {
  .flight-card {
    transition: none; /* No transition on mobile for instant feedback */
  }
}
```

---

## Full Card Example

```html
<div class="flight-card">
  <!-- Line 1 -->
  <div class="card-header">
    <div class="reg-operator-group">
      <span class="registration">C-FOIJ</span>
      <div class="operator-dot" style="background-color: #22c55e;"></div>
      <span class="operator-name">CargoJet Airways</span>
    </div>
    <div class="status-badge variant-outline">New</div>
  </div>

  <!-- Line 2 -->
  <div class="card-schedule">
    <div class="schedule-group">
      <span class="arrival-departure">05:38 → 10:00</span>
      <span class="timezone-ground">UTC (4h 22m)</span>
    </div>
    <div class="wp-indicator has-wp">WP: ✓</div>
  </div>

  <!-- Line 3 -->
  <div class="card-hint">
    Tap for B767, CJT507, 3.0 MH
  </div>
</div>
```

---

## React/Tailwind Component Implementation

```tsx
// src/components/flight-board/flight-board-list-card.tsx

interface FlightCardProps {
  workPackage: WorkPackage;
  customerColor: string;
  onTap: (wpId: string) => void;
}

export const FlightBoardListCard: React.FC<FlightCardProps> = ({
  workPackage,
  customerColor,
  onTap,
}) => {
  const { aircraftReg, customer, arrival, departure, status, effectiveMH, aircraftType, flightId, hasWorkpackage } = workPackage;

  const groundHours = computeGroundHours(arrival, departure);
  const groundText = formatGroundTime(groundHours); // "4h 22m"
  const arrivalTime = formatTime(arrival, 'HH:mm');
  const departureTime = formatTime(departure, 'HH:mm');
  const timezone = 'UTC'; // From filter context

  const statusLabel = getStatusLabel(status); // "New", "Approved", etc.
  const wpIndicator = hasWorkpackage ? '✓' : '—';
  const wpColor = hasWorkpackage ? 'text-success' : 'text-muted-foreground';

  return (
    <div
      onClick={() => onTap(workPackage.id)}
      className="
        border-b p-3
        bg-card
        cursor-pointer
        hover:bg-accent/10
        active:bg-accent/20
        transition-colors
      "
    >
      {/* Line 1: Registration + Operator + Status */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-bold text-base whitespace-nowrap">
            {aircraftReg}
          </span>
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: customerColor }}
          />
          <span className="text-sm text-muted-foreground truncate">
            {customer}
          </span>
        </div>
        <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
          {statusLabel}
        </Badge>
      </div>

      {/* Line 2: Schedule + WP */}
      <div className="flex items-center justify-between mb-1 text-sm">
        <div className="flex items-baseline gap-1 min-w-0 flex-1">
          <span className="whitespace-nowrap">
            {arrivalTime} → {departureTime}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {timezone} ({groundText})
          </span>
        </div>
        <span className={cn('whitespace-nowrap flex-shrink-0 ml-2 font-semibold', wpColor)}>
          WP: {wpIndicator}
        </span>
      </div>

      {/* Line 3: Secondary Info Hint */}
      <div className="text-xs italic text-muted-foreground">
        Tap for {aircraftType}, {flightId}, {effectiveMH} MH
      </div>
    </div>
  );
};
```

---

## Sorting

**Default sort**: By arrival time (earliest first)

**Column headers** (optional, above list):
- Click to sort ascending/descending
- Show sort indicator (▲▼)
- Persist to localStorage per device (D-056)

```
[Arrival ▲] [Departure] [Ground] [Status]
```

---

## List Container

```tsx
// src/components/flight-board/flight-board-list-view.tsx

interface FlightBoardListViewProps {
  workPackages: WorkPackage[];
  customers: CustomerColor[];
  onSelectFlightId: (wpId: string) => void;
}

export const FlightBoardListView: React.FC<FlightBoardListViewProps> = ({
  workPackages,
  customers,
  onSelectFlightId,
}) => {
  const [sortBy, setSortBy] = useState<'arrival' | 'departure' | 'ground' | 'status'>('arrival');
  const [sortAsc, setSortAsc] = useState(true);

  // Sort work packages
  const sortedWps = useMemo(() => {
    const sorted = [...workPackages].sort((a, b) => {
      const cmp = getSortComparator(sortBy)(a, b);
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [workPackages, sortBy, sortAsc]);

  const getCustomerColor = (customer: string) => {
    return customers.find(c => c.name === customer)?.color || '#gray';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Optional: Sort headers */}
      {/* ... */}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sortedWps.length === 0 ? (
          <EmptyState icon="fa-plane-slash" message="No flights match current filters" />
        ) : (
          sortedWps.map(wp => (
            <FlightBoardListCard
              key={wp.id}
              workPackage={wp}
              customerColor={getCustomerColor(wp.customer)}
              onTap={onSelectFlightId}
            />
          ))
        )}
      </div>
    </div>
  );
};
```

---

## Edge Cases & Handling

| Scenario | Design |
|----------|--------|
| **Long operator name** | Truncate with ellipsis (e.g., "CargoJet Airways → CargoJet...") |
| **No WP** | Show "WP: —" (gray, same visual weight) |
| **Very short arrival/departure gap** | Still show both times (e.g., "10:15 → 10:16") |
| **No aircraft type** | Show "Unknown" in hint |
| **No flight ID** | Show "—" in hint |
| **Zero MH** | Show "0.0 MH" or "—" in hint |
| **Empty list** | Show EmptyState (icon + message) |
| **Large list (100+ flights)** | Pagination or lazy-load, keep list scrollable |

---

## Testing Checklist

- [ ] Card displays correctly at 375px (iPhone SE)
- [ ] Card displays correctly at 667px (iPhone landscape)
- [ ] All 3 lines visible without overflow
- [ ] Tap on card opens detail drawer
- [ ] Operator dot color matches customer color
- [ ] Status badge displays correctly ("New", "Approved", etc.)
- [ ] WP indicator shows ✓ or — correctly
- [ ] Ground time calculates correctly
- [ ] Hint text shows aircraft type, flight ID, MH
- [ ] Sorting works (click header, persists)
- [ ] Empty state shows when no flights match
- [ ] Scrolling is smooth (no jank)
- [ ] Touch targets ≥44px (vertical)
- [ ] No layout shift as data loads
- [ ] Keyboard accessibility (Tab through cards, Enter to open)

---

## Accessibility

- **Keyboard navigation**: Tab through cards, Enter to open detail drawer
- **Screen reader**: Read registration, operator, times, status, WP indicator
- **Focus visible**: Outline on :focus-visible
- **Color contrast**: All text ≥4.5:1 (WCAG AA)
- **Touch targets**: Entire card is ≥44px × 44px
- **Hint text**: Optional/decorative, not essential info

---

## Performance Considerations

- **Virtualization**: For lists >50 flights, use React.memo + virtualization (react-window)
- **Sorting**: Use useMemo to avoid unnecessary re-sorts
- **Detail drawer**: Load on-demand (lazy load full WP details)
- **Customer colors**: Cache in Zustand store (useCustomers())

---

## Variants & Future

### Desktop List View (if needed)
- Show more columns: Arrival, Departure, Ground, Aircraft Type, Flight ID, Status, WP, MH
- Wider cards, sortable headers, selectable rows
- Never the default on desktop (Gantt is default)

### Swipe Actions (Future)
- Swipe left: Shortcut to detail drawer
- Swipe right: Pin/favorite (not MVP)

### Gestures (Future)
- Long-press: Show context menu (copy reg, share, etc.)
- Double-tap: Quick actions (not MVP)

