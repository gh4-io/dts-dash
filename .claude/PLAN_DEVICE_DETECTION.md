# Implementation Plan: Device Detection for Responsive Layout (D-061)

> **Status**: Ready for Sonnet/Opus implementation
> **Scope**: Replace pixel-based breakpoints with browser device detection + fallback
> **Priority**: Medium (UX improvement, non-breaking)
> **Estimate**: ~4–6 hours implementation + testing

---

## Executive Summary

Replace Tailwind's CSS media query breakpoints (`sm`, `md`, `xl`) with explicit device type detection via browser APIs. Device classification happens at runtime using `navigator.maxTouchPoints` and viewport width. Fallback to pixel-only classification defaults to **Desktop** layout (not mobile).

**Key Change**: Logic moves from CSS to TypeScript/React. UI still renders conditionally, but device type is now explicit and testable.

---

## Requirements (from D-061)

### Device Classification Logic

```typescript
// Pseudo-code for useDeviceType() hook

interface DeviceContext {
  type: 'phone' | 'tablet' | 'desktop';
  width: number;
  height: number;
  isTouchCapable: boolean;
  isLandscape: boolean;
  detectionMethod: 'touch+width' | 'width-only';  // track fallback
}

function classifyDevice(width: number, height: number, maxTouchPoints: number): 'phone' | 'tablet' | 'desktop' {
  const isTouchCapable = maxTouchPoints > 0;

  // Primary: Touch capability + width
  if (isTouchCapable && width < 768) return 'phone';
  if (isTouchCapable && width >= 768 && width < 1280) return 'tablet';

  // Fallback: Width only (default to Desktop if width >= 1280)
  if (width >= 1280) return 'desktop';
  if (width >= 768) return 'tablet';

  // Width < 768 + no touch detected = assume desktop (e.g., resized desktop browser)
  return 'desktop';  // ← NOT mobile!
}
```

### Acceptance Criteria

- [x] Hook `useDeviceType()` returns correct device type based on detection logic
- [x] Device type updates on window resize + orientation change
- [x] Fallback behavior: width-only classification defaults to Desktop (not Phone)
- [x] All existing UI components conditional on `device` instead of Tailwind breakpoints
- [x] No CSS media queries in new responsive components (legacy Tailwind breakpoints removed where possible)
- [x] Touch target sizes (44px+) enforced for phone/tablet layouts
- [x] Tests: unit tests for classification logic, integration tests for hook behavior
- [x] No visual regressions on desktop, tablet, phone
- [x] Performance: zero layout thrashing, debounced resize handlers

---

## Mobile-Specific Requirements (D-062)

### Flight Board (Mobile)
- **Default view**: List view (not Gantt)
- **Gantt limitation**: Canvas-based ECharts doesn't scale well on small screens; complex to navigate with touch
- **List view**: Cards with aircraft info, arrival/departure times, ground duration, customer color dot
- **Interaction**: Tap to expand detail drawer (existing pattern)

### Dashboard (Mobile)
- **Layout reordering**: Graphs on top, KPI cards below
- **Rationale**: Graphs provide more context on small screens; scrolling naturally flows graphs → summary cards
- **Charts**: Combined bar+line and donut charts stack vertically
- **KPI cards**: 1-column stack
- **Operator table**: Full-width with horizontal scroll

### Navigation & Top Bar (Mobile)
- **Mobile bottom tab bar** (fixed): Dashboard | Flights | Feedback | Menu
- **Top section hidden**: Hide mode toggle (`◐` theme icon) and user menu from header
- **Rationale**: Reclaim ~60px vertical space on small screens
- **Menu item** includes:
  - User menu (Account, Admin, Logout)
  - View mode toggle (Gantt/List for flight board, where applicable)
- **Hamburger removed**: Replaced by bottom tab bar for primary nav

### Print Functions
- **Hide print button** on mobile (phone device type)
- **Location**: Currently in TopMenuBar or dashboard header
- **Rationale**: Print is a desktop workflow; mobile users don't print

---

## Implementation Phases

### Phase 1: Foundation (2–3 hours)

