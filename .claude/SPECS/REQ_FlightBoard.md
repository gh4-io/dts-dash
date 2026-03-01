# REQ: Flight Board Page

> **What changed and why (2026-02-14):** Major UI refactor replacing FilterBar + GanttToolbar with TopMenuBar architecture. Added ActionsMenu with sort/group/highlight/columns/control-break dialogs, active filter chips, and FlightBoardFormatPanel. Aircraft type now displayed in tooltips (OI-003). Updated layout diagram to reflect current implementation.
>
> **Prior change (2026-02-13):** Updated from photo-driven UI reconciliation pass + user direction on information-dense bars. Bars now show arrival/departure times, registration, and flight ID with progressive disclosure by width. Hover tooltip shows full aircraft/schedule/WP details. Click opens a detail drawer with all linked information and navigation links. Added day-boundary separators, refresh action, toolbar placement, data freshness badge. (D-025)
>
> Route: `/flight-board` (default landing page)

## Purpose
Gantt-style timeline showing aircraft on-ground windows at CVG. Primary operational view.

## Filters
Uses TopMenuBar with filter dropdowns and active filter chips. See [REQ_Filters.md](REQ_Filters.md) for full spec and [UI_FILTER_PATTERNS.md](../UI/UI_FILTER_PATTERNS.md) for component patterns.

## Layout

### Desktop & Tablet

Current implementation with TopMenuBar architecture:

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP MENU BAR: [Filters ▾] [Actions ▾] [Format ▾]   [◐] [≡] [@User] │
├──────────────────────────────────────────────────────────────────────┤
│ Active Filters: [✕ CargoJet] [✕ B767, B777] [Clear All]             │
├──────────┬───────────────────────────────────────────────────────────┤
│          │  ┊ FRIDAY             ┊ SATURDAY            ┊ SUNDAY     │
│ AIRCRAFT │  7   11   15   19   23┊ 3   7   11   15   19┊ 3   7 ... │
│ (Y-axis) │  ┊                    ┊                     ┊            │
│ C-FOIJ   │ ┌05:38─── C-FOIJ CJT507 ──────────10:00┐               │
│          │ └▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┘               │
│ N774CK   │       ┌05:41── N774CK CJT917 ──08:00┐                   │
│          │       └▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┘                   │
│ C-FHCJ   │  ┌▓▓▓┐                                                   │
│ ...      │  ┊                    ┊                     ┊            │
├──────────┴───────────────────────────────────────────────────────────┤
│ LEGEND: ● CargoJet  ● Aerologic  ● Kalitta  ● DHL  ...              │
├──────────────────────────────────────────────────────────────────────┤
│ Data freshness: "Last import: Feb 13, 14:30 UTC"                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Layout Features
- **TopMenuBar**: Single-row menu with Filter/Actions/Format dropdowns + theme toggle + mobile nav + user menu
- **Active Filter Chips**: Dismissible pills showing active filters with X to remove (only shown when filters applied)
- **Information-dense bars**: Each bar shows as much data as fits — registration, arrival/departure times, flight ID
- **Day labels across top**: Day names (FRIDAY, SATURDAY, etc.) span the timeline above hour marks
- **Day-boundary separators**: Dashed vertical lines at midnight between days
- **Format Panel**: Popover with zoom controls (6h/12h/1d/3d/1w presets, +/-/Now/Reset buttons) and expanded mode toggle
- **Actions Menu**: Dropdown with Sort, Group By, Highlight, Columns, Control Break dialogs
- **Legend below Gantt**: Horizontal row of colored dots with customer labels
- **Data freshness badge**: Bottom of the page, shows last import timestamp
- **Hover**: Rich tooltip with full aircraft/schedule/work package details including aircraft type
- **Click**: Opens detail panel with all linked information

## Gantt Specifications

