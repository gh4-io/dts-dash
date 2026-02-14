# REQ: Analytics & Statistics Plan

> Decision: D-019 (pending). Authoritative spec for all analytics in the CVG Dashboard.
> Local-first. SQLite only. No third-party trackers. No cloud telemetry.

---

## 0. What I Understand You Want

You're building an operational intelligence tool for the people who keep aircraft maintained and moving at CVG. The analytics exist to answer three questions that a line maintenance operation asks every day:

1. **What's happening now?** — How many aircraft are on the ground, whose are they, how long will they be here, and do we have enough people on this shift to cover the work?
2. **What happened recently?** — Over the last 3 days (or week, or custom window), which customers drove the most demand, how did our utilization trend, and where did we overshoot or underuse capacity?
3. **What should we prepare for?** — Based on the scheduled arrivals in the next 24–72h, when are the peak hours, which shifts need extra hands, and which customers will dominate the ramp?

These are NOT vanity metrics. They're operational decision-support metrics consumed by real people standing on a hangar floor or sitting in a planning office. Every chart and number must tie back to an action someone can take: reassign headcount, call in overtime, prioritize a customer, escalate a capacity crunch.

There is also a secondary concern: **system usage visibility**. As a local-first tool, you can't rely on a cloud analytics service to tell you if people are actually using it, which pages they rely on, or when data goes stale. Lightweight event tracking in SQLite solves this for the admin without phoning home.

### Two Layers of Analytics

| Layer | Purpose | Audience | Storage | UI Location |
|-------|---------|----------|---------|-------------|
| **Operational** | Business KPIs derived from work package data | All authenticated users | Computed on-the-fly from `data/input.json` via API | `/dashboard`, `/capacity`, `/flight-board` |
| **Usage** | How the tool itself is being used | Admin / Superadmin only | SQLite `analytics_events` table | `/admin/analytics` (new) |

The operational layer is the core product. The usage layer is a lightweight bonus that makes the tool self-aware.

---

## 1. Analytics Goals & Stakeholders

### Goals

| ID | Goal | Metric Category | Priority |
|----|------|----------------|----------|
| G-01 | Know current ramp load at a glance | Aircraft count, on-ground count, shift utilization | P0 — MVP |
| G-02 | Understand demand by customer/operator | MH by operator, aircraft by customer, visit frequency | P0 — MVP |
| G-03 | Forecast staffing needs per shift | Utilization %, surplus/deficit, overtime flags | P0 — MVP |
| G-04 | Spot trends over time (daily/weekly) | Rolling averages, utilization trend, demand trend | P1 — post-MVP |
| G-05 | Identify aircraft with longest/most frequent visits | Busiest aircraft, avg turnaround by type | P1 — post-MVP |
| G-06 | Monitor data freshness and system usage | Last import age, active users, page view counts | P2 — admin-only |

### Stakeholders

| Stakeholder | Role in App | What They Need | Primary Pages |
|-------------|-----------|---------------|---------------|
| **Line Maintenance Supervisor** | `user` | Real-time ramp picture, shift workload, customer priorities | Flight Board, Dashboard |
| **Shift Planner** | `user` | Demand vs capacity next 24–72h, overtime forecasting, shift headcount tuning | Capacity, Settings |
| **Station Manager** | `admin` | Customer mix trends, weekly utilization, data freshness | Dashboard, Capacity, Admin |
| **System Administrator** | `superadmin` | Tool adoption, user activity, import health, error rates | Admin Analytics |

---

## 2. KPI Catalog

### Operational KPIs (derived from work package data)