**Goal**: Create device detection hook and integrate into app

#### 1.1 Create `use-device-type.ts` hook

**File**: `src/lib/hooks/use-device-type.ts`

Requirements:
- Zustand store for `device` state (with `skipHydration`)
- Runtime detection on client mount
- Resize + orientation change listeners with **debounce** (300ms)
- Return: `{ type, width, height, isTouchCapable, isLandscape, detectionMethod }`
- Export a client component wrapper for SSR safety

```typescript
// Sketch
export const useDeviceType = () => {
  const store = useDeviceTypeStore();
  useEffect(() => {
    const detect = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTouchCapable = navigator.maxTouchPoints > 0;
      const type = classifyDevice(width, height, navigator.maxTouchPoints);
      store.setDevice({ type, width, height, isTouchCapable, isLandscape: width < height, ... });
    };
    detect();
    const debounced = debounce(detect, 300);
    window.addEventListener('resize', debounced);
    window.addEventListener('orientationchange', debounced);
    return () => { /* cleanup */ };
  }, []);
  return store.device;
};
```

#### 1.2 Add Zustand store

**File**: `src/lib/hooks/use-device-type.ts` (same file)

```typescript
const useDeviceTypeStore = create<DeviceContext>(
  persist(
    (set) => ({
      type: 'desktop',
      width: 1280,
      height: 720,
      isTouchCapable: false,
      isLandscape: false,
      detectionMethod: 'width-only',
      setDevice: (ctx) => set(ctx),
    }),
    { name: 'device-type', storage: sessionStorage }
  ),
  { name: 'useDeviceType' }
);
```

#### 1.3 Create wrapper component

**File**: `src/components/layout/device-type-hydrator.tsx`

```typescript
'use client';

export function DeviceTypeHydrator({ children }) {
  useDeviceType(); // Trigger hook on mount
  return children;
}
```

**Usage in `layout.tsx`:**
```typescript
<DeviceTypeHydrator>
  {children}
</DeviceTypeHydrator>
```

#### 1.4 Tests

**File**: `src/__tests__/lib/device-type.test.ts`

```typescript
describe('classifyDevice', () => {
  it('phone: touch + width < 768', () => {
    expect(classifyDevice(375, 667, 5)).toBe('phone');
  });

  it('tablet: touch + 768 <= width < 1280', () => {
    expect(classifyDevice(768, 1024, 5)).toBe('tablet');
  });

  it('desktop: width >= 1280', () => {
    expect(classifyDevice(1920, 1080, 0)).toBe('desktop');
  });

  it('fallback: no touch, width 500 → desktop (NOT phone)', () => {
    expect(classifyDevice(500, 667, 0)).toBe('desktop');
  });

  it('fallback: no touch, width 900 → tablet', () => {
    expect(classifyDevice(900, 600, 0)).toBe('tablet');
  });
});

describe('useDeviceType hook', () => {
  it('updates on window resize', async () => {
    // Mock window.innerWidth, trigger resize, assert state updated
  });
});
```

---

### Phase 2: Refactor Components (2–3 hours)

**Goal**: Replace CSS breakpoints with device type checks in components

#### 2.1 Sidebar

**File**: `src/components/layout/sidebar.tsx`

Current:
```tsx
<div className="hidden sm:block md:min-w-64 ..."> {/* CSS breakpoints */}
```

New:
```tsx
'use client';
const device = useDeviceType();

return device.type === 'phone' ? (
  <SheetNavigation /> // Overlay sheet
) : (
  <StaticSidebar expanded={device.type === 'desktop'} /> // Collapsed on tablet
);
```

#### 2.2 FilterBar

**File**: `src/components/shared/filter-bar.tsx`

Current:
```tsx
<div className="grid grid-cols-3 md:grid-cols-7 gap-2"> {/* Responsive grid */}
```

New:
```tsx
const device = useDeviceType();
const gridCols = device.type === 'desktop' ? 7 : device.type === 'tablet' ? 4 : 2;

return <div className={`grid grid-cols-${gridCols}`}> {/* or inline style */}
```