- **Library**: Apache ECharts via `echarts-for-react` (D-008)
- **Renderer**: Canvas (default) — smooth, performant, dark-theme-friendly
- **Approach**: Custom series with `renderItem` — based on ECharts' official `custom-gantt-flight` example
- **Y-axis**: Category axis — aircraft registrations, sorted by earliest arrival
- **X-axis**: Time axis — viewport determined by filter start/end dates
- **Bars**: Colored by customer via `renderItem` with inline `itemStyle.color`
- **Bar width**: Proportional to ground time duration
- **Scales**: Auto-formatted by ECharts time axis (day labels + hour marks)
- **SSR**: Must use `dynamic(() => import(...), { ssr: false })` — ECharts requires `window`

## ECharts Configuration Pattern

```typescript
// Conceptual option structure (adapted from custom-gantt-flight example)
const option: EChartsOption = {
  tooltip: {
    formatter: (params) => customHTMLTooltip(params.data)
  },
  grid: { /* main chart area */ },
  xAxis: { type: 'time', /* start/end from filters */ },
  yAxis: { type: 'category', data: registrations, inverse: true },
  dataZoom: [
    { type: 'slider', xAxisIndex: 0 },     // horizontal scroll bar
    { type: 'inside', xAxisIndex: 0 },      // drag-to-pan + scroll-to-zoom
  ],
  series: [{
    type: 'custom',
    renderItem: renderFlightBar,            // custom bar renderer
    encode: { x: [1, 2], y: 0 },           // arrival→departure on X, registration on Y
    data: flightData                        // [regIndex, arrivalTs, departureTs, ...metadata]
  }]
};
```

## Zoom Levels

Achieved via `dataZoom` — user scrolls/drags to zoom continuously. Toolbar buttons set preset ranges:

| Level | Visible Range | Granularity |
|-------|--------------|-------------|
| 6h | 6 hours | 30-min marks |
| 12h | 12 hours | 1-hour marks |
| 1d | 24 hours | 3-hour marks |
| 3d (default) | 72 hours | 3-hour marks |
| 1w | 7 days | 6-hour marks |

Toolbar buttons call `dataZoom.setOption()` with calculated `start`/`end` percentages.

## Tooltip (on hover)

Rich tooltip appears on hover with detailed aircraft, schedule, and work package info. ECharts `tooltip.formatter` returns an HTML string. Styled with dark background, white text, consistent with app theme.

### Tooltip Layout

```
┌─────────────────────────────────────┐
│ C-FOIJ                    CargoJet  │  ← Registration + Customer (bold, colored dot)
│ B767                                │  ← Aircraft Type (OI-003)
│─────────────────────────────────────│
│ Flight:    CJT507                   │
│ Arrival:   Feb 7, 05:38 UTC         │
│ Departure: Feb 9, 10:00 UTC         │
│ Ground:    52h 22m                   │
│─────────────────────────────────────│
│ Status:    New                       │
│ WP #:      —                         │  ← or actual WP number if present
│ Man-Hours: 3.0 MH (default)         │
│─────────────────────────────────────│
│ "Please date for the 7th."          │  ← Calendar comments (if present)
│─────────────────────────────────────│
│ Click for full details →            │  ← hint to user
└─────────────────────────────────────┘
```

### Tooltip Fields

| Section | Field | Source | Format | Example |
|---------|-------|--------|--------|---------|
| Header | Registration | `aircraftReg` | Bold, large | C-FOIJ |
| Header | Customer | `customer` | With color dot | CargoJet Airways |
| Header | Aircraft Type | `aircraftType` | Below registration | B767 |
| Schedule | Flight ID | `flightId` | — | CJT507 |
| Schedule | Arrival | `arrival` | Formatted in selected TZ | Feb 7, 05:38 UTC |
| Schedule | Departure | `departure` | Formatted in selected TZ | Feb 9, 10:00 UTC |
| Schedule | Ground Time | computed | HH:MM or Xh Ym | 52h 22m |
| Work Package | Status | `status` | — | New / Approved |
| Work Package | WP Number | `workpackageNo` | — or "—" if null | MS28782-14 |
| Work Package | Man-Hours | `effectiveMH` + source | Value + source label | 3.0 MH (default) |
| Notes | Comments | `calendarComments` | HTML stripped to text, truncated 100ch | "Please date for the 7th." |
| Footer | Click hint | static | Subtle gray text | "Click for full details →" |