| ID | Name | Definition | Formula | Cadence | Dimensions | UI Location |
|----|------|-----------|---------|---------|------------|-------------|
| KPI-01 | Total Aircraft | Distinct aircraft with ground time overlapping the filtered period | `count(distinct aircraftReg WHERE arrival < endDate AND departure > startDate)` | Real-time (on filter change) | Customer, Type | Dashboard KPI card |
| KPI-02 | Avg Ground Time (<24h) | Mean ground hours for short-stay aircraft | `mean(groundHours WHERE groundHours < 24)` → H:MM | Real-time | Customer, Type | Dashboard KPI card |
| KPI-03 | Avg Ground Time (≥24h) | Mean ground hours for heavy/overnight aircraft | `mean(groundHours WHERE groundHours >= 24)` → H:MM | Real-time | Customer, Type | Dashboard KPI card |
| KPI-04 | Aircraft By Type | Distinct aircraft count per canonical type | `count(distinct aircraftReg) GROUP BY inferredType` | Real-time | Type (inherent) | Dashboard KPI card |
| KPI-05 | Total Scheduled MH | Sum of effectiveMH across all filtered work packages | `sum(effectiveMH)` | Real-time | Customer, Type, Shift | Dashboard card, Capacity table |
| KPI-06 | Arrivals / Hour | Count of aircraft arriving per hour bucket | `count(WP WHERE arrival IN hourBucket)` | Real-time | Customer, Type | Dashboard bar chart |
| KPI-07 | Departures / Hour | Count of aircraft departing per hour bucket | `count(WP WHERE departure IN hourBucket)` | Real-time | Customer, Type | Dashboard bar chart |
| KPI-08 | On-Ground / Hour | Count of aircraft on-ground at each hour boundary | `count(WP WHERE arrival <= hour < departure)` | Real-time | Customer, Type | Dashboard line chart |
| KPI-09 | MH by Operator | Total effectiveMH grouped by customer | `sum(effectiveMH) GROUP BY customer` | Real-time | Customer (inherent) | Dashboard horizontal bar |
| KPI-10 | Aircraft by Customer | Distinct aircraft per customer | `count(distinct aircraftReg) GROUP BY customer` | Real-time | Customer (inherent) | Dashboard donut |
| KPI-11 | Daily Demand MH | Sum of effectiveMH for WPs overlapping each calendar day | `sum(effectiveMH for WPs overlapping day)` | Real-time | Customer, Type, Day | Capacity chart + table |
| KPI-12 | Daily Capacity MH | Sum of shift capacity for each day | `sum(shift.headcount × realCapacityPerPerson) for all shifts in day` | Real-time (config-dependent) | Shift (inherent) | Capacity chart + table |
| KPI-13 | Utilization % | Demand as a percentage of real capacity | `dailyDemandMH / realCapacityMH × 100` | Real-time | Day | Capacity chart + table |
| KPI-14 | Surplus / Deficit MH | How much capacity headroom (or shortfall) exists | `realCapacityMH − dailyDemandMH` | Real-time | Day | Capacity table |
| KPI-15 | Overtime Flag | Binary: does demand exceed capacity? | `utilization > 100%` | Real-time | Day | Capacity table (color-coded) |
| KPI-16 | Critical Flag | Binary: is demand dangerously over capacity? | `utilization > 120%` | Real-time | Day | Capacity table (color-coded) |
| KPI-17 | Peak Concurrent Aircraft | Maximum number of aircraft on-ground simultaneously in the filtered window | `max(onGroundCount across all hourly snapshots)` | Real-time | — | Dashboard card |
| KPI-18 | Avg MH per Visit by Operator | Average labor per aircraft visit, per customer | `mean(effectiveMH) GROUP BY customer` | Real-time | Customer (inherent) | Dashboard (Operator Performance section) |
| KPI-19 | Visit Frequency by Operator | Number of work package visits per customer in filtered period | `count(WP) GROUP BY customer` | Real-time | Customer (inherent) | Dashboard (Operator Performance section) |
| KPI-20 | Busiest Aircraft | Aircraft with the most WP visits in filtered period, ranked | `count(WP) GROUP BY aircraftReg ORDER BY count DESC LIMIT 10` | Real-time | — | Dashboard card (future — P1) |
| KPI-21 | Avg Turnaround by Type | Mean ground hours per canonical aircraft type | `mean(groundHours) GROUP BY inferredType` | Real-time | Type (inherent) | Dashboard card (future — P1) |
| KPI-22 | Shift-Level Utilization | Utilization % computed per shift within a day | `shiftDemandMH / (shift.headcount × realCapacityPerPerson) × 100` | Real-time | Shift (inherent) | Capacity expanded rows |
| KPI-23 | Data Freshness | Time since last successful data import | `now() − max(import_log.timestamp)` | On page load | — | Dashboard header badge, Admin |
| KPI-24 | MH Override Rate | What fraction of WPs have manual MH overrides | `count(WP WHERE mhSource = 'manual') / count(WP) × 100` | Real-time | — | Settings info, Admin |

### How Cadence Works