Or use CSS Grid with auto-fit (better):
```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: device.type === 'desktop' ? 'repeat(7, 1fr)' : device.type === 'tablet' ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
  gap: '0.5rem',
}}>
```

#### 2.3 Dashboard Layout

**File**: `src/components/dashboard/dashboard-grid.tsx` (NEW component)

Encapsulate the 3-column layout logic:

```tsx
'use client';
const device = useDeviceType();

return (
  <div className={classNames(
    'grid gap-4',
    device.type === 'desktop' && 'grid-cols-[250px_1fr_300px]',
    device.type === 'tablet' && 'grid-cols-1 md:grid-cols-2',
    device.type === 'phone' && 'grid-cols-1',
  )}>
    {/* KPI cards, charts */}
  </div>
);
```

#### 2.4 Touch Target Enforcement

**File**: `src/components/shared/touch-safe-button.tsx` (utility component)

```tsx
'use client';
const device = useDeviceType();
const minSize = (device.type === 'phone' || device.type === 'tablet') ? 'h-11 w-11' : 'h-8 w-8';

return <button className={minSize}> {/* 44px+ for touch */}
```

#### 2.5 Operator Performance Table (Horizontal Scroll on Phone)

**File**: `src/components/dashboard/operator-performance.tsx`

```tsx
const device = useDeviceType();

return (
  <div className={device.type === 'phone' ? 'overflow-x-auto' : ''}>
    <table> {/* Existing table */}
  </div>
);
```

#### 2.6 Tests

**File**: `src/__tests__/components/responsive-components.test.tsx`

```typescript
describe('Responsive Components', () => {
  it('Sidebar renders SheetNavigation on phone', () => {
    // Mock useDeviceType to return { type: 'phone', ... }
    // Assert SheetNavigation rendered
  });

  it('Dashboard grid uses 3-col on desktop, 2-col on tablet, 1-col on phone', () => {
    // Test each device type
  });
});
```

---

### Phase 3: Remove Legacy Tailwind Breakpoints (1 hour)

**Goal**: Clean up CSS media queries where device type is now explicit

#### 3.1 Audit Components

Search for and remove:
- `className="hidden sm:block"`
- `className="md:..."`
- `className="xl:..."`

Where device type is now handled explicitly in JSX.

#### 3.2 Update `layout.tsx` (Root)

Remove media query classes from:
- Header
- Bottom tab bar
- Main content wrapper

#### 3.3 Verify No Regressions

- `npm run build` — no CSS errors
- Visual regression testing (manual: phone, tablet, desktop)

---

### Phase 4: Mobile-Specific Features (3–4 hours)

**Goal**: Implement mobile-first navigation, flight board list view, and layout adjustments

#### 4.1 Reorganize Navigation (Mobile Bottom Tab Bar)

**Files to modify**:
- `src/components/layout/bottom-tab-bar.tsx` — Already exists (Phase 4 work) but needs updating
- `src/components/layout/header.tsx` — Hide mode toggle + user menu on phone
- `src/components/layout/layout.tsx` — Conditional rendering

**Changes**:
```tsx
// bottom-tab-bar.tsx
const device = useDeviceType();
if (device.type !== 'phone') return null; // Only show on phone

const tabs = [
  { label: 'Dashboard', icon: 'fa-chart-line', href: '/dashboard' },
  { label: 'Flights', icon: 'fa-plane-departure', href: '/flight-board' },
  { label: 'Feedback', icon: 'fa-comments', href: '/feedback' }, // TBD: route
  { label: 'Menu', icon: 'fa-ellipsis-vertical', action: openMobileMenu },
];

return (
  <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex gap-4 justify-center">
    {tabs.map(tab => (
      <button key={tab.label} onClick={tab.action || (() => navigate(tab.href))}>
        <Icon className={tab.icon} />
        <span className="text-xs">{tab.label}</span>
      </button>
    ))}
  </nav>
);
```