### Tooltip Styling
- Background: `--popover` token (dark)
- Text: `--popover-foreground` (white/light)
- Max width: 320px
- Customer color dot: 8px circle matching customer color
- Section dividers: 1px border in `--border` color
- Comments section: italic, slightly smaller font
- Click hint: muted foreground color, 11px

## renderItem Function (Conceptual)

```typescript
function renderFlightBar(params, api) {
  const regIndex = api.value(0);
  const arrival = api.coord([api.value(1), regIndex]);
  const departure = api.coord([api.value(2), regIndex]);
  const barWidth = departure[0] - arrival[0];
  const barHeight = api.size([0, 1])[1] * 0.6;
  const customerColor = colorMap[api.value(3)]; // from useCustomers()
  const registration = api.value(4);
  const flightId = api.value(5);
  const arrivalTime = formatTime(api.value(1)); // HH:MM in selected TZ
  const departureTime = formatTime(api.value(2));

  const rect = clipRectByRect(
    { x: arrival[0], y: arrival[1] - barHeight / 2, width: barWidth, height: barHeight },
    { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height }
  );

  if (!rect) return;

  const children = [
    // Background rectangle
    { type: 'rect', shape: rect, style: { fill: customerColor, stroke: '#000', lineWidth: 0.5 } }
  ];

  const centerY = rect.y + barHeight / 2;

  if (barWidth > 150) {
    // WIDE: arrival + registration · flightId + departure
    const centerLabel = flightId ? `${registration}  ·  ${flightId}` : registration;
    children.push(
      { type: 'text', style: { text: arrivalTime, x: rect.x + 4, y: centerY, fill: 'rgba(255,255,255,0.85)', fontSize: 9, verticalAlign: 'middle' } },
      { type: 'text', style: { text: centerLabel, x: rect.x + barWidth / 2, y: centerY, fill: '#fff', fontSize: 10, fontWeight: 'bold', align: 'center', verticalAlign: 'middle' } },
      { type: 'text', style: { text: departureTime, x: rect.x + barWidth - 4, y: centerY, fill: 'rgba(255,255,255,0.85)', fontSize: 9, align: 'right', verticalAlign: 'middle' } }
    );
  } else if (barWidth > 100) {
    // MEDIUM: registration + flightId
    const label = flightId ? `${registration} · ${flightId}` : registration;
    children.push(
      { type: 'text', style: { text: label, x: rect.x + barWidth / 2, y: centerY, fill: '#fff', fontSize: 10, fontWeight: 'bold', align: 'center', verticalAlign: 'middle' } }
    );
  } else if (barWidth > 50) {
    // NARROW: registration only
    children.push(
      { type: 'text', style: { text: registration, x: rect.x + barWidth / 2, y: centerY, fill: '#fff', fontSize: 9, align: 'center', verticalAlign: 'middle', overflow: 'truncate', width: barWidth - 8 } }
    );
  }
  // VERY NARROW (<50px): no text, tooltip only

  return { type: 'group', children };
}
```

## Format Panel (Popover from TopMenuBar)
- Zoom preset buttons: 6h / 12h / 1d / 3d / 1w
- Zoom controls: Zoom In (+) / Zoom Out (-) / Now / Reset
- Expanded mode toggle: Full-width chart when enabled
- Refresh button: `fa-solid fa-arrows-rotate` — re-fetches data from API (window.location.reload)
- Programmatic zoom API: Chart exposes `dispatchZoom(start, end)` and `getZoomRange()` methods via ref
- Note: Date range and entity filters in FilterDropdown (per D-024)

