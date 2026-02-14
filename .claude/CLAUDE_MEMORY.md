# CLAUDE_MEMORY.md — CVG Line Maintenance Operations Dashboard

> **Single source of truth** for persistent project memory.
> Updated at the end of every response. Never rely on chat history.
> Last updated: 2026-02-13 (session 2 — filter bar amendment)

---

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-13 | Use Next.js 15+ with App Router | SSR, API routes, TypeScript-first, industry standard |
| 2026-02-13 | Use shadcn/ui + Radix UI for components | Copy-paste model = full control, Fumadocs design alignment, 83K+ stars |
| 2026-02-13 | Use Tailwind CSS v4 | Neutral dark theme, utility-first, ecosystem alignment |
| 2026-02-13 | Use Recharts (via shadcn/ui Charts) for charts | 53 pre-built chart variants, lighter than ECharts, native shadcn integration |
| 2026-02-13 | Use SVAR React Gantt (MIT) for flight board | Only actively maintained MIT Gantt with dark theme; fallback: custom CSS grid |
| 2026-02-13 | Use Zustand for state management | Lightweight, local-first friendly, no boilerplate |
| 2026-02-13 | Use next-themes for dark/light mode | Dark default, Fumadocs-inspired neutral palette |
| 2026-02-13 | Font Awesome self-hosted (CSS/webfonts) at `public/vendor/fontawesome/` | User already downloaded; no CDN |
| 2026-02-13 | Lucide icons as supplementary | For shadcn/ui integration where FA doesn't fit |
| 2026-02-13 | File-based JSON for v0, SQLite later | Local-first, minimal complexity for MVP |
| 2026-02-13 | TanStack Table via shadcn/ui for data tables | Industry standard, accessible, sortable |
| 2026-02-13 | 10-pass iterative plan completed | FINAL-PLAN.md at `/plan/FINAL-PLAN.md` (1625 lines) |
| 2026-02-13 | Persistent memory rule established | `/.claude/CLAUDE_MEMORY.md` is single source of truth; updated every response |
| 2026-02-13 | **Global FilterBar on all data pages** | Shared filter state across Flight Board, Dashboard, Capacity; URL deep-linking |
| 2026-02-13 | **Default timezone: UTC** (Supersedes: "America/New_York") | Aviation convention; source data is UTC; eliminates DST confusion |
| 2026-02-13 | **Station locked to CVG** | Displayed but not editable; not sent in URL params or API calls |
| 2026-02-13 | **Filters use URL query params** | Deep-linking, cross-page persistence, browser back/forward support |
| 2026-02-13 | **HAR files analyzed for reference** | CargoJet's actual flight board (APEX page 92) and tasks page (page 45) extracted |

---

## Requirements & Constraints

### Hard Constraints
- **Local-first**: No cloud dependencies to run the core app
- **Font Awesome**: Self-hosted only (no CDN); already downloaded by user
- **Iterative scope**: Small increments, always runnable
- **No over-engineering**: Clarity over cleverness
- **Desktop + mobile responsive**: Desktop-first, mobile-friendly

### Functional Requirements
1. **Flight Board**: Gantt-style timeline showing aircraft arrival/departure schedules
2. **Statistics Dashboard**: KPI cards, bar charts, line charts, donut charts
3. **Capacity Modeling**: Demand vs capacity, utilization %, overtime flags
4. **Data Import**: JSON/CSV ingestion with validation, normalization, dedup
5. **Settings**: Configurable shifts, headcount, MH defaults, timezone
6. **CSV Export**: From capacity model results
7. **Global FilterBar** (Amendment 001): Start/End datetime, Station(CVG locked), Timezone, Operator, Aircraft, Type — on all data pages

### Filter Bar Requirements (Amendment 001)
- **Fields**: Start Date/Time, End Date/Time, Station (CVG, locked), Timezone (default UTC), Operator (multi-select), Aircraft (searchable multi-select), Type (multi-select)
- **Applies to**: Flight Board, Dashboard, Capacity pages (NOT Settings)
- **URL params**: `?start=ISO&end=ISO&tz=TZ&op=CSV&ac=CSV&type=CSV`
- **Defaults**: start=today, end=today+3d, tz=UTC, all operators/aircraft/types
- **Validation**: end > start (auto-swap), max 30-day range, invalid entries silently dropped
- **Mobile**: Collapsed into Sheet overlay with filter button + badge count

### Pages (4 routes)
- `/flight-board` — Gantt timeline + FilterBar (default landing)
- `/dashboard` — KPI cards + charts + FilterBar
- `/capacity` — Demand/capacity/utilization + FilterBar
- `/settings` — Configuration (NO FilterBar)

---

## Defaults & Business Rules

### Work Package MH
- Default MH when no WP: **3.0** (configurable slider: 0.5–10.0, step 0.5)
- WP MH inclusion modes: **include** | **exclude** | **manual override**
- Priority: manual override > WP MH (if include) > default MH
- Formula (effectiveMH):
  ```
  IF manualOverride != null -> manualOverride
  ELSE IF hasWP AND totalMH != null AND mode=="include" -> totalMH
  ELSE -> defaultMH (3.0)
  ```