All operational KPIs are **computed on-the-fly** by the server API when the client requests data with filter parameters. There is no pre-aggregation or batch job. This is viable because:
- The dataset is small (86 records currently, expected <500 even at scale)
- All computation is simple aggregation (counts, sums, means) on an in-memory array
- Results are cached at the module level and invalidated only on data import (R10)

If data volume ever exceeds ~2,000 records, a materialized view in SQLite becomes the mitigation (see OI-016).

---

## 3. Event Tracking Spec

### Common Properties (attached to every event)

| Property | Type | Source | Description |
|----------|------|--------|-------------|
| `id` | string (UUID) | Server-generated | Unique event ID |
| `event_name` | string | Defined below | Machine-readable event name |
| `user_id` | string | Auth session | UUID of the authenticated user |
| `role` | string | Auth session | `user`, `admin`, or `superadmin` |
| `station` | string | Constant | Always `"CVG"` |
| `timezone` | string | Filter state or preference | IANA timezone in effect (default `"UTC"`) |
| `page` | string | `pathname` | URL path, e.g. `/flight-board` |
| `session_id` | string | Auth session token | Groups events within one login session |
| `timestamp` | string (ISO 8601) | Server clock | UTC timestamp of the event |

### Event Catalog

| Event Name | Trigger | Required Props | Optional Props | Example Payload |
|-----------|---------|---------------|----------------|----------------|
| `page_view` | User navigates to a page | `page` | `referrer` (previous page) | `{ event_name: "page_view", page: "/dashboard", referrer: "/flight-board" }` |
| `filter_change` | User modifies any FilterBar field | `field` (which filter), `value` (new value) | `previous_value` | `{ event_name: "filter_change", field: "operators", value: ["CargoJet Airways"], previous_value: [] }` |
| `filter_reset` | User clicks Reset Filters | — | `active_filters_count` (how many were active) | `{ event_name: "filter_reset", active_filters_count: 3 }` |
| `gantt_zoom` | User zooms via button or scroll | `level` (6h/12h/1d/3d/1w), `method` (button/scroll/drag) | — | `{ event_name: "gantt_zoom", level: "6h", method: "button" }` |
| `gantt_bar_click` | User clicks a flight bar | `aircraft_reg`, `customer` | `flight_id`, `ground_hours` | `{ event_name: "gantt_bar_click", aircraft_reg: "C-FOIJ", customer: "CargoJet Airways" }` |
| `capacity_config_change` | User adjusts a capacity slider | `setting` (which slider), `value` (new value) | `previous_value` | `{ event_name: "capacity_config_change", setting: "defaultMH", value: 4.5, previous_value: 3.0 }` |
| `csv_export` | User exports data to CSV | `source_page`, `row_count` | `filters_active` (boolean) | `{ event_name: "csv_export", source_page: "/capacity", row_count: 42 }` |
| `data_import` | Admin imports work package data | `source` (file_upload/paste_json), `record_count` | `customer_count`, `aircraft_count`, `warnings` | `{ event_name: "data_import", source: "paste_json", record_count: 86 }` |
| `config_change` | User saves a Settings change | `section`, `setting`, `value` | `previous_value` | `{ event_name: "config_change", section: "shifts", setting: "day_headcount", value: 10 }` |
| `login` | User authenticates | `method` (credentials) | `remember_me` (boolean) | `{ event_name: "login", method: "credentials" }` |
| `logout` | User signs out | — | `session_duration_min` | `{ event_name: "logout", session_duration_min: 45 }` |
| `password_change` | User changes their password | — | — | `{ event_name: "password_change" }` |
| `customer_color_change` | Admin changes a customer color | `customer_name`, `new_color` | `previous_color` | `{ event_name: "customer_color_change", customer_name: "Kalitta Air", new_color: "#f97316" }` |
| `user_create` | Admin creates a user | `target_user_id`, `target_role` | — | `{ event_name: "user_create", target_user_id: "abc-123", target_role: "user" }` |
| `user_edit` | Admin edits a user | `target_user_id`, `changes` (array of field names) | — | `{ event_name: "user_edit", target_user_id: "abc-123", changes: ["role", "displayName"] }` |
| `user_deactivate` | Admin deactivates a user | `target_user_id` | — | `{ event_name: "user_deactivate", target_user_id: "abc-123" }` |
| `aircraft_type_rule_change` | Admin edits type mapping rules | `action` (add/edit/delete/reset) | `rule_count` | `{ event_name: "aircraft_type_rule_change", action: "add", rule_count: 12 }` |
| `theme_change` | User changes theme/preset | `color_mode`, `preset` | `accent_color` | `{ event_name: "theme_change", color_mode: "dark", preset: "ocean" }` |
| `error` | Unhandled error in error boundary | `error_message`, `component_stack` | `page` | `{ event_name: "error", error_message: "Failed to fetch", page: "/dashboard" }` |