## Day Labels and Separators
- **Day labels**: Rendered above the time axis showing day names (FRIDAY, SATURDAY, SUNDAY, etc.)
- **Midnight separators**: Dashed vertical lines at 00:00 boundaries between days — confirmed by CVG dashboard reference (images 3/4)
- Implementation: ECharts `markLine` or custom `renderItem` group for separators; day labels via secondary axis or annotation

## Bar Content (Information-Dense)

Bars display as much information as the available width allows. Content is rendered via ECharts `renderItem` as a group of text elements on the colored rectangle.

### Bar Layout (Wide — >150px rendered width)

```
┌──────────────────────────────────────────────────────┐
│ 05:38   C-FOIJ  ·  CJT507                    10:00  │
└──────────────────────────────────────────────────────┘
```

| Position | Content | Font | Alignment |
|----------|---------|------|-----------|
| Left edge (inside, padded 4px) | Arrival time (HH:MM in selected TZ) | 9px, white, regular | Left |
| Center | Registration + Flight ID (separated by ` · `) | 10px, white, bold | Center |
| Right edge (inside, padded 4px) | Departure time (HH:MM in selected TZ) | 9px, white, regular | Right |

### Progressive Disclosure by Bar Width

| Bar Width (px) | Content Shown |
|----------------|---------------|
| **>150px** (wide) | Arrival time + Registration + Flight ID + Departure time |
| **100–150px** (medium) | Registration + Flight ID (centered) |
| **50–100px** (narrow) | Registration only (centered, truncated) |
| **<50px** (very narrow) | No text — tooltip on hover only |

### Text Styling
- All text: white (`#ffffff`) on customer-colored background
- Registration: bold, 10px
- Times: regular weight, 9px, slightly translucent (`rgba(255,255,255,0.85)`)
- Flight ID: regular weight, 9px
- If `flightId` is null/empty, omit (show registration only in center)
- Vertical centering within bar height

## Legend (below Gantt)

### Desktop & Tablet
- ECharts built-in legend component or custom horizontal row of colored dots with customer labels
- Customer colors from `useCustomers()` store (D-010) — not hardcoded
- Helps users identify color-coded bars in Gantt

### Phone (List View)
- **Hidden** — not needed since each card shows operator color dot inline
- Color coding is clear from the card itself (color dot + operator name)
- Saves vertical space on small screens

## Click-to-Detail (Bar Click)

Clicking a bar opens a **detail drawer** (shadcn/ui Sheet, slides in from right) showing full information about that work package with navigation links to related data.

### Detail Drawer Layout

