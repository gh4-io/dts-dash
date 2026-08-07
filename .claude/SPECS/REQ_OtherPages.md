# REQ: Other Pages (Dashboard, Capacity, Settings)

## Statistics Dashboard (`/dashboard`)

### Filters
Uses the global FilterBar. See [REQ_Filters.md](REQ_Filters.md).

### Layout
```
┌───────────────┬──────────────┬──────────────────────────────┐
│ Avg Ground    │ Total Acft   │                              │
│ Time          │ Count        │  COMBINED BAR+LINE CHART     │
│ <24h │ >24h   │              │  Arrivals(blue) + Deps(pink) │
│ 7:10 │ 55:32  │    69        │  + OnGround(yellow line)     │
├───────┴──────┤──────────────┤                              │
│ Scheduled MH │ Acft By Type │                              │
│ [bar chart]  │ B777: 13     │  X: hourly over 3 days       │
│              │ B767: 22     │                              │
├──────────────┴──────────────┴────────────────┬─────────────┤
│          MINI GANTT TIMELINE                 │   DONUT     │
│                                              │ Acft By     │
│                                              │ Customer    │
└──────────────────────────────────────────────┴─────────────┘
```

### KPI Cards
| KPI | Formula |
|-----|---------|
| Avg Ground Time (<24h) | `mean(groundHours where groundHours < 24)` → formatted H:MM |
| Avg Ground Time (>=24h) | `mean(groundHours where groundHours >= 24)` → formatted H:MM |
| Total Aircraft | `count(distinct aircraftReg)` in filtered period |
| Aircraft By Type | `count(distinct aircraftReg) grouped by inferredType` |

### Charts
- **Combined bar+line**: Recharts `<ComposedChart>` — blue bars (arrivals), pink bars (departures), yellow line (on-ground)
- **MH by Operator**: Horizontal bar chart — `sum(effectiveMH) grouped by customer`, colored by customer colors
- **Donut chart**: Aircraft by Customer — Recharts `<PieChart>` with `innerRadius`, colored by customer colors
- **Mini Gantt**: Compressed flight board strip (optional; P1 scope)

### Analytics Metrics Index

A complete picture of what metrics exist, where they appear, and what data they rely on:

| Metric | Location | Formula / Source | Data Dependency |
|--------|----------|-----------------|----------------|
| Total Aircraft | Dashboard KPI card | `count(distinct aircraftReg)` in filtered period | Work packages |
| Avg Ground Time (<24h) | Dashboard KPI card | `mean(groundHours where groundHours < 24)` → H:MM | Work packages |
| Avg Ground Time (≥24h) | Dashboard KPI card | `mean(groundHours where groundHours >= 24)` → H:MM | Work packages |
| Aircraft By Type | Dashboard KPI card | `count(distinct aircraftReg) grouped by inferredType` | Work packages + type mapping |
| Arrivals/hour | Dashboard bar chart | `count(WP where arrival in hour bucket)` | Hourly snapshots |
| Departures/hour | Dashboard bar chart | `count(WP where departure in hour bucket)` | Hourly snapshots |
| On-Ground/hour | Dashboard line chart | `count(WP where arrival <= hour < departure)` | Hourly snapshots |
| MH by Operator | Dashboard horizontal bar | `sum(effectiveMH) grouped by customer` | Work packages |
| Aircraft by Customer | Dashboard donut | `count(distinct aircraftReg) grouped by customer` | Work packages |
| Daily Demand MH | Capacity chart + table | `sum(effectiveMH for WPs overlapping day)` | Work packages |
| Daily Capacity MH | Capacity chart + table | `sum(shift.headcount × realCapacityPerPerson)` for all shifts | Shift config |
| Utilization % | Capacity chart + table | `dailyDemandMH / realCapacityMH × 100` | Demand + capacity |
| Surplus/Deficit MH | Capacity table | `realCapacityMH - dailyDemandMH` | Demand + capacity |
| Overtime Flag | Capacity table | `utilization > 100%` | Utilization |
| Critical Flag | Capacity table | `utilization > 120%` | Utilization |
| Top Busiest Aircraft | Dashboard card (future) | `count(WPs per aircraftReg)` ranked | Work packages |
| Avg Turnaround Time | Dashboard card (future) | `mean(groundHours) per aircraft type` | Work packages |