**Mobile Menu (from Menu tab)**:
```tsx
// mobile-menu-sheet.tsx (NEW)
// Slides up from bottom, includes:
// - User account info (display name, email)
// - Account link
// - Admin link (if admin+)
// - View mode toggle (Gantt/List for flight board)
// - Logout button

const MobileMenuSheet = () => {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="h-auto">
        <div className="flex flex-col gap-4 py-4">
          {/* User info */}
          <div className="px-4 pb-2">
            <p className="font-semibold">{session?.user?.name}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <Separator />

          {/* Nav items */}
          <Link href="/account" className="px-4 py-2">Account</Link>
          {hasAdminRole && <Link href="/admin" className="px-4 py-2">Admin</Link>}

          {/* View mode toggle (Flight Board only) */}
          <ViewModeToggle />

          <Separator />
          <button onClick={logout} className="px-4 py-2 text-left">Logout</button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
```

#### 4.2 Hide Mode Toggle & User Menu on Phone

**File**: `src/components/layout/header.tsx`

```tsx
const device = useDeviceType();

return (
  <header className="flex items-center justify-between p-4">
    <Logo />

    {/* Hide on phone */}
    {device.type !== 'phone' && (
      <div className="flex gap-2">
        <ThemeToggle /> {/* ◐ icon */}
        <UserMenu />
      </div>
    )}
  </header>
);
```

#### 4.3 Flight Board List View (Mobile Default)

**File**: `src/components/flight-board/flight-board-list-view.tsx` + `flight-board-list-card.tsx` (new)

**Spec**: See [FLIGHT_BOARD_LIST_DESIGN.md](FLIGHT_BOARD_LIST_DESIGN.md) for complete design

**Compact 3-Line Card Design**:

```
Line 1: C-FOIJ ● CargoJet Airways                              New
Line 2: 05:38 → 10:00 UTC (4h 22m)                         WP: ✓
Line 3: Tap for B767, CJT507, 3.0 MH
```

**Critical Elements** (always visible):
- Registration (bold, 16px)
- Operator dot + name
- Arrival time
- Departure time
- WP indicator (✓/—)
- Status badge

**Secondary Elements** (shown in hint/on tap):
- Aircraft type
- Flight ID
- Man-hours

**Requirements**:
- Card height: 80–90px (3 lines + 12px padding = 44px+ touch target)
- Tap to open detail drawer (same as desktop)
- Sort by: Arrival (default), Departure, Ground, Status
- Sort state persisted to localStorage
- Customer color dot (left of operator name)
- Empty state when no flights match

**Component Structure**:
```tsx
// flight-board-list-card.tsx — Single card component
export const FlightBoardListCard: React.FC<FlightCardProps> = ({
  workPackage,
  customerColor,
  onTap,
}) => {
  // 3-line layout:
  // Line 1: Reg + Operator + Status badge
  // Line 2: Arrival → Departure + WP indicator
  // Line 3: Hint (aircraft type, flight ID, MH)
};

// flight-board-list-view.tsx — Container with sorting
export const FlightBoardListView: React.FC<ListViewProps> = ({
  workPackages,
  customers,
  onSelectFlightId,
}) => {
  const [sortBy, setSortBy] = useState<'arrival' | 'departure' | 'ground' | 'status'>('arrival');
  // Map work packages → FlightBoardListCard components
  // Include optional sort headers above list
};
```

**Integration**:
```tsx
// flight-board-page.tsx
const device = useDeviceType();
const [viewMode, setViewMode] = useState(
  device.type === 'phone' ? 'list' : localStorage.getItem('flightBoardViewMode') || 'gantt'
);

return (
  <>
    {device.type !== 'phone' && (
      <ViewModeToggle value={viewMode} onChange={setViewMode} />
    )}

    {(viewMode === 'list' || device.type === 'phone') ? (
      <FlightBoardListView data={workPackages} />
    ) : (
      <FlightBoardGantt data={workPackages} />
    )}
  </>
);
```

**Testing**:
- [ ] Card renders 3 lines in 80–90px height
- [ ] All critical data visible (reg, times, WP, status)
- [ ] Secondary data in hint (type, flight ID, MH)
- [ ] Tap card → opens detail drawer
- [ ] Sorting works (persists to localStorage)
- [ ] No layout shift as data loads
- [ ] Touch targets ≥44px