```
┌─────────────────────────────────────────┐
│ Work Package Detail              [✕]    │
│─────────────────────────────────────────│
│                                          │
│ AIRCRAFT                                 │
│ ┌───────────────────────────────────────┐│
│ │ Registration:  C-FOIJ                 ││
│ │ Customer:      CargoJet Airways  ●    ││
│ │ Type:          B767 (inferred)        ││
│ │ → View all C-FOIJ work packages       ││ ← link: filters to this aircraft
│ └───────────────────────────────────────┘│
│                                          │
│ SCHEDULE                                 │
│ ┌───────────────────────────────────────┐│
│ │ Flight ID:     CJT507                 ││ ← link if available
│ │ Arrival:       Feb 7, 2026 05:38 UTC  ││
│ │ Departure:     Feb 9, 2026 10:00 UTC  ││
│ │ Ground Time:   52h 22m                ││
│ │ Status:        New                    ││
│ └───────────────────────────────────────┘│
│                                          │
│ WORK PACKAGE                             │
│ ┌───────────────────────────────────────┐│
│ │ WP Number:     —                      ││
│ │ Has WP:        No                     ││
│ │ Man-Hours:     3.0 MH (default)       ││
│ │ MH Source:     Default (TotalMH null) ││
│ │ WP Assets:     [Open in SharePoint →] ││ ← external link to WP assets URL
│ └───────────────────────────────────────┘│
│                                          │
│ NOTES                                    │
│ ┌───────────────────────────────────────┐│
│ │ "Please date for the 7th."            ││
│ └───────────────────────────────────────┘│
│                                          │
│ LINKED INFORMATION                       │
│ ┌───────────────────────────────────────┐│
│ │ → All CJT507 flights (filter by ID)  ││
│ │ → All C-FOIJ visits (filter by reg)  ││
│ │ → All CargoJet WPs (filter by oper)  ││
│ │ → Open WP assets folder              ││ ← external link
│ └───────────────────────────────────────┘│
│                                          │
│ ┌───────────────────────────────────────┐│
│ │ ID: 9181  Created: Feb 5, 14:17 UTC  ││ ← metadata footer
│ └───────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Detail Drawer Fields

| Section | Field | Source | Notes |
|---------|-------|--------|-------|
| Aircraft | Registration | `aircraftReg` | Bold, large |
| Aircraft | Customer | `customer` | With color dot |
| Aircraft | Type | `inferredType` | With "(inferred)" label if from mapping table |
| Schedule | Flight ID | `flightId` | Link: filters Gantt to all WPs with this flight ID |
| Schedule | Arrival | `arrival` | Formatted in selected timezone |
| Schedule | Departure | `departure` | Formatted in selected timezone |
| Schedule | Ground Time | computed | HH:MM format |
| Schedule | Status | `status` | Badge styling |
| Work Package | WP Number | `workpackageNo` | "—" if null |
| Work Package | Has WP | `hasWorkpackage` | Yes/No badge |
| Work Package | Man-Hours | `effectiveMH` | With source explanation |
| Work Package | MH Source | computed | "Override" / "WP MH" / "Default (TotalMH null)" |
| Work Package | WP Assets | `workpackageAssets.Url` | External link (opens in new tab) |
| Notes | Comments | `calendarComments` | HTML rendered, full text (not truncated) |
| Links | All flights for this Flight ID | — | Navigates to `/flight-board?flightId=CJT507` or filters |
| Links | All visits for this registration | — | Navigates to `/flight-board?ac=C-FOIJ` |
| Links | All WPs for this customer | — | Navigates to `/flight-board?op=CargoJet+Airways` |
| Links | WP assets folder | `workpackageAssets.Url` | External link |
| Metadata | Record ID | `id` | Small, muted text |
| Metadata | Created | `created` | Formatted date |

### Behavior
- **Open**: ECharts `click` event handler → sets selected WP ID in state → Sheet opens
- **Close**: X button, Escape key, or click outside
- **Links**: "View all X" links apply the relevant filter to the global FilterBar and close the drawer
- **External links**: Open in new tab (`target="_blank"`, `rel="noopener"`)
- **Keyboard**: Escape closes, Tab navigates through links

## Data Flow
```
FilterBar → useFilters() → fetch /api/work-packages?start=&end=&op=&ac=&type=
         → useWorkPackages() → toEChartsData() → ECharts custom series
                                                   ↓ (bar click)
                                            FlightDetailDrawer opens
                                                   ↓ (link click)
                                            FilterBar updated → Gantt re-renders
