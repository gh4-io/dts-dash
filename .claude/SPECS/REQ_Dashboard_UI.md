# REQ: Dashboard UI Specification

> **What changed and why (2026-02-13):** Created from photo-driven UI reconciliation pass. Layout derived from the actual CVG Line Maintenance dashboard screenshots (160608.png, 160647.png). Style goals informed by network dashboard reference (160730.png).
> Route: `/dashboard`

---

## Visual Style Goals

Based on reference images:

- **Dark theme default**: Navy/black background (#0a0a1a–#0f0f23 range). KPI cards on slightly lighter blue-tinted surfaces.
- **Crisp typography**: Large bold numbers for KPIs (32–48px), smaller labels (12–14px). High contrast white text on dark surfaces.
- **Dense but readable**: Maximize data per viewport. No excessive whitespace between sections.
- **Vivid customer colors**: Bright, saturated customer colors pop against dark backgrounds.
- **Interactive**: Tooltips on hover, cross-filtering on operator click (D-021).
- **Professional**: Clean borders, consistent spacing, no decorative elements.

---

## Page Layout

Derived from CVG Line Maintenance dashboard screenshots:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FILTER BAR (7 fields — see REQ_Filters.md)                              │
├─────────────────────────────────────────────────────────────────────────┤
│ HEADER: "Dashboard" title + Date badge + Data freshness indicator       │
├──────────────┬──────────────────────────────────┬───────────────────────┤
│  KPI CARDS   │  COMBINED BAR + LINE CHART        │  DONUT CHART          │
│  (stacked)   │  (Arrivals / Departures /         │  "Aircraft By         │
│              │   On Ground)                       │   Customer"           │
│ ┌──────────┐ │                                   │   ┌─────────────┐     │
│ │ Avg      │ │   35 ┤                             │   │   ◕ Donut   │     │
│ │ Ground   │ │   30 ┤          ___                │   │    with %   │     │
│ │ Time     │ │   25 ┤         /   \               │   │   labels    │     │
│ │<24h/>24h │ │   20 ┤   __/       \__             │   └─────────────┘     │
│ ├──────────┤ │   15 ┤  /                          │                       │
│ │ Sched    │ │   10 ┤ /     ■ ■                   │                       │
│ │ Man-Hrs  │ │    5 ┤■   ■                        │                       │
│ │ by Oper  │ │    0 ┼──┬──┬──┬──┬──┬──┬──┬──┬──  │                       │
│ │ (h-bars) │ │      7AM  3PM  11PM 7AM  3PM      │                       │
│ ├──────────┤ │      FRI     SAT     SUN           │                       │
│ │ Total    │ │  Legend: ■ Arrivals ■ Departures   │                       │
│ │ Aircraft │ │         ── On Ground               │                       │
│ │  (big #) │ │                                    │                       │
│ ├──────────┤ │                                    │                       │
│ │ Aircraft │ │                                    │                       │
│ │ By Type  │ │                                    │                       │
│ │ B777-13  │ │                                    │                       │
│ │ B767-22  │ │                                    │                       │
│ └──────────┘ │                                    │                       │
├──────────────┴──────────────────────────────────┴───────────────────────┤
│ OPERATOR PERFORMANCE TABLE (filterable, click-to-focus — D-021)         │
│ ┌─────────────┬──────────┬──────────┬───────────┬──────────┐            │
│ │ Operator    │ Aircraft │ Avg Gnd  │ Total MH  │ WP Count │            │
│ │ CargoJet ●  │    22    │  28:15   │   66.0    │    22    │            │
│ │ Aerologic ● │    11    │  14:30   │   33.0    │    11    │            │
│ │ ...         │          │          │           │          │            │
│ └─────────────┴──────────┴──────────┴───────────┴──────────┘            │
├─────────────────────────────────────────────────────────────────────────┤
│ DATA FRESHNESS: "Last import: Feb 13, 2026 14:30 UTC" badge            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layout Grid (CSS)

| Section | Desktop (xl) | Tablet (md) | Mobile (sm) |
|---------|-------------|-------------|-------------|
| KPI cards | Left column, ~250px fixed | Full width, 2-column grid | Full width, stacked |
| Combined chart | Center, flex-grow | Full width below KPIs | Full width, reduced height |
| Donut chart | Right, ~300px fixed | Beside combined chart | Full width, 200px height |
| Operator Performance | Full width below charts | Full width | Full width, horizontal scroll |

---

## KPI Cards

Derived from the CVG dashboard reference images. Four cards stacked vertically in the left column.

### Card 1: Average Ground Time
| Field | Value |
|-------|-------|
| Title | "Average Ground Time" |
| Layout | Split: "< 24 Hrs" (left) / "> 24 Hrs" (right) |
| Format | HH:MM (e.g., "5:31" / "89:33") |
| Source | Computed from `arrival`/`departure` across filtered WPs |
| Icon | `fa-solid fa-clock` |

### Card 2: Scheduled Man-Hours by Operator
| Field | Value |
|-------|-------|
| Title | "Scheduled Man Hours" |
| Layout | Horizontal bar chart, one bar per customer |
| Colors | Customer colors from `useCustomers()` store |
| Sort | By total MH descending |
| Source | Sum of `effectiveMH` grouped by customer |
| Click behavior | Click operator name → cross-filter dashboard to that operator |

### Card 3: Total Aircraft
| Field | Value |
|-------|-------|
| Title | "Total Aircraft" + date range subtitle |
| Layout | Single large number (48px+ font) |
| Source | Count of unique `aircraftReg` in filtered WPs |
| Icon | `fa-solid fa-plane` |

### Card 4: Aircraft By Type
| Field | Value |
|-------|-------|
| Title | "Total Aircraft By Type" |
| Layout | Type name + count per line (e.g., "B777 - 13") |
| Source | Count of unique registrations grouped by `inferredType` |
| Fallback | Types with 0 aircraft still shown (e.g., "B747 - 0") |

---

## Combined Bar + Line Chart (Center)

The primary chart. Derived directly from the CVG dashboard reference.

| Property | Value |
|----------|-------|
| Library | Recharts `ComposedChart` |
| X-axis | Time, hourly granularity |
| Day labels | Across top of chart (FRIDAY, SATURDAY, etc.) with dashed vertical midnight separators |
| Bar series 1 | Arrivals per hour (blue bars) |
| Bar series 2 | Departures per hour (pink/red bars) |
| Line series | "On Ground" count per hour (yellow/amber line, smooth curve) |
| Legend | Below chart: "Arrivals | Departures | On Ground" |
| Tooltip | On hover: show hour, arrival count, departure count, on-ground count |
| Responsive | Reduces height on mobile; maintains readability |

---

## Donut Chart (Top Right)

| Property | Value |
|----------|-------|
| Library | Recharts `PieChart` with `innerRadius` |
| Title | "Aircraft By Customer" |
| Segments | One per customer, colored by customer colors |
| Labels | Customer name + percentage (positioned outside or inside depending on segment size) |
| Tooltip | On hover: customer name, aircraft count, percentage |
| Click behavior | Click segment → cross-filter dashboard to that customer |

---

## Operator Performance Table

Ships with M3 (D-021, OI-015). Filterable and reactive.

### Columns (available-data KPIs only — see OI-019)

| Column | Source | Format |
|--------|--------|--------|
| Operator | `customer` | Name + color dot |
| Aircraft | Count unique `aircraftReg` per operator | Number |
| Avg Ground Time | Avg of `groundHours` per operator | HH:MM |
| Total MH | Sum of `effectiveMH` per operator | Number (1 decimal) |
| WP Count | Count of work packages per operator | Number |
| Share % | Percentage of total WPs | Percentage |

### Behavior
- **Click-to-focus**: Clicking an operator name cross-filters the entire dashboard to that operator. All charts, KPI cards, and the donut update to reflect only that operator's data. Click again (or click "Clear") to reset.
- **Sortable**: Click column headers to sort ascending/descending.
- **Filterable**: Respects global FilterBar selections.
- **Color dots**: Each operator row shows the customer color dot from `useCustomers()`.

### Future KPIs (retained for data enrichment — OI-019)
These cannot be computed from current input.json data but are documented for when richer data is available:
- On-Time Departure Rate `[Future: requires scheduled vs actual departure]`
- Turnaround Efficiency `[Future: requires benchmark data]`
- MH Accuracy `[Future: requires actual MH data — currently 66/86 null]`

---

## Data Freshness Indicator

| Property | Value |
|----------|-------|
| Location | Dashboard header, right side |
| Format | "Last import: {date} {time} UTC" |
| Source | Most recent entry in `import_log` table |
| Stale threshold | >24h since last import → amber warning badge |
| Critical threshold | >72h → red warning badge |
| Icon | `fa-solid fa-clock-rotate-left` |

---

## Chart Interaction Patterns

### Cross-Filtering (D-021)
- Click operator name in Performance table → filter all charts to that operator
- Click donut segment → same behavior
- Click MH bar in KPI card → same behavior
- Visual indicator: selected operator gets a highlight ring/border; others dim to 30% opacity
- "Clear filter" button appears when an operator is focused
- Cross-filter is local to the dashboard page — does NOT update the global FilterBar URL params

### Tooltips
- All charts show tooltips on hover
- Tooltip style: dark background (#1a1a2e), white text, rounded corners, subtle shadow
- Show relevant data fields per chart type (see chart sections above)
- Tooltips follow cursor, dismiss on mouse-out

### Responsive
- Charts resize fluidly with container
- Below `md` breakpoint: charts stack vertically, KPI cards become a 2-column grid
- Below `sm` breakpoint: everything stacks single-column
- Chart minimum heights: combined chart 300px, donut 200px

---

## Performance Expectations

- Initial render with skeleton: <100ms
- Data fetch + chart render: <500ms for 86 records
- Cross-filter response: <100ms (client-side only, no API call)
- Smooth chart animations on data change (300ms transition)
- No visible stutter during zoom/pan on combined chart

---

## Files

| File | Purpose |
|------|---------|
| `src/app/dashboard/page.tsx` | Dashboard page |
| `src/components/dashboard/kpi-card.tsx` | Reusable KPI card component |
| `src/components/dashboard/avg-ground-time-card.tsx` | Average ground time card (split layout) |
| `src/components/dashboard/mh-by-operator-card.tsx` | Scheduled MH horizontal bars |
| `src/components/dashboard/total-aircraft-card.tsx` | Total aircraft big number |
| `src/components/dashboard/aircraft-by-type-card.tsx` | Type breakdown |
| `src/components/dashboard/combined-chart.tsx` | Bar+line chart (Recharts ComposedChart) |
| `src/components/dashboard/customer-donut.tsx` | Aircraft by Customer donut |
| `src/components/dashboard/operator-performance.tsx` | Performance table with click-to-focus |
| `src/components/dashboard/data-freshness.tsx` | Freshness badge |

---

## References

- CVG Line Maintenance dashboard: `.claude/assets/img/Screenshot 2026-02-13 16060*.png`
- Network dashboard (style reference): `.claude/assets/img/Screenshot 2026-02-13 160730.png`
- [UI_REFERENCE_MAP.md](../UI/UI_REFERENCE_MAP.md) — full image analysis
- [REQ_Analytics.md](REQ_Analytics.md) — KPI definitions and formulas