### Tracking Implementation

Events are recorded via a thin `trackEvent()` utility:

```typescript
// src/lib/analytics/track.ts
async function trackEvent(
  eventName: string,
  props?: Record<string, unknown>
): Promise<void>;
```

- **Client-side**: calls `POST /api/analytics/events` with the event payload
- **Server-side**: the API route attaches common properties (user_id, role, session_id, timestamp) from the auth session, then writes to SQLite
- **Fire-and-forget**: tracking never blocks UI; failures are silently logged to console
- **Batching** (ASSUMPTION): events are queued client-side and flushed every 5 seconds or on page unload (whichever comes first) to reduce write frequency. See OI-017 for whether batching is worth the complexity at current scale.

---

## 4. Page → Events Map

### `/login`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `login` | Successful authentication |

### `/flight-board`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `filter_change` | Any FilterBar field changes |
| `filter_reset` | Reset button clicked |
| `gantt_zoom` | Zoom level changes (button, scroll, or drag) |
| `gantt_bar_click` | User clicks a flight bar |

### `/dashboard`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `filter_change` | Any FilterBar field changes |
| `filter_reset` | Reset button clicked |

### `/capacity`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `filter_change` | Any FilterBar field changes |
| `filter_reset` | Reset button clicked |
| `capacity_config_change` | Capacity/demand slider adjusted |
| `csv_export` | Export button clicked |

### `/settings`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `config_change` | Any setting saved |

### `/account`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `password_change` | Password successfully changed |
| `theme_change` | Theme or preset changed |

### `/admin/customers`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `customer_color_change` | Color saved |

### `/admin/users`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `user_create` | New user created |
| `user_edit` | User updated |
| `user_deactivate` | User deactivated |

### `/admin/import`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `data_import` | Import committed |

### `/admin/aircraft-types`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `aircraft_type_rule_change` | Mapping rules modified |

### `/admin/settings`

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `config_change` | Setting saved |

### `/admin/analytics` (NEW)

| Event | When |
|-------|------|
| `page_view` | Page loads |

### All pages (via error boundary)

| Event | When |
|-------|------|
| `error` | Unhandled exception caught by error boundary |

---

## 5. Filtering + Segmentation Requirements

### How the Global FilterBar Affects Analytics

The FilterBar (REQ_Filters.md) controls **all operational KPIs**. When a user sets filters, every KPI recalculates against the filtered subset. This is the fundamental design: analytics are always scoped to what you're looking at.

| Filter | What It Scopes | Effect on KPIs |
|--------|---------------|---------------|
| Start Date / End Date | Time window | Only WPs with `departure > start AND arrival < end` are included. All KPIs recalculate for this window. |
| Station | Always CVG | No effect (constant). Included in event tracking as context. |
| Timezone | Display only | KPI **values** don't change. Displayed **times** shift (arrival/departure formatting). Hourly chart X-axis labels shift. |
| Operator (Customer) | Customer filter | `customer IN selected` or all. KPIs recalculate for matching WPs. Customer-grouped KPIs only show selected. |
| Aircraft | Registration filter | `aircraftReg IN selected` or all. KPIs recalculate for matching WPs. |
| Type | Aircraft type filter | `inferredType IN selected` or all. KPIs recalculate for matching WPs. |

### Combination Logic

All filters combine with **AND** (per REQ_Filters.md):
```
visible = (departure > startDate)
       AND (arrival < endDate)
       AND (operators.length === 0 OR customer IN operators)
       AND (aircraft.length === 0 OR aircraftReg IN aircraft)
       AND (types.length === 0 OR inferredType IN types)
```

When all multi-selects are empty, they act as "All" — no restriction. This means the unfiltered state shows the global picture.

### Segmentation Dimensions

Each operational KPI can be **segmented** (broken down) by one or more of these dimensions:

| Dimension | Values | Applicable KPIs | UI Control |
|-----------|--------|-----------------|------------|
| Customer | CargoJet, Aerologic, Kalitta Air, DHL Air UK, Kalitta Charters II, 21 Air | KPI-01 through KPI-22 | Operator filter in FilterBar |
| Aircraft Type | B777, B767, B747, B757, B737, Unknown | KPI-01 through KPI-22 | Type filter in FilterBar |
| Shift | Day (07-15), Swing (15-23), Night (23-07) | KPI-11, KPI-12, KPI-13, KPI-22 | Capacity expanded rows |
| Day | Calendar date | KPI-06 through KPI-16 | Capacity table rows, hourly chart X-axis |
| Hour | Hour boundary | KPI-06, KPI-07, KPI-08 | Dashboard combined chart X-axis |

### How Filters Affect Rollups and Queries

**API-level**: filters are passed as query parameters to all data endpoints. The server applies the filter predicate to the in-memory work package array before computing any aggregation. This means:

1. KPI-01 (Total Aircraft) with `?op=CargoJet+Airways` → only counts aircraft belonging to CargoJet
2. KPI-09 (MH by Operator) with `?type=B777` → only sums MH for B777 visits, grouped by customer
3. KPI-13 (Utilization %) with `?op=CargoJet+Airways` → demand is CargoJet-only, but capacity is unchanged (capacity doesn't depend on which customer you filter)

**Important nuance**: Capacity (KPI-12) is **never filtered** by customer/aircraft/type. Capacity depends solely on shift headcount configuration. Only demand is filtered. This means Utilization % with a customer filter shows "what share of our total capacity does this customer consume?"

### Usage Event Segmentation

Usage events (`analytics_events` table) can be segmented by:
- `role` (user vs admin)
- `page` (which page gets the most use)
- `event_name` (which actions are most common)
- `session_id` (group events per login session)
- Time (events have UTC timestamps — can bucket by day/hour)

---

## 6. Storage + Privacy Model

### Operational Analytics Storage

Operational KPIs are **not stored** — they're computed on-the-fly from work package data via API routes. The source of truth is `data/input.json` + SQLite config tables (shift headcounts, MH overrides, etc.).

### Usage Analytics Storage

```sql
-- Added to Drizzle schema: src/lib/db/schema.ts
CREATE TABLE analytics_events (
  id          TEXT PRIMARY KEY,              -- UUID
  event_name  TEXT NOT NULL,                 -- e.g. "page_view"
  user_id     TEXT NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL,                 -- "user" | "admin" | "superadmin"
  session_id  TEXT NOT NULL,                 -- Auth session token
  station     TEXT NOT NULL DEFAULT 'CVG',
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  page        TEXT,                          -- URL pathname
  props       TEXT,                          -- JSON-serialized event-specific properties
  timestamp   TEXT NOT NULL                  -- ISO 8601 UTC
);

CREATE INDEX idx_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_events_name ON analytics_events(event_name);
CREATE INDEX idx_events_user ON analytics_events(user_id);
```

### Retention Policy

| Data | Retention | Pruning |
|------|-----------|---------|
| Work package data (`input.json`) | Indefinite (overwritten on import) | Manual via Admin Import |
| Import log (`import_log` table) | Indefinite | Manual delete (admin) |
| Usage events (`analytics_events`) | **365 days** (ASSUMPTION — see OI-014) | Auto-prune: server deletes events older than 365 days on application startup and nightly via a cron-style check in the API |
| Auth sessions (`sessions` table) | Until expiry (24h or 30d with remember-me) | Pruned by Auth.js on session check |

### PII Handling

| Data Point | PII? | Handling |
|------------|------|---------|
| `user_id` | Pseudonymous — maps to User table | Stored in events. Not exposed in UI without admin role. |
| `email` | Yes — in `users` table | Never stored in analytics events. Admin-only visibility. |
| `displayName` | Mild PII — in `users` table | Never stored in analytics events. Resolved at display time via join. |
| `session_id` | Technical identifier | Stored in events. Not personally identifying alone. |
| `ip_address` | PII | Stored in `sessions` table (for auth). NOT stored in analytics events. |
| `user_agent` | Fingerprint risk | Stored in `sessions` table (for auth). NOT stored in analytics events. |
| Event props (filter values, etc.) | Operational data, not PII | Stored as JSON. Contains aircraft registrations, customer names — operational, not personal. |

**Principle**: analytics events contain the minimum needed to answer "who did what when." Personal details are resolved from the `users` table at query time, never denormalized into events.

### Role-Based Access

| Resource | `user` | `admin` | `superadmin` |
|----------|--------|---------|-------------|
| Operational KPIs (Dashboard, Capacity) | Read | Read | Read |
| Usage events (`/admin/analytics`) | No access | Read (own + aggregate) | Read (all users) |
| Event export (CSV) | No access | No access | Export |
| Retention config | No access | No access | Configure |

### Audit Logging Integration

Usage events serve as a lightweight audit trail for v1:
- `data_import`, `config_change`, `customer_color_change`, `user_create`, `user_edit`, `user_deactivate` events provide who-did-what-when for the most important admin actions
- The vNext full audit log (REQ_Admin.md → Audit Log) will add previous/new value tracking — the event tracking table provides the foundation

---

## 7. Dashboard Wire Outline

### Ops Overview (`/dashboard` — primary view)

This is the existing Statistics Dashboard, enriched with the full KPI catalog.

```
┌──────────────────────────────────────────────────────────────────────┐
│ FILTER BAR (7 fields, URL-synced — see REQ_Filters.md)               │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  KPI-17      │  KPI-01      │  KPI-05      │  KPI-23               │
│  Peak On-    │  Total Acft  │  Total Sched │  Data Freshness       │
│  Ground: 12  │  Count: 69   │  MH: 258.0   │  ● 2h ago            │
├──────────────┼──────────────┼──────────────┤                       │
│  KPI-02      │  KPI-03      │  KPI-04      │  (badge: green if     │
│  Avg Ground  │  Avg Ground  │  By Type:    │   <24h, yellow <72h,  │
│  <24h: 7:10  │  ≥24h: 55:32 │  B777:13 ... │   red if >72h)       │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                                                                      │
│  COMBINED BAR + LINE CHART (KPI-06, KPI-07, KPI-08)                  │
│  X: hourly over filtered window | Y: aircraft count                  │
│  Blue bars: arrivals | Pink bars: departures | Yellow line: on-ground │
│                                                                      │
├──────────────────────────────────────────┬───────────────────────────┤
│                                          │                           │
│  MH BY OPERATOR (KPI-09)                 │  AIRCRAFT BY CUSTOMER     │
│  Horizontal bar chart                    │  (KPI-10) Donut chart     │
│  Customer colors from useCustomers()     │  Customer colors          │
│                                          │                           │
├──────────────────────────────────────────┴───────────────────────────┤
│  MINI GANTT TIMELINE (compressed Flight Board strip — P1 scope)      │
└──────────────────────────────────────────────────────────────────────┘
```

### Customer / Operator Performance (`/dashboard#operators` — tab or scroll section)

This is a NEW section within the Dashboard page, below the Ops Overview.

```
┌──────────────────────────────────────────────────────────────────────┐
│  OPERATOR PERFORMANCE (when no operator filter → shows all;          │
│                        when filtered → shows selected only)          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  OPERATOR COMPARISON TABLE (KPI-09, KPI-10, KPI-18, KPI-19)         │
│  ┌──────────────┬────────┬─────────┬────────────┬────────┬────────┐ │
│  │ Operator     │ Visits │ Acft    │ Total MH   │ Avg MH │ Avg    │ │
│  │              │        │ Count   │            │ /Visit │ Ground │ │
│  ├──────────────┼────────┼─────────┼────────────┼────────┼────────┤ │
│  │ ● CargoJet   │   32   │   24    │   96.0     │  3.0   │  8:15  │ │
│  │ ● Aerologic  │   22   │   18    │   66.0     │  3.0   │ 12:40  │ │
│  │ ● Kalitta    │   16   │   16    │   48.0     │  3.0   │ 16:22  │ │
│  │ ● DHL Air UK │   10   │   16    │   30.0     │  3.0   │  6:30  │ │
│  │ ● Kalitta II │    4   │    8    │   12.0     │  3.0   │  4:10  │ │
│  │ ● 21 Air     │    2   │    4    │    6.0     │  3.0   │  3:45  │ │
│  └──────────────┴────────┴─────────┴────────────┴────────┴────────┘ │
│                                                                      │
│  CUSTOMER MH SHARE (KPI-09 as %)    │  TYPE MIX PER OPERATOR         │
│  Stacked bar or proportional bar    │  Stacked bar: customer × type  │
│                                      │                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Admin Analytics (`/admin/analytics` — NEW page, admin-only)

```
┌──────────────────────────────────────────────────────────────────────┐
│  System Usage                                        [Last 7 days ▾] │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  Active      │  Page Views  │  Data        │  Errors               │
│  Users: 3    │  Today: 47   │  Imports: 2  │  This week: 0         │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                                                                      │
│  PAGE VIEWS OVER TIME (line chart, daily)                            │
│  X: date | Y: page view count                                       │
│                                                                      │
├──────────────────────────────────────────┬───────────────────────────┤
│  TOP PAGES (bar chart)                   │  EVENTS BY TYPE (table)   │
│  /flight-board: 120                      │  page_view: 312          │
│  /dashboard: 89                          │  filter_change: 78       │
│  /capacity: 45                           │  gantt_zoom: 34          │
│  /settings: 12                           │  csv_export: 5           │
│  /admin/*: 8                             │  data_import: 2          │
├──────────────────────────────────────────┴───────────────────────────┤
│  RECENT EVENTS (table, paginated, filterable by event_name)          │
│  Timestamp | User | Event | Page | Details                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. Validation Plan

### Operational KPI Validation

| Check | Method | When |
|-------|--------|------|
| **Determinism** | Same filters + same dataset = same KPI values. Run the same API call twice and compare responses. | M1 (data layer build) |
| **Count reconciliation** | KPI-01 (Total Aircraft) must equal `sum(values of KPI-04)` (Aircraft By Type). KPI-05 (Total MH) must equal `sum(values of KPI-09)` (MH by Operator). | M3 (dashboard build) — add console assertions in dev mode |
| **Boundary check** | KPI-13 (Utilization) must be ≥ 0%. KPI-14 (Surplus) must be negative when KPI-15 (Overtime) is true. | M4 (capacity build) |
| **Empty state** | Filters that exclude all records → all KPIs show zero/empty, not NaN or error. | M2 (FilterBar build) |
| **Timezone invariance** | Changing timezone must not change KPI-01 through KPI-16 values (only display formatting). | M2 |
| **Sample data spot-check** | Manually compute expected values for the 86-record dataset with known filters and compare to API output. Document expected values in TEST_PLAN.md. | M3 |

### Event Tracking Validation

| Check | Method | When |
|-------|--------|------|
| **Event fires** | For each event in the catalog: trigger the action in the UI, query `analytics_events` table, verify row exists with correct `event_name` and `props`. | M1 (when event tracking is wired) |
| **Common props present** | Every event row must have non-null `user_id`, `role`, `station`, `timestamp`, `session_id`. | Automated check in the tracking API route |
| **No duplicate events** | Same `id` should never appear twice. `page_view` for the same `page` + `session_id` within 1 second = suspect. | Query after a manual test session |
| **Missing event detection** | If a page has zero `page_view` events in 24h but users were active, the tracking for that page may be broken. | Admin Analytics page — add a "Pages with no views in 24h" warning |
| **Payload size** | `props` JSON should never exceed 4KB. Log a warning if it does. | Server-side check in the API route |
| **Privacy check** | `props` must never contain `email`, `passwordHash`, or `ip_address`. | Code review + grep for those strings in tracking calls |

### Cross-Layer Reconciliation

| Check | Method |
|-------|--------|
| `data_import` event count should match `import_log` table row count | Query both tables, compare counts |
| `login` event count should roughly match `sessions` table creation count | Compare over a time window |
| `filter_change` events should correspond to URL param changes visible in page views | Spot-check event sequences per session |

---

## 9. Gap List + Next Actions

Gaps identified during this analysis that need resolution. Each becomes an Open Item.

| ID | Gap | Priority | Owner | Next Action |
|----|-----|----------|-------|-------------|
| OI-014 | **Analytics event retention period**: Assumed 365 days. Need user confirmation. Affects storage growth and admin query performance. | P2 | User | Confirm or adjust the 365-day default. |
| OI-015 | **Operator Performance section scope**: Is the Customer/Operator Performance table a P0 (MVP Day 4 with Dashboard) or P1 (post-MVP)? The Ops Overview KPIs are clearly P0. | P1 | User | Confirm priority. Best-guess default: P0 — it ships with M3. |
| OI-016 | **Materialized KPI views at scale**: Current plan computes all KPIs on-the-fly from in-memory data. If WP count exceeds ~2,000, this becomes slow. Need a threshold for introducing SQLite materialized views. | P3 | Claude | No action until data volume grows. Document the escape hatch. |
| OI-017 | **Event batching vs immediate write**: Assumed 5-second client-side batch flush. At current user count (<10), immediate writes are fine. Batching adds complexity (queue, flush-on-unload). Should we skip batching for v1? | P2 | Claude | Best-guess default: skip batching for v1, write immediately. Add batching when >20 concurrent users. |

---

## 10. Quality Gate

### What I Understood

- [x] Analytics is local-first — SQLite only, no third-party trackers, no cloud telemetry
- [x] The primary purpose is operational decision support, not product analytics
- [x] Three core questions: what's happening now, what happened recently, what should we prepare for
- [x] The global FilterBar controls all operational KPI rollups
- [x] Capacity is never filtered by customer/aircraft/type — only demand is
- [x] Station is always CVG (constant dimension, not a variable)
- [x] Timezone is display-only — it changes formatting but not KPI values
- [x] Customer colors are admin-configurable and must be consistent across all chart views
- [x] effectiveMH follows the priority chain: manual override > WP MH (if include) > default 3.0
- [x] Two layers exist: operational analytics (for all users) and usage analytics (for admins)
- [x] Existing Analytics Metrics Index in REQ_OtherPages.md is the starting point, not a replacement target

### What I Assumed (marked throughout, collected here)

| # | Assumption | Location | Default |
|---|-----------|----------|---------|
| A-01 | Event retention is 365 days | §6 Storage | See OI-014 |
| A-02 | Events are written immediately (no client-side batching) for v1 | §3 Tracking Implementation | See OI-017 |
| A-03 | Operator Performance table ships with M3 (P0) | §7 Wire Outline | See OI-015 |
| A-04 | `/admin/analytics` is a new page, not a tab within an existing admin page | §7 Wire Outline | New page in admin sub-nav |
| A-05 | KPI-17 (Peak Concurrent Aircraft) is computed from hourly snapshots, not minute-level | §2 KPI Catalog | Hourly granularity is sufficient for staffing decisions |
| A-06 | KPI-20 (Busiest Aircraft) and KPI-21 (Avg Turnaround by Type) remain P1 / future | §2 KPI Catalog | Documented formulas, deferred implementation |
| A-07 | The 2,000-record threshold for materialized views is approximate | §2 Cadence | See OI-016 |

### What I Still Need

1. **OI-014**: Confirmation of event retention policy (365 days vs different)
2. **OI-015**: Priority of Operator Performance section (P0 with Dashboard or P1)
3. **OI-009** (existing): Shift schedule customization scope — affects KPI-22 (shift-level utilization) computation

### Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R17 | `analytics_events` table grows unbounded if retention pruning fails | Auto-prune on startup + nightly. Alert in Admin Analytics if table exceeds 100K rows. |
| R18 | Event tracking adds latency to user actions | Fire-and-forget: `trackEvent()` is async, never awaited in the UI path. Write is a single INSERT into SQLite (sub-ms). |
| R19 | Operational KPIs diverge between Dashboard and Capacity pages due to different computation paths | Single source of truth: both pages call the same API endpoints with the same filter params. KPI formulas defined once in `src/lib/data/engines/`. |

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/analytics/track.ts` | Client-side `trackEvent()` utility |
| `src/app/api/analytics/events/route.ts` | POST: record event, GET: query events (admin) |
| `src/app/admin/analytics/page.tsx` | Admin usage analytics page |
| `src/components/admin/analytics-dashboard.tsx` | Usage charts and tables |
| `src/lib/db/schema.ts` | `analytics_events` table (added to existing schema) |

---

## References

- [REQ_Filters.md](REQ_Filters.md) — Filter fields, URL sync, combination logic
- [REQ_OtherPages.md](REQ_OtherPages.md) — Dashboard layout, KPI cards, chart specs, Analytics Metrics Index
- [REQ_DataModel.md](REQ_DataModel.md) — WorkPackage, DailyDemand, HourlySnapshot, AppConfig types
- [REQ_DataSources.md](REQ_DataSources.md) — API routes, pagination convention
- [REQ_Admin.md](REQ_Admin.md) — Admin section, audit log
- [REQ_Logging_Audit.md](REQ_Logging_Audit.md) — Import logging, audit trail
- [REQ_Auth.md](REQ_Auth.md) — Roles, sessions, middleware