```

## Mobile Layout (Phone Only) — D-062

### Default View: List

**Why list instead of Gantt?**
- Canvas-based ECharts Gantt doesn't scale well to <400px viewport
- Touch interactions (drag-to-pan, pinch-to-zoom) are complex and unreliable on small screens
- List view is naturally responsive and mobile-friendly
- Users can still tap to expand full detail drawer with all information

### List View Specifications (Compact Mobile Design)

#### Minimum Layout (Compact Card)

```
┌─────────────────────────────────────────────┐
│ C-FOIJ ● CargoJet                     [New] │  ← reg + color dot + operator + status badge
│ 05:38 → 10:00 UTC (4h 22m)        WP: ✓    │  ← arrival → departure (ground) + WP indicator
│ [Tap for B767, CJT507, 3.0 MH]              │  ← hint: secondary info available
└─────────────────────────────────────────────┘
```

**Card dimensions**:
- Height: 80–90px (3 lines + padding)
- Width: Full width (minus padding)
- Padding: 12px (touch-safe vertical hit area)

#### Card Structure

**Line 1 (Header)**:
```
C-FOIJ ● CargoJet                          [New]
^reg   ^dot ^operator name         ^status badge
```

| Element | Details | Priority |
|---------|---------|----------|
| Registration | Bold, 16px | 🔴 CRITICAL |
| Operator dot | Color from `useCustomers()` | 🔴 CRITICAL |
| Operator name | Customer name, 14px gray | 🔴 CRITICAL |
| Status badge | "New", "Approved", etc. — right-aligned pill | 🔴 CRITICAL |

**Line 2 (Schedule & WP)**:
```
05:38 → 10:00 UTC (4h 22m)        WP: ✓
^arrival ^departure ^ground       ^WP indicator
```

| Element | Details | Priority |
|---------|---------|----------|
| Arrival | Formatted in selected TZ, 14px | 🔴 CRITICAL |
| Arrow | Visual separator | — |
| Departure | Formatted in selected TZ, 14px | 🔴 CRITICAL |
| Ground duration | Computed (4h 22m), 12px gray | 🟡 HIGH |
| WP indicator | "✓" (has WP) or "—" (no WP), right-aligned | 🔴 CRITICAL |

**Line 3 (Secondary Info Hint)**:
```
[Tap for B767, CJT507, 3.0 MH]
         ^aircraft type ^flight ID ^MH
```

| Element | Details | Priority |
|---------|---------|----------|
| Hint text | "Tap for [type, flight ID, MH]", 12px italic gray | 🟢 LOW |
| Aircraft type | Shown in hint (e.g., "B767") | 🟢 LOW |
| Flight ID | Shown in hint (e.g., "CJT507") | 🟢 LOW |
| Man-hours | Shown in hint (e.g., "3.0 MH") | 🟢 LOW |

#### Visual Design

**Colors & Spacing**:
- Background: `bg-card` (slightly elevated from background)
- Border: `border-b` (separator line)
- Operator dot: Customer color (5–6px circle, left of name)
- Status badge: Accent background, contrasting text
- Tap hint: `text-muted-foreground text-xs italic`
- Hover: `bg-accent/10` (subtle highlight on mouse, full tap area on touch)

**Typography**:
- Line 1: Registration `font-bold text-base`, Operator `text-sm text-muted`, Badge `text-xs`
- Line 2: Times `text-sm`, Ground `text-xs text-muted`, WP `text-sm`
- Line 3: Hint `text-xs italic text-muted-foreground`

#### Card Example (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  C-FOIJ ● CargoJet Airways                              New   │
│                                                               │
│  05:38 → 10:00 UTC (4h 22m)                         WP: ✓    │
│                                                               │
│  Tap for B767, CJT507, 3.0 MH                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Compact HTML/Tailwind Structure

```tsx
<div className="border-b p-3 hover:bg-accent/10 cursor-pointer transition-colors">
  {/* Line 1: Registration + Operator + Status */}
  <div className="flex items-center justify-between mb-1">
    <div className="flex items-center gap-2">
      <span className="font-bold text-base">C-FOIJ</span>
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: customerColor }} />
      <span className="text-sm text-muted-foreground">CargoJet Airways</span>
    </div>
    <Badge variant="outline" className="text-xs">New</Badge>
  </div>

  {/* Line 2: Schedule + WP */}
  <div className="flex items-center justify-between mb-1">
    <span className="text-sm">
      05:38 → 10:00 UTC <span className="text-xs text-muted-foreground">(4h 22m)</span>
    </span>
    <span className="text-sm">WP: ✓</span>
  </div>

  {/* Line 3: Secondary Info Hint */}
  <div className="text-xs italic text-muted-foreground">
    Tap for B767, CJT507, 3.0 MH
  </div>