#### 4.4 Dashboard Mobile Layout (Graphs on Top)

**File**: `src/components/dashboard/dashboard-page.tsx`

Current desktop layout:
```
┌─ KPI cards ─┬─ Combined chart ─┬─ Donut ─┐
│             │                 │         │
└─────────────┴─────────────────┴─────────┘
├─ Operator Performance table ──────────────┤
```

Mobile layout:
```
┌─ Combined chart ───────────────┐
├─ Donut chart ─────────────────┤
├─ KPI cards (stacked) ─────────┤
├─ Operator table (h-scroll) ───┤
```

Implementation:
```tsx
const device = useDeviceType();

return (
  <div className={classNames(
    'space-y-4',
    device.type === 'desktop' && 'grid grid-cols-[250px_1fr_300px] gap-4',
    device.type === 'tablet' && 'grid grid-cols-2 gap-4',
  )}>
    {/* Conditional render order */}
    {device.type === 'phone' && (
      <>
        <CombinedChart /> {/* Top */}
        <DonutChart /> {/* Below chart */}
        <KpiCards /> {/* Below donut */}
        <OperatorTable /> {/* Bottom */}
      </>
    )}

    {(device.type === 'tablet' || device.type === 'desktop') && (
      <>
        <KpiCards /> {/* Left column or full width */}
        <CombinedChart />
        <DonutChart />
        <OperatorTable />
      </>
    )}
  </div>
);
```

#### 4.5 Hide Print Button on Mobile

**File**: `src/components/layout/header.tsx` or wherever print button lives

```tsx
const device = useDeviceType();

{device.type !== 'phone' && (
  <PrintButton />
)}
```

#### 4.6 Tests

**File**: `src/__tests__/components/mobile-navigation.test.tsx`

```typescript
describe('Mobile Navigation', () => {
  it('shows bottom tab bar on phone only', () => {
    // Mock useDeviceType to return { type: 'phone' }
    // Assert BottomTabBar rendered
  });

  it('hides mode toggle and user menu on phone', () => {
    // Assert not rendered in header
  });

  it('mobile menu sheet includes Account, Admin, View Mode toggle, Logout', () => {
    // Open menu, verify items
  });
});

describe('Flight Board Mobile', () => {
  it('defaults to list view on phone', () => {
    // Verify FlightBoardListView rendered for device.type === 'phone'
  });

  it('allows Gantt view on tablet/desktop', () => {
    // Verify toggle visible only for non-phone
  });
});

describe('Dashboard Mobile Layout', () => {
  it('renders graphs on top for phone', () => {
    // Mock device.type = 'phone'
    // Verify render order: CombinedChart → Donut → KPI → Table
  });

  it('renders KPI cards on left for desktop', () => {
    // Mock device.type = 'desktop'
    // Verify 3-column grid
  });
});
```

---

## Files to Create/Modify (Updated for Phases 1–4)

### Create
1. `src/lib/hooks/use-device-type.ts`
2. `src/components/layout/device-type-hydrator.tsx`
3. `src/components/layout/mobile-menu-sheet.tsx` **(NEW — Phase 4)**
4. `src/__tests__/lib/device-type.test.ts`
5. `src/__tests__/components/responsive-components.test.tsx`
6. `src/__tests__/components/mobile-navigation.test.tsx` **(NEW — Phase 4)**

### Modify (Additional for Phase 4)
1. `src/components/flight-board/flight-board-page.tsx` — Conditional list/gantt default
2. `src/app/(authenticated)/dashboard/page.tsx` — Reorder for mobile (graphs first)
3. `src/components/layout/bottom-tab-bar.tsx` — Update to match new mobile menu structure
4. Print button components (hide on mobile)

---

## Files to Create/Modify

### Create
1. `src/lib/hooks/use-device-type.ts` — Hook + store + types
2. `src/components/layout/device-type-hydrator.tsx` — Wrapper for SSR
3. `src/__tests__/lib/device-type.test.ts` — Unit tests
4. `src/__tests__/components/responsive-components.test.tsx` — Integration tests
5. `.claude/SPECS/REQ_DeviceDetection.md` — Detailed spec (optional, if not in REQ_UI_Interactions.md)