### Capacity Model
- **Shifts**: Day (07–15, 8 heads), Swing (15–23, 6 heads), Night (23–07, 4 heads)
- **Theoretical capacity/person**: 8.0 MH
- **Real capacity/person**: 6.5 MH
- **Daily theoretical**: (8×8)+(6×8)+(4×8) = 144 MH
- **Daily real**: (8×6.5)+(6×6.5)+(4×6.5) = 117 MH
- **Utilization**: (totalDemandMH / realCapacity) × 100%
- **Color coding**: Green <80%, Blue 80–100%, Amber 100–120%, Red >120%

### Daily MH Apportionment (multi-day stays)
```
dayStart = max(arrival, startOfDay)
dayEnd = min(departure, endOfDay)
groundHoursToday = (dayEnd - dayStart) / 3600000
dailyMH = effectiveMH × (groundHoursToday / totalGroundHours)
```

### Filter Defaults
- Start Date: today 00:00 UTC
- End Date: today + 3 days
- Station: "CVG" (locked, immutable)
- Timezone: "UTC" (**Superseded**: was "America/New_York")
- Operators: [] (empty = all)
- Aircraft: [] (empty = all)
- Aircraft Types: [] (empty = all)

### Timezone Handling
- **Storage/API/URL**: Always UTC
- **Display**: Converted via `Intl.DateTimeFormat` to selected timezone
- **Available options**: UTC, America/New_York, America/Chicago, America/Los_Angeles

---

## Data Model Notes

### Source Data
- SharePoint OData export: `data/input.json`
- 86 work package records, date range Feb 7–23, 2026
- **WARNING**: `TotalGroundHours` is a STRING — must `parseFloat()`
- **WARNING**: `TotalMH` is null for 66/86 records
- `HasWorkpackage` is true for only 27/86
- `IsNotClosedOrCanceled` is a STRING "1"/"0", not boolean

### Customers (6)
| Customer | Count | Color |
|----------|-------|-------|
| CargoJet Airways | 24 | #22c55e (green) |
| Aerologic | 18 | #8b5cf6 (purple) |
| Kalitta Air | 16 | #f97316 (orange) |
| DHL Air UK | 16 | #ef4444 (red) |
| Kalitta Charters II | 8 | #06b6d4 (cyan) |
| 21 Air | 4 | #ec4899 (pink) |