</div>
```

### Interaction

- **Tap card**: Opens FlightDetailDrawer (full work package details)
- **Detail drawer**: Shows all info including aircraft type, flight ID, MH, comments, links
- **Swipe**: Scroll up/down through list
- **Sorting**: Click column header to sort (Arrival, Departure, Ground, Status)

### Responsive Behavior

- **Phone portrait** (375px): Full-width cards, single column
- **Phone landscape** (667px): May show 2 cards side-by-side (optional)
- **Tablet+** (768px+): Switch to Gantt view (list view available via toggle)

### Sorting

- Cards sorted by arrival time (earliest first)
- Click column header (if visible) to sort by: Arrival, Departure, Ground Duration, MH
- Sort state persists to localStorage (per device, not synced to DB — D-056)

### View Mode Toggle

- **Not shown on phone by default** (list is hardcoded default)
- **Optional**: If user wants Gantt on phone, a "View Mode" toggle in the mobile Menu sheet can enable it
  - Located in: Menu (bottom tab) → "View Mode" → Gantt (advanced users only)
  - Persists to localStorage per device

### Responsive Behavior

- **Phone portrait** (<600px): Full-width cards, 1-column stack
- **Phone landscape** (600px–767px): 2-column grid (optional; list may be more practical)
- **Tablet landscape**: Gantt view available again (>768px, see Desktop & Tablet section above)

---

## Components
| Component | File | Purpose |
|-----------|------|---------|
| `FlightBoardChart` | `src/components/flight-board/flight-board-chart.tsx` | ECharts wrapper (dynamic import, ssr: false) with zoom API |
| `FlightBoardFormatPanel` | `src/components/flight-board/flight-board-format-panel.tsx` | Popover with zoom controls and expanded mode toggle |
| `FlightTooltip` | `src/components/flight-board/flight-tooltip.ts` | HTML tooltip formatter function with aircraft type |
| `FlightDetailDrawer` | `src/components/flight-board/flight-detail-drawer.tsx` | Click-to-detail Sheet with all WP info + links |
| `TopMenuBar` | `src/components/shared/top-menu-bar.tsx` | Single-row menu with Filter/Actions/Format dropdowns |
| `FilterDropdown` | `src/components/shared/filter-dropdown.tsx` | Filter controls in dropdown panel |
| `ActionsMenu` | `src/components/shared/actions-menu.tsx` | Dropdown with Sort/Group/Highlight/Columns/Break dialogs |
| `FormatDropdown` | `src/components/shared/format-dropdown.tsx` | Zoom controls and display options |
| `ActiveChips` | `src/components/shared/active-chips.tsx` | Dismissible filter pills below TopMenuBar |

## Next.js Integration Notes
- Add `transpilePackages: ['echarts', 'zrender']` to `next.config.js`
- Use tree-shaken imports via `echarts/core` to reduce bundle (~120-150 KB gz vs ~330 KB full)
- ECharts built-in `'dark'` theme aligns with app dark mode; switch theme on `next-themes` change
- ECharts and Recharts coexist without conflict (independent renderers)

## Performance Expectations
- Render 57 aircraft rows × 86 work packages without stutter
- Canvas renderer handles high point counts efficiently (confirmed by ECharts architecture)
- `dataZoom` provides smooth pan/zoom without re-rendering the entire chart
- Dynamic import (`ssr: false`) prevents server-side rendering issues
- Lazy rendering: ECharts only renders visible bars in the viewport; off-screen bars are culled

## Reference
- ECharts flight Gantt example: https://echarts.apache.org/examples/en/editor.html?c=custom-gantt-flight
- CargoJet flight board screenshot: `.claude/assets/img/airways.cargojet.com_ords_f_p=1122_92_*.png`
- CVG Line Maintenance dashboard Gantt: `.claude/assets/img/Screenshot 2026-02-13 16060*.png`
- [UI_REFERENCE_MAP.md](../UI/UI_REFERENCE_MAP.md) — images 1, 3, 4
- CargoJet HAR analysis: [REQ_DataSources.md](REQ_DataSources.md) → HAR section
- CargoJet uses Oracle JET `ojGantt` v14.0.0 — our ECharts approach recreates the same visual pattern