### Modify
1. `src/components/layout/layout.tsx` — Add DeviceTypeHydrator
2. `src/components/layout/sidebar.tsx` — Conditional sheet/static
3. `src/components/shared/filter-bar.tsx` — Conditional grid
4. `src/app/(authenticated)/dashboard/page.tsx` — Conditional layout
5. `src/components/dashboard/combined-chart.tsx` — Responsive height
6. `src/components/dashboard/operator-performance.tsx` — Overflow on phone
7. `src/components/flight-board/flight-board.tsx` — Gantt/list toggle based on device
8. All admin grid components — Touch targets, overflow handling
9. `.claude/DECISIONS.md` — Add D-061 decision record

---

## Testing Strategy

### Unit Tests
- Classification logic (all 6 scenarios + fallback)
- Hook state management (store updates, listeners)

### Integration Tests
- Component renders correct variant per device type
- Resize event triggers device type update
- No hydration mismatches (SSR)

### Manual Testing Checklist
- [ ] Desktop (1920x1080): 3-column dashboard, expanded sidebar, inline FilterBar
- [ ] Tablet portrait (768x1024): 2-column KPI grid, collapsed sidebar, stacked FilterBar
- [ ] Tablet landscape (1024x768): 3-column KPI grid (if space), FilterBar 2x2
- [ ] Phone portrait (375x667): 1-column stack, sheet sidebar, sheet FilterBar
- [ ] Phone landscape (667x375): 2-column KPI grid, sheet sidebar
- [ ] Resize desktop browser to <768px → defaults to **desktop** layout (NOT phone)
- [ ] Touch target sizes ≥44px on phone/tablet
- [ ] No layout thrashing on rapid resize
- [ ] Smooth transitions on orientation change

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| SSR hydration mismatch | Use `skipHydration: true` on Zustand store; wrap detection in `<DeviceTypeHydrator>` client component |
| Missing `maxTouchPoints` in old browsers | Fallback to width-only classification (defaults to Desktop) |
| Performance: frequent resize events | Debounce resize handler (300ms) |
| Touch device false positives (laptop with touchscreen) | Accept as tradeoff; layout is still usable at >1280px |
| Layout thrashing during resize | Batch updates in Zustand; avoid re-renders outside affected components |

---

## Success Criteria

- [x] All tests pass (unit + integration + manual)
- [x] No visual regressions
- [x] `npm run build` clean
- [x] `npm run lint` clean
- [x] Device type changes are instant (no lag on resize)
- [x] Fallback behavior works (>1280px + no touch = Desktop layout)
- [x] Commit: `feat(ux): implement device detection for responsive layout (D-061)`

---

## Decision Record (D-061)

**Title**: Device Detection Strategy for Responsive Layout

**Problem**: Pixel-based CSS breakpoints don't account for:
- Tablets in landscape mode (same width as desktop)
- Desktops with touchscreen capability
- Ambiguous classifications for in-between viewport sizes

**Decision**: Replace CSS media queries with explicit runtime device detection:
- Primary: `navigator.maxTouchPoints + viewport width`
- Fallback: viewport width only (default to Desktop)
- Classified into 3 types: Phone, Tablet, Desktop

**Rationale**:
- More accurate device classification
- Explicit, testable logic (not CSS black-box)
- Touch capability drives UX decisions (tap targets, sheet vs sidebar)
- Fallback is conservative (defaults to desktop, not mobile)

**Trade-offs**:
- Adds ~2KB JS (device detection logic + Zustand store)
- Touchscreen laptops will use mobile-friendly components at desktop resolution (acceptable)
- More complex than CSS media queries, but more maintainable

---

## Next Steps for Sonnet/Opus

1. Review this plan for feasibility
2. Implement Phase 1 (hook + store + tests)
3. Implement Phase 2 (refactor components)
4. Implement Phase 3 (cleanup legacy CSS)
5. Manual testing checklist (all devices)
6. Create commit with D-061 decision record

**Handoff**: Branch `feat/device-detection`, PR against `dev`.