Metrics marked "(future)" are designed but deferred beyond MVP. Their formulas are documented so they can be implemented without re-analysis.

### Data Source
- Hourly snapshots: `GET /api/hourly-snapshots?start=&end=&op=&ac=&type=`
- Work packages: `GET /api/work-packages/all?start=&end=&op=&ac=&type=` (unpaginated for charts)

---

## Capacity Modeling (`/capacity`)

### Filters
Uses the global FilterBar. See [REQ_Filters.md](REQ_Filters.md).
Additionally has a **Configuration Panel** (inline, not in FilterBar).

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ FILTER BAR                                                   │
├─────────────────────────────────────────────────────────────┤
│ CONFIG: [Default MH slider] [WP Include/Exclude] [Shifts]   │
├─────────────────────────────────────────────────────────────┤
│ UTILIZATION CHART (daily bars, color-coded)                  │
├─────────────────────────────────────────────────────────────┤
│ DETAIL TABLE (Date, Demand, Capacity, Util%, Surplus, Flag) │
│ [expandable rows → by Customer, by Aircraft, by Shift]      │
└─────────────────────────────────────────────────────────────┘
```

### Business Rules
See `/CLAUDE.md` → "Key Domain Rules" for capacity formulas, or `/plan/FINAL-PLAN.md` Section 7 for full detail.

### Chart legend (OI-121, D-065)

The Demand vs Capacity chart — and the weekly-pattern and monthly charts behind the
same aggregation toggle — use a custom two-row legend, not Recharts' `<Legend>`:

- **Row 1 — entities**: Days / Swings / Nights (or customers in By Customer mode)
- **Row 2 — series roles**: Capacity, Utilization, plus Forecast / lens / compare overlays

Every entry toggles. A series is drawn only when **neither** its entity key nor its
role key is hidden, so clicking *Days* hides the Day bar, the Day capacity line and
the Day utilization line together, while clicking *Capacity* hides that role for
every shift. Demand has no separate entry when the entity row is present — those bars
are the entity entries.

Shift hues come from `src/lib/utils/shift-colors.ts` and nowhere else. Roles are
distinguished by **form** as well as hue: demand is a filled bar, capacity a dashed
line with no dots, utilization a solid line in a lightened hue with a per-shift dot
shape (circle / square / triangle).

### Key Behavior
- Filters affect **demand** only; capacity is determined by shift config
- Every filter the Columns dialog can express now changes the numbers, including
  `!=` / `not in` and the rules with no filter-state field (OI-117). The operator
  filter also applies to demand contracts, flight events, time bookings and billing
  entries
- The timezone selector does **not** affect this page — see OI-119
- Changing config sliders recalculates within 500ms
- CSV export button downloads the detail table (all rows, not just current page)
- Detail table uses TanStack Table with pagination (D-017): default 30 rows/page, configurable via user preferences

---

## Settings (`/settings`)

### No FilterBar
This page does not use the global FilterBar.

### Sections
1. **Demand Model**: Default MH slider (0.5–10.0), WP MH inclusion toggle
2. **Capacity Model**: Theoretical/Real capacity per person sliders
3. **Shift Configuration**: Editable table (name, start, end, headcount)
4. **Display**: Timeline default days, timezone, theme (dark/light/system)
5. **Data**: Import JSON/CSV, export CSV, last import stats

### Persistence
All settings saved to SQLite `config` table via `PUT /api/config` (D-011).
Note: Data import moved to Admin section (`/admin/import`) per D-016.