### Aircraft
- 57 unique registrations
- ~~Deprecated — registration-prefix inference is no longer the primary logic.~~ Type is sourced from inbound data + admin-controlled mapping (D-015).
- Historical reference (seed data only): C-F/C-G → B767, D-AA → B777, G-DH → B767/B777, N7xx → B747/B767
- CargoJet uses fleet numbering: `NNN-RRRR` (e.g., `506-GTCJ` = C-GTCJ, fleet #506)

### Key Stats
- Avg ground hours: 16.2h
- Max ground hours: 53.2h
- Min ground hours: 1.7h
- Records with FlightId: 76/86
- Status breakdown: New(63), Approved(23)

### Key TypeScript Types
- `SharePointWorkPackage` — raw SP OData record
- `WorkPackage` — normalized domain type (dates as Date, groundHours as number)
- `HourlySnapshot` — { hour, arrivals, departures, onGround }
- `DailyDemand` / `DailyCapacity` / `DailyUtilization` — capacity model
- `AppConfig` — all configurable settings
- `GanttTask` — SVAR Gantt data shape
- `FilterState` — (NEW) global filter state with URL serialization
- `FilterQueryParams` — (NEW) URL param mapping

### Filter State Type
```typescript
interface FilterState {
  startDate: string;       // ISO 8601 UTC
  endDate: string;         // ISO 8601 UTC
  station: "CVG";          // Locked
  timezone: TimezoneOption; // Default "UTC"
  operators: CustomerName[]; // Empty = all
  aircraft: string[];      // Empty = all
  aircraftTypes: AircraftType[]; // Empty = all
}
```

---

## UI/UX Notes

### Design References (in `.claude/assets/img/`)
1. **Flight Board**: Gantt-style, aircraft on Y-axis, time on X-axis, colored bars per customer
2. **Dashboard**: Dark navy, KPI cards top-left, bar+line chart main area, donut chart right, mini Gantt bottom
3. **Graph Style**: UniFi OS — clean lines, subtle grid, hover tooltips with exact values
4. **Color Scheme**: Fumadocs neutral dark (#09090b to #18181b), subtle borders, clean typography

### FilterBar Layout (Amendment 001)
- **Row 1**: [fa-calendar] Start Date | [fa-calendar-check] End Date | [fa-location-dot] Station (CVG 🔒) | [fa-clock] Timezone
- **Row 2**: [fa-building] Operator (multi) | [fa-plane] Aircraft (searchable multi) | [fa-plane-circle-check] Type (multi) | [fa-rotate-left] Reset
- **Desktop**: 2-row horizontal layout, inline fields
- **Tablet**: 2×2 grid per row
- **Mobile**: Collapsed into Sheet with fa-filter button + badge count
- **Position**: Below header, above page content, on all data pages

### Dashboard Layout (Grid)
- **Row 1 Left**: Avg Ground Time card, Scheduled MH bar chart
- **Row 1 Center-Right**: Combined arrivals(blue)/departures(pink) bars + on-ground(yellow) line chart
- **Row 1 Far Right**: Total Aircraft count, Aircraft By Type counts
- **Row 2**: Mini Gantt strip + Aircraft By Customer donut chart

### Responsive Breakpoints
- Desktop ≥1280px: Full sidebar + all panels
- Tablet 768–1279px: Collapsed sidebar, stacked grid
- Mobile <768px: Sheet-based nav, single column

### Theme
- Dark is DEFAULT
- CSS custom properties for neutral palette
- Dashboard cards may use navy override (`--card: 232 47% 13%`)

---

## HAR File Analysis (Reference Data)

### airways.cargojet.com.har (Flight Board — APEX page 92)
- **Filter fields**: P92_STRDAT (Start Date), P92_ENDDAT (End Date), P92_ARPCOD (Airport), P92_UTCLCL (UTC/Local)
- **Gantt data**: 41 rows (aircraft), 99 tasks (flights), 2-day viewport
- **Task format**: `{id, start, end, label:"YYC 584 YHM", customTooltip, svgClassName}`
- **Tooltip**: "Flight #: 584\nTail #: 501-FKCJ\nLeg: YYC-YHM\nSch Departure(L)\nSch Arrival(L)\nStatus: SCHEDULED"
- **Statuses**: SCHEDULED, NEW-FLIGHT, ARRIVED, DEPARTED
- **Colors**: `demo-f-green` (scheduled), `demo-f-departed` (departed)

### airways.cargojet.com_search_filter.har (Tasks — APEX page 45)
- **Full navigation**: 14 menu items (Flight Display, Status, Tasks, Defects, Materials, Parts, etc.)
- **Task columns**: Scheduled, Fleet #, Task ID, WC #, Defect Description, Action Required, Station, Department, Status
- **Station always CVG** (confirms locked-station design)
- **49 open tasks** across 16 aircraft visits, all "Line Maintenance" department
- **Fleet numbering**: `NNN-RRRR` format (e.g., `506-GTCJ` = C-GTCJ)

---

## Open Questions

| # | Question | Default if Unanswered | Status |
|---|----------|----------------------|--------|
| Q1 | Which Font Awesome edition (Free or Pro)? | Assume Free | Open |
| Q2 | Aircraft registration → type mapping table? | Use inference rules | Open |
| Q3 | Show "IsNotClosedOrCanceled=0" records how? | Reduced opacity + strikethrough | Open |
| Q4 | Shifts vary by day of week? | Fixed for v0 | Open |
| Q5 | Dashboard auto-refresh? | Manual reload for v0 | Open |
| Q6 | Additional SP fields in future exports? | Ignore unknown fields | Open |
| Q7 | Data update frequency? | Weekly import for v0 | Open |
| Q8 | "Singapore" label (from reference) meaning? | Use "CargoJet Airways" consistently | Open |
| Q9 | ~~3-day default window is business requirement?~~ | ~~Configurable, default 3 days from today~~ | **Resolved** — confirmed default 3 days |
| Q10 | Node.js version available? | Assume 18+ | Open |
| Q11 | Should fleet numbers (from CargoJet system) be displayed alongside registrations? | Show registration only for v0 | Open |

---

## File References

| File | Purpose |
|------|---------|
| `/CLAUDE.md` | Project instructions for Claude Code |
| `/.claude/CLAUDE_MEMORY.md` | This file — persistent memory (single source of truth) |
| `/plan/FINAL-PLAN.md` | Complete 10-pass refined implementation plan (1625 lines) |
| `/plan/PLAN-AMENDMENT-001-FILTER-BAR.md` | FilterBar integration (NEW) |
| `/.claude/assets/input.json` | Raw SharePoint data (86 records, 318KB) |
| `/.claude/assets/img/*.png` | Design reference screenshots |
| `/.claude/airways.cargojet.com.har` | CargoJet flight board HAR (page 92) |
| `/.claude/airways.cargojet.com_search_filter.har` | CargoJet tasks/filter HAR (page 45) |

---

## Implementation Status

| Milestone | Description | Status |
|-----------|-------------|--------|
| M0 | Project Scaffold | Not started |
| M1 | Data Layer & API | Not started |
| M2 | Flight Board | Not started |
| M3 | Statistics Dashboard | Not started |
| M4 | Capacity Modeling | Not started |
| M5 | Polish & Responsiveness | Not started |
| M6 | Data Import & Settings | Not started |
| — | Amendment 001: FilterBar | Plan complete, not implemented |
