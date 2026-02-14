# CVG Line Maintenance Operations Dashboard — FINAL PLAN

> Version: 1.0 (10-pass refined)
> Date: 2026-02-13
> Status: Ready for implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model & Schema](#3-data-model--schema)
4. [Folder Structure](#4-folder-structure)
5. [Module Specifications](#5-module-specifications)
6. [UI Wireframes (Text)](#6-ui-wireframes-text)
7. [Capacity Model Formulas](#7-capacity-model-formulas)
8. [Milestones & Definition of Done](#8-milestones--definition-of-done)
9. [Prioritized Backlog](#9-prioritized-backlog)
10. [File-by-File Implementation Order](#10-file-by-file-implementation-order)
11. [MVP Scope (1-2 Day Build)](#11-mvp-scope-1-2-day-build)
12. [Assumptions](#12-assumptions)
13. [Open Questions](#13-open-questions)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Risks & Mitigations](#15-risks--mitigations)

---

## 1. Executive Summary

Build a **local-first** Next.js 15 web application for CVG (Cincinnati/Northern Kentucky Airport) line maintenance operations. The dashboard provides three core views:

1. **Flight Board** — Gantt-style timeline showing aircraft on-ground windows
2. **Statistics Dashboard** — KPI cards, charts, and analytics for operational awareness
3. **Capacity Modeling** — Demand vs. capacity analysis for staffing decisions

The app ingests work package data from a local JSON file (sourced from SharePoint OData API), computes derived metrics, and renders interactive visualizations. No cloud dependencies are required to run.

**Key constraints**: Local-first, self-hosted Font Awesome, file-based JSON data for v0, dark neutral theme, desktop-first with mobile responsiveness.

---

## 2. Architecture Overview

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Client)                    │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  Flight   │  │  Statistics  │  │  Capacity Modeling │ │
│  │  Board    │  │  Dashboard   │  │  View              │ │
│  └─────┬────┘  └──────┬───────┘  └────────┬───────────┘ │
│        │               │                   │             │
│        └───────────────┼───────────────────┘             │
│                        │                                 │
│              ┌─────────▼──────────┐                      │
│              │   Zustand Store    │                       │
│              │  (workPackages,    │                       │
│              │   filters, config) │                       │
│              └─────────┬──────────┘                       │
│                        │                                 │
└────────────────────────┼─────────────────────────────────┘
                         │ fetch /api/work-packages
                         │ fetch /api/capacity
┌────────────────────────┼─────────────────────────────────┐
│                  Next.js Server                          │
│                        │                                 │
│  ┌─────────────────────▼────────────────────────┐        │
│  │        API Route Handlers (app/api/)          │        │
│  │  /work-packages — read + filter + transform   │        │
│  │  /capacity — compute demand/capacity model    │        │
│  │  /config — read/write app settings            │        │
│  └─────────────────────┬────────────────────────┘        │
│                        │                                 │
│  ┌─────────────────────▼────────────────────────┐        │
│  │        Data Layer (lib/data/)                 │        │
│  │  reader.ts — parse JSON/CSV input             │        │
│  │  transformer.ts — normalize SharePoint data   │        │
│  │  capacity-engine.ts — demand/capacity math    │        │
│  │  store.ts — file-based persistence            │        │
│  └─────────────────────┬────────────────────────┘        │
│                        │                                 │
│  ┌─────────────────────▼────────────────────────┐        │
│  │        File System                            │        │
│  │  data/work-packages.json (imported data)      │        │
│  │  data/config.json (app settings)              │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Tech Stack (Locked)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 15+ | App Router, SSR, API routes |
| Language | TypeScript | 5.x | Type safety |
| UI Components | shadcn/ui | latest | Pre-built accessible components |
| Primitives | Radix UI | latest | Headless accessible primitives |
| Styling | Tailwind CSS | v4 | Utility-first CSS |
| Theme | next-themes | latest | Dark/light mode switching |
| Charts | Recharts | 2.x | Bar, line, area, pie/donut |
| Gantt Timeline | SVAR React Gantt | MIT edition | Flight board Gantt view |
| Data Tables | TanStack Table | 8.x | Sortable, filterable tables |
| State | Zustand | 5.x | Client-side state management |
| Icons (primary) | Font Awesome 6 | Free/Pro | Self-hosted webfonts |
| Icons (secondary) | Lucide React | latest | shadcn/ui integration |
| Data (v0) | File-based JSON | — | Local persistence |

### 2.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data loading | Server-side JSON read via API routes | Keeps data layer on server; client fetches via standard HTTP |
| State management | Zustand (not React Query) | Simpler for local data; no cache invalidation complexity |
| Gantt library | SVAR React Gantt (MIT) | Purpose-built Gantt; avoids custom canvas/SVG work |
| Chart library | Recharts via shadcn/ui charts | Pre-styled, composable, matches shadcn/ui theme |
| Color theme | Neutral dark (#09090b base) | Matches Fumadocs reference; professional, low eye-strain |
| Font Awesome hosting | CSS/webfonts in public/vendor/ | No CDN dependency; works offline |
| No SSG for data pages | Client-side fetch + Zustand | Data changes on import; static generation would be stale |

---

## 3. Data Model & Schema

### 3.1 SharePoint Source Record (Raw)

This is the shape of each record in `input.json` (86 records total). Only operationally relevant fields are listed; OData metadata fields are stripped during transformation.

```typescript
// types/sharepoint.ts
interface SharePointWorkPackage {
  ID: number;                           // e.g., 9181
  DocumentSetID: number;                // e.g., 178223
  Aircraft: {
    Title: string;                      // Registration, e.g., "C-FOIJ"
  };
  AircraftId: number;                   // FK to aircraft registry, e.g., 161
  Customer: string;                     // e.g., "CargoJet Airways"
  FlightId: string | null;             // e.g., "CJT507", null for 10 records
  Arrival: string;                      // ISO 8601, e.g., "2026-02-07T05:38:00Z"
  Departure: string;                    // ISO 8601, e.g., "2026-02-09T10:00:00Z"
  TotalMH: number | null;              // Man-hours; null for 66 of 86 records
  TotalGroundHours: string;            // String! e.g., "52.3666666665813"
  Workpackage_x0020_Status: "New" | "Approved";
  HasWorkpackage: boolean;             // true for 27/86 records
  WorkpackageNo: string | null;        // Often null
  CalendarComments: string | null;     // HTML string with notes
  IsNotClosedOrCanceled: "1" | "0";    // String, not boolean
  Confirmed: string | null;
  Modified: string;                    // ISO 8601 timestamp
  Created: string;                     // ISO 8601 timestamp
}
```

### 3.2 Normalized Work Package (App Domain)

```typescript
// types/work-package.ts
interface WorkPackage {
  id: number;                          // from ID
  documentSetId: number;               // from DocumentSetID
  aircraftReg: string;                 // from Aircraft.Title, e.g., "C-FOIJ"
  aircraftId: number;                  // from AircraftId
  customer: CustomerName;              // enum-validated
  flightId: string | null;            // from FlightId
  arrival: Date;                       // parsed from ISO string
  departure: Date;                     // parsed from ISO string
  totalMH: number | null;             // from TotalMH (already number or null)
  groundHours: number;                 // PARSED from TotalGroundHours string
  status: "New" | "Approved";
  hasWorkpackage: boolean;
  workpackageNo: string | null;
  calendarComments: string | null;     // Raw HTML preserved for tooltip display
  isActive: boolean;                   // derived: IsNotClosedOrCanceled === "1"
  modified: Date;
  created: Date;
  // Computed fields (added by transform layer)
  effectiveMH: number;                // see Section 7 for formula
  mhSource: "workpackage" | "default" | "manual";
  manualMHOverride: number | null;    // user override, initially null
  wpMHInclusionMode: "include" | "exclude"; // per-record setting
}

type CustomerName =
  | "CargoJet Airways"
  | "Aerologic"
  | "Kalitta Air"
  | "DHL Air UK"
  | "Kalitta Charters II"
  | "21 Air";

// Customer color mapping (for charts and Gantt bars)
const CUSTOMER_COLORS: Record<CustomerName, string> = {
  "CargoJet Airways":    "#22c55e", // green-500
  "Aerologic":           "#8b5cf6", // violet-500
  "Kalitta Air":         "#f97316", // orange-500
  "DHL Air UK":          "#ef4444", // red-500
  "Kalitta Charters II": "#06b6d4", // cyan-500
  "21 Air":              "#ec4899", // pink-500
};
```

### 3.3 Aircraft Type Inference

The dataset does not include aircraft type directly. We infer it from the registration and customer mapping. This lookup is stored in config and can be manually overridden.

```typescript
// types/aircraft.ts
type AircraftType = "B777" | "B767" | "B747" | "B737" | "Unknown";

interface AircraftTypeMapping {
  registrationPattern: string;  // regex pattern
  customer: CustomerName;
  aircraftType: AircraftType;
}

// Default inference rules (configurable in config.json)
const DEFAULT_AIRCRAFT_TYPE_RULES: AircraftTypeMapping[] = [
  // CargoJet operates B767s
  { registrationPattern: "^C-", customer: "CargoJet Airways", aircraftType: "B767" },
  // Aerologic operates B777Fs
  { registrationPattern: "^D-AA", customer: "Aerologic", aircraftType: "B777" },
  // DHL Air UK operates B767s
  { registrationPattern: "^G-DHL", customer: "DHL Air UK", aircraftType: "B767" },
  // Kalitta Air operates B747s and B767s (N7xx = B747, N3xx/N2xx = B767)
  { registrationPattern: "^N7[6-9]", customer: "Kalitta Air", aircraftType: "B747" },
  { registrationPattern: "^N[234]", customer: "Kalitta Air", aircraftType: "B767" },
  // Kalitta Charters II operates B737s
  { registrationPattern: "^N3[12]", customer: "Kalitta Charters II", aircraftType: "B737" },
  // 21 Air operates B767s
  { registrationPattern: "^N2[89]", customer: "21 Air", aircraftType: "B767" },
];
```

### 3.4 App Configuration

```typescript
// types/config.ts
interface AppConfig {
  // Demand model settings
  defaultMHWhenNoWorkpackage: number;       // Default: 3.0
  wpMHGlobalInclusionMode: "include" | "exclude"; // Default: "include"

  // Capacity model settings
  theoreticalCapacityPerPerson: number;     // Default: 8.0 hours/shift
  realCapacityPerPerson: number;            // Default: 6.5 hours/shift
  headcount: StaffingConfig;

  // Display settings
  timelineDefaultDays: number;              // Default: 3 (Fri-Mon view)
  timezoneName: string;                     // Default: "America/New_York" (CVG is ET)
  theme: "dark" | "light" | "system";       // Default: "dark"

  // Aircraft type rules
  aircraftTypeRules: AircraftTypeMapping[];

  // Data source
  dataFilePath: string;                     // Default: "data/work-packages.json"
}

interface StaffingConfig {
  shifts: ShiftDefinition[];
  defaultHeadcountPerShift: number;         // Default: 8
}

interface ShiftDefinition {
  name: string;              // e.g., "Day", "Swing", "Night"
  startHour: number;         // 0-23, e.g., 7
  endHour: number;           // 0-23, e.g., 15
  headcount: number;         // e.g., 8
}
```

### 3.5 Capacity Model Entities

```typescript
// types/capacity.ts
interface DailyDemand {
  date: string;                 // "2026-02-13"
  totalDemandMH: number;        // sum of effectiveMH for aircraft on ground
  aircraftCount: number;        // count of aircraft on ground this day
  byCustomer: Record<CustomerName, number>;  // demand MH per customer
  byAircraft: AircraftDayDemand[];           // per-aircraft detail
}

interface AircraftDayDemand {
  aircraftReg: string;
  workPackageId: number;
  customer: CustomerName;
  effectiveMH: number;
  mhSource: "workpackage" | "default" | "manual";
  groundHoursToday: number;     // portion of ground time falling on this day
}

interface DailyCapacity {
  date: string;                 // "2026-02-13"
  theoreticalCapacityMH: number;
  realCapacityMH: number;
  byShift: ShiftCapacity[];
}

interface ShiftCapacity {
  shiftName: string;
  headcount: number;
  theoreticalMH: number;       // headcount * theoreticalCapacityPerPerson
  realMH: number;              // headcount * realCapacityPerPerson
}

interface DailyUtilization {
  date: string;
  demand: DailyDemand;
  capacity: DailyCapacity;
  utilizationPercent: number;   // (demand / realCapacity) * 100
  surplusDeficitMH: number;     // realCapacity - demand (negative = over)
  overtimeFlag: boolean;        // true if utilizationPercent > 100
  criticalFlag: boolean;        // true if utilizationPercent > 120
}

// Hourly granularity for the combined bar+line chart
interface HourlySnapshot {
  hour: string;                 // ISO datetime for the hour boundary
  arrivalsCount: number;        // aircraft arriving in this hour
  departuresCount: number;      // aircraft departing in this hour
  onGroundCount: number;        // aircraft on ground at this point
}
```

### 3.6 Gantt Timeline Data Shape

```typescript
// types/gantt.ts — SVAR React Gantt compatible
interface GanttTask {
  id: number;
  text: string;                 // Aircraft registration
  start: Date;
  end: Date;
  type: "task";
  // Custom properties for rendering
  customer: CustomerName;
  flightId: string | null;
  progress: 0;                  // Not used but required by SVAR
}

interface GanttScale {
  unit: "hour" | "day";
  step: number;
  format: string;               // date-fns format string
}
```

---

## 4. Folder Structure

```
dashboard/
├── CLAUDE.md                          # Project instructions (existing)
├── plan/
│   └── FINAL-PLAN.md                  # This file
├── data/
│   ├── input.json                     # Raw SharePoint export (copied from .claude/assets)
│   ├── work-packages.json             # Normalized data (generated by import)
│   └── config.json                    # App configuration
├── public/
│   └── vendor/
│       └── fontawesome/
│           ├── css/
│           │   ├── all.min.css        # FA stylesheet
│           │   └── fontawesome.min.css
│           └── webfonts/
│               ├── fa-solid-900.woff2
│               ├── fa-regular-400.woff2
│               └── fa-brands-400.woff2
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout: theme provider, sidebar, FA CSS import
│   │   ├── page.tsx                   # Redirect to /flight-board
│   │   ├── globals.css                # Tailwind v4 directives, CSS custom properties
│   │   ├── flight-board/
│   │   │   └── page.tsx               # Flight Board (Gantt) view
│   │   ├── dashboard/
│   │   │   └── page.tsx               # Statistics Dashboard view
│   │   ├── capacity/
│   │   │   └── page.tsx               # Capacity Modeling view
│   │   ├── settings/
│   │   │   └── page.tsx               # Configuration page
│   │   └── api/
│   │       ├── work-packages/
│   │       │   └── route.ts           # GET: list, POST: import
│   │       ├── capacity/
│   │       │   └── route.ts           # GET: computed capacity model
│   │       ├── hourly-snapshots/
│   │       │   └── route.ts           # GET: hourly arrival/departure/on-ground
│   │       └── config/
│   │           └── route.ts           # GET/PUT: app settings
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components (auto-generated)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── select.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── sheet.tsx             # Mobile sidebar
│   │   │   ├── dialog.tsx
│   │   │   └── chart.tsx            # shadcn/ui chart wrapper
│   │   ├── layout/
│   │   │   ├── sidebar.tsx            # Left navigation sidebar
│   │   │   ├── header.tsx             # Top bar with date, status indicators
│   │   │   ├── mobile-nav.tsx         # Mobile hamburger nav
│   │   │   └── theme-toggle.tsx       # Dark/light mode toggle
│   │   ├── flight-board/
│   │   │   ├── gantt-timeline.tsx     # SVAR Gantt wrapper
│   │   │   ├── gantt-toolbar.tsx      # Date range picker, filters, zoom
│   │   │   ├── flight-tooltip.tsx     # Hover card for flight details
│   │   │   └── aircraft-sidebar.tsx   # Left panel listing aircraft
│   │   ├── dashboard/
│   │   │   ├── kpi-cards.tsx          # Avg ground time, total aircraft, etc.
│   │   │   ├── man-hours-bar-chart.tsx    # Scheduled MH by customer
│   │   │   ├── aircraft-type-card.tsx     # B777/B767/B747/B737 counts
│   │   │   ├── arrivals-departures-chart.tsx  # Combined bar+line chart
│   │   │   ├── aircraft-donut-chart.tsx   # Aircraft by customer donut
│   │   │   └── mini-gantt.tsx             # Bottom Gantt strip
│   │   ├── capacity/
│   │   │   ├── utilization-chart.tsx      # Daily utilization bar chart
│   │   │   ├── demand-capacity-table.tsx  # Tabular breakdown
│   │   │   ├── staffing-config.tsx        # Shift/headcount inputs
│   │   │   └── what-if-panel.tsx          # Toggle WP MH, adjust defaults
│   │   └── shared/
│   │       ├── customer-badge.tsx         # Colored badge per customer
│   │       ├── date-range-picker.tsx      # Reusable date range selector
│   │       ├── loading-skeleton.tsx       # Skeleton loaders
│   │       ├── empty-state.tsx            # Empty data placeholders
│   │       └── fa-icon.tsx                # Font Awesome icon helper component
│   ├── lib/
│   │   ├── data/
│   │   │   ├── reader.ts                 # Read JSON/CSV files from disk
│   │   │   ├── transformer.ts            # SharePoint -> WorkPackage normalization
│   │   │   ├── capacity-engine.ts        # All demand/capacity calculations
│   │   │   ├── hourly-engine.ts          # Compute hourly snapshots
│   │   │   └── store.ts                  # File-based read/write for data + config
│   │   ├── utils/
│   │   │   ├── date.ts                   # Date parsing, formatting, timezone helpers
│   │   │   ├── aircraft-type.ts          # Registration -> aircraft type inference
│   │   │   └── format.ts                 # Number formatting helpers
│   │   ├── constants.ts                  # Customer colors, default config values
│   │   └── hooks/
│   │       ├── use-work-packages.ts      # Zustand store + data fetching
│   │       ├── use-capacity.ts           # Zustand store for capacity model
│   │       ├── use-filters.ts            # Shared filter state (customer, date range)
│   │       └── use-config.ts             # App configuration state
│   └── types/
│       ├── sharepoint.ts                 # Raw SP types
│       ├── work-package.ts               # Normalized domain types
│       ├── capacity.ts                   # Capacity model types
│       ├── gantt.ts                      # Gantt-specific types
│       └── config.ts                     # App config types
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## 5. Module Specifications

### 5.1 Data Layer: `lib/data/reader.ts`

**Purpose**: Read raw data files from the filesystem.

```typescript
// Exports:
async function readRawWorkPackages(filePath?: string): Promise<SharePointWorkPackage[]>
  // 1. Resolve filePath (default: process.cwd() + "/data/input.json")
  // 2. Read file with fs.readFile
  // 3. Parse JSON, extract .value array
  // 4. Validate array is non-empty
  // 5. Return typed array

async function readConfig(): Promise<AppConfig>
  // Read data/config.json, merge with defaults for any missing keys

async function writeConfig(config: AppConfig): Promise<void>
  // Write config to data/config.json with JSON.stringify(config, null, 2)
```

### 5.2 Data Layer: `lib/data/transformer.ts`

**Purpose**: Transform raw SharePoint records into normalized WorkPackage objects.

```typescript
// Exports:
function transformWorkPackages(
  raw: SharePointWorkPackage[],
  config: AppConfig
): WorkPackage[]
  // For each record:
  // 1. Extract Aircraft.Title as aircraftReg
  // 2. Parse Arrival/Departure to Date objects
  // 3. Parse TotalGroundHours from string to number: parseFloat(raw.TotalGroundHours)
  // 4. Compute effectiveMH (see Section 7.1)
  // 5. Set mhSource based on HasWorkpackage + TotalMH presence
  // 6. Derive isActive from IsNotClosedOrCanceled === "1"
  // 7. Preserve CalendarComments as-is (HTML string)
  // 8. Return sorted by Arrival ascending

function inferAircraftType(
  reg: string,
  customer: CustomerName,
  rules: AircraftTypeMapping[]
): AircraftType
  // Match registration against rules in order; return first match or "Unknown"
```

### 5.3 Data Layer: `lib/data/capacity-engine.ts`

**Purpose**: All demand and capacity calculations.

```typescript
// Exports:
function computeDailyDemand(
  packages: WorkPackage[],
  dateRange: { start: Date; end: Date },
  config: AppConfig
): DailyDemand[]
  // For each day in range:
  //   1. Find all WorkPackages where arrival <= endOfDay AND departure >= startOfDay
  //   2. For each package, compute groundHoursToday (clamped to day boundaries)
  //   3. Apportion effectiveMH proportionally if ground span > 1 day:
  //      dailyMH = effectiveMH * (groundHoursToday / totalGroundHours)
  //   4. Sum into totals by customer and overall

function computeDailyCapacity(
  dateRange: { start: Date; end: Date },
  config: AppConfig
): DailyCapacity[]
  // For each day in range:
  //   For each shift: theoreticalMH = headcount * theoreticalCapacity
  //                   realMH = headcount * realCapacity
  //   Sum across shifts

function computeUtilization(
  demand: DailyDemand[],
  capacity: DailyCapacity[]
): DailyUtilization[]
  // Join on date, compute ratios and flags
```

### 5.4 Data Layer: `lib/data/hourly-engine.ts`

**Purpose**: Compute hourly arrival/departure/on-ground counts for the combined chart.

```typescript
// Exports:
function computeHourlySnapshots(
  packages: WorkPackage[],
  dateRange: { start: Date; end: Date }
): HourlySnapshot[]
  // For each hour boundary in range:
  //   arrivalsCount = packages where arrival falls within this hour
  //   departuresCount = packages where departure falls within this hour
  //   onGroundCount = packages where arrival <= hourEnd AND departure >= hourStart
```

### 5.5 API Routes

#### `GET /api/work-packages`

**Query params**: `?customer=X&from=ISO&to=ISO&status=New|Approved`

**Response**: `{ data: WorkPackage[], meta: { total: number, filtered: number } }`

**Logic**:
1. Read raw data via `reader.readRawWorkPackages()`
2. Transform via `transformer.transformWorkPackages()`
3. Apply query param filters
4. Return filtered results with metadata

#### `GET /api/capacity`

**Query params**: `?from=ISO&to=ISO`

**Response**: `{ demand: DailyDemand[], capacity: DailyCapacity[], utilization: DailyUtilization[] }`

**Logic**:
1. Fetch work packages (reuse internal function)
2. Compute demand, capacity, utilization via engine functions
3. Return all three arrays

#### `GET /api/hourly-snapshots`

**Query params**: `?from=ISO&to=ISO`

**Response**: `{ snapshots: HourlySnapshot[] }`

#### `GET/PUT /api/config`

**GET Response**: `{ config: AppConfig }`
**PUT Body**: `Partial<AppConfig>`
**PUT Response**: `{ config: AppConfig }` (merged result)

### 5.6 Zustand Stores

#### `hooks/use-work-packages.ts`

```typescript
interface WorkPackagesState {
  packages: WorkPackage[];
  loading: boolean;
  error: string | null;
  filters: {
    customers: CustomerName[];
    dateRange: { from: Date; to: Date } | null;
    status: ("New" | "Approved")[] ;
    searchQuery: string;
  };
  // Actions
  fetchPackages: () => Promise<void>;
  setCustomerFilter: (customers: CustomerName[]) => void;
  setDateRange: (range: { from: Date; to: Date }) => void;
  setStatusFilter: (statuses: ("New" | "Approved")[]) => void;
  setSearchQuery: (query: string) => void;
  // Computed (via selectors)
  filteredPackages: () => WorkPackage[];
}
```

#### `hooks/use-capacity.ts`

```typescript
interface CapacityState {
  demand: DailyDemand[];
  capacity: DailyCapacity[];
  utilization: DailyUtilization[];
  loading: boolean;
  fetchCapacity: (from: Date, to: Date) => Promise<void>;
}
```

#### `hooks/use-config.ts`

```typescript
interface ConfigState {
  config: AppConfig | null;
  loading: boolean;
  fetchConfig: () => Promise<void>;
  updateConfig: (partial: Partial<AppConfig>) => Promise<void>;
}
```

---

## 6. UI Wireframes (Text)

### 6.1 Root Layout (`app/layout.tsx`)

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo: FA plane icon] CVG Line Maintenance                   │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│  NAV   │              PAGE CONTENT                           │
│        │                                                     │
│ [icon] │                                                     │
│ Flight │                                                     │
│ Board  │                                                     │
│        │                                                     │
│ [icon] │                                                     │
│ Stats  │                                                     │
│        │                                                     │
│ [icon] │                                                     │
│Capacity│                                                     │
│        │                                                     │
│ [icon] │                                                     │
│Settings│                                                     │
│        │                                                     │
│        │                                                     │
├────────┤                                                     │
│ [moon] │                                                     │
│ Theme  │                                                     │
└────────┴─────────────────────────────────────────────────────┘
```

- **Sidebar**: 64px collapsed (icons only), 240px expanded
- **Background**: `bg-background` (#09090b dark, #ffffff light)
- **Border**: `border-border` subtle right border
- **Active item**: `bg-muted` highlight with left accent bar
- **Mobile**: Sidebar hidden, hamburger menu opens Sheet overlay

### 6.2 Flight Board Page (`/flight-board`)

```
┌─────────────────────────────────────────────────────────────┐
│ TOOLBAR                                                      │
│ [Date: Feb 13-15] [Customer ▼] [Status ▼] [Zoom +/-] [📊]  │
├──────────┬──────────────────────────────────────────────────┤
│ AIRCRAFT │                 GANTT TIMELINE                    │
│          │ 7AM   11AM  3PM  7PM  11PM  3AM  7AM  11AM ...   │
│ C-FOIJ   │ ████████████████████████████████                  │
│ N774CK   │      ██████████████                               │
│ C-FHCJ   │  ███                                              │
│ D-AALK   │          ████████████████████████                 │
│ G-DHLW   │              ██████████████                       │
│ ...      │                                                   │
│          │                                                   │
│ 57 total │ Bars colored by CUSTOMER_COLORS                   │
└──────────┴──────────────────────────────────────────────────┘
│ LEGEND: ● CargoJet  ● Aerologic  ● Kalitta  ● DHL  ...     │
└─────────────────────────────────────────────────────────────┘
```

- **Y-axis**: Aircraft registrations, sorted by earliest arrival
- **X-axis**: Time in hours, default 3-day window centered on today
- **Bars**: Colored by customer, hover shows tooltip with full details
- **Tooltip content**: Reg, Customer, Flight ID, Arrival/Departure, Ground Hours, MH, Status, Comments (HTML rendered)
- **Zoom**: 6h / 12h / 1d / 3d / 1w granularity
- **SVAR Gantt config**: `cellWidth` adjusts with zoom, `scales` array for multi-level headers (day + hour)

### 6.3 Statistics Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────────────┐
│ CVG Line Maintenance          Friday, February 13, 2026  ●● │
├───────────────┬──────────────┬──────────────────────────────┤
│ Average       │ Total Acft   │                              │
│ Ground Time   │ Fri - Mon    │    COMBINED BAR+LINE CHART   │
│               │              │                              │
│ <24h  │ >24h  │    69        │    [Blue bars: Arrivals]     │
│ 7:10  │ 55:32 │              │    [Pink bars: Departures]   │
├───────┴──────┤──────────────│    [Yellow line: On Ground]  │
│ Scheduled MH │ Total Acft   │                              │
│ [by customer]│ By Type      │    X: 7AM..3AM (3 days)      │
│              │              │    Y-left: count (0-35)      │
│ Singapore ░░ │ B777 - 13    │                              │
│ DHL Air ████ │ B767 - 22    │    Day separators: dashed    │
│ Aerologic ███│ B747 - 0     │    lines at midnight         │
│ 21 Air ░     │ B737 - 0     │                              │
│ K.Chrt II ░  │              │                              │
│ Kalitta ░    │              │                              │
├──────────────┴──────────────┴────────────────┬─────────────┤
│            MINI GANTT TIMELINE               │  DONUT      │
│  (same as flight board but compressed,       │  Aircraft   │
│   showing all aircraft in 3-day window,      │  By         │
│   bars colored by customer, labels on bars)  │  Customer   │
│                                              │             │
│                                              │ [pie chart] │
└──────────────────────────────────────────────┴─────────────┘
```

#### KPI Card Formulas

| KPI | Formula | Example |
|-----|---------|---------|
| Avg Ground Time (<24h) | `mean(groundHours where groundHours < 24)` | 7h 10m |
| Avg Ground Time (>24h) | `mean(groundHours where groundHours >= 24)` | 55h 32m |
| Total Aircraft (period) | `count(distinct aircraftReg where arrival in period)` | 69 |
| Scheduled MH by Customer | `sum(effectiveMH) grouped by customer` | bar chart |
| Aircraft by Type | `count(distinct aircraftReg) grouped by inferredType` | B777: 13 |

#### Combined Bar+Line Chart Specification

- **X-axis**: Hourly time buckets across the selected date range (default 3 days)
- **Y-axis left**: Count (0 to max onGround + 5, auto-scaled)
- **Blue bars** (Recharts `<Bar>`): `arrivalsCount` per hour
- **Pink/Red bars** (Recharts `<Bar>`): `departuresCount` per hour
- **Yellow line** (Recharts `<Line>`): `onGroundCount` per hour, smooth curve (`type="monotone"`)
- **Day separators**: Recharts `<ReferenceLine>` at midnight boundaries
- **Day labels**: "FRIDAY", "SATURDAY", "SUNDAY" above chart
- **Tooltip**: Shows exact counts for all three series on hover

### 6.4 Capacity Modeling (`/capacity`)

```
┌─────────────────────────────────────────────────────────────┐
│ CONFIGURATION PANEL                                          │
│ ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │
│ │ Default MH: 3.0 │ │ Capacity/Person │ │ Shift Config   │ │
│ │ [slider]        │ │ Theory: 8.0h    │ │ Day: 8 people  │ │
│ │                 │ │ Real:   6.5h    │ │ Swing: 6 people│ │
│ │ WP MH: ● Incl  │ │ [sliders]       │ │ Night: 4 people│ │
│ │        ○ Excl   │ │                 │ │ [edit buttons] │ │
│ └─────────────────┘ └─────────────────┘ └────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ UTILIZATION CHART (Recharts stacked bar)                     │
│                                                              │
│ 150% ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ CRITICAL ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│ 120% ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ OVERTIME ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│ 100% ────────────────── TARGET ──────────────────────────── │
│       ████  ████  ████  ████  ████  ████  ████              │
│       Feb13 Feb14 Feb15 Feb16 Feb17 Feb18 Feb19             │
│                                                              │
│ Legend: ■ Demand  □ Surplus Capacity  ─ 100% line           │
├─────────────────────────────────────────────────────────────┤
│ DETAIL TABLE (TanStack Table)                                │
│ Date      │ Demand MH │ Capacity │ Util% │ Surplus │ Flag  │
│ Feb 13    │ 42.5      │ 52.0     │ 81.7% │ +9.5    │       │
│ Feb 14    │ 68.2      │ 52.0     │131.2% │ -16.2   │ 🔴    │
│ Feb 15    │ 55.0      │ 52.0     │105.8% │ -3.0    │ 🟡    │
│ ...       │           │          │       │         │       │
│ EXPAND ROW → By Customer / By Aircraft / By Shift           │
└─────────────────────────────────────────────────────────────┘
```

#### Utilization Chart Colors

| Range | Color | Label |
|-------|-------|-------|
| 0-80% | `#22c55e` (green) | Under-utilized |
| 80-100% | `#3b82f6` (blue) | Optimal |
| 100-120% | `#f59e0b` (amber) | Overtime |
| >120% | `#ef4444` (red) | Critical |

### 6.5 Settings Page (`/settings`)

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                     │
├─────────────────────────────────────────────────────────────┤
│ DEMAND MODEL                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Default MH (no work package): [  3.0  ] hours           │ │
│ │ Work Package MH Inclusion:   (●) Include  (○) Exclude   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ CAPACITY MODEL                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Theoretical Capacity/Person: [  8.0  ] hours/shift      │ │
│ │ Real Capacity/Person:        [  6.5  ] hours/shift      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ SHIFT CONFIGURATION                                          │
│ ┌────────┬───────────┬─────────┬───────────┐               │
│ │ Shift  │ Start     │ End     │ Headcount │               │
│ │ Day    │ 07:00     │ 15:00   │ 8         │ [Edit] [Del] │
│ │ Swing  │ 15:00     │ 23:00   │ 6         │ [Edit] [Del] │
│ │ Night  │ 23:00     │ 07:00   │ 4         │ [Edit] [Del] │
│ └────────┴───────────┴─────────┴───────────┘               │
│ [+ Add Shift]                                                │
│                                                              │
│ DISPLAY                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Default Timeline Window: [  3  ] days                    │ │
│ │ Timezone: [ America/New_York ▼ ]                         │ │
│ │ Theme: (●) Dark  (○) Light  (○) System                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ DATA                                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Import Data: [Choose File] [Import]                      │ │
│ │ Last import: 86 records, Feb 13 2026                     │ │
│ │ Export CSV: [Download]                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Save Changes]                    [Reset to Defaults]        │
└─────────────────────────────────────────────────────────────┘
```

### 6.6 Mobile Responsive Behavior

| Breakpoint | Sidebar | Charts | Gantt | Tables |
|-----------|---------|--------|-------|--------|
| >= 1280px (xl) | Expanded (240px) | Full grid layout | Full width | Full columns |
| >= 768px (md) | Collapsed (64px icons) | 2-col grid | Horizontal scroll | Truncated cols |
| < 768px (sm) | Hidden (Sheet overlay) | Stacked single col | Horizontal scroll, simplified | Card layout |

---

## 7. Capacity Model Formulas

### 7.1 Effective Man-Hours (effectiveMH)

Per work package record:

```
IF manualMHOverride IS NOT NULL:
    effectiveMH = manualMHOverride
    mhSource = "manual"
ELSE IF hasWorkpackage AND totalMH IS NOT NULL:
    IF wpMHInclusionMode === "include":
        effectiveMH = totalMH
        mhSource = "workpackage"
    ELSE:
        effectiveMH = config.defaultMHWhenNoWorkpackage
        mhSource = "default"
ELSE:
    effectiveMH = config.defaultMHWhenNoWorkpackage   // default 3.0
    mhSource = "default"
```

**Example**:
- Record ID 9181: `hasWorkpackage=false`, `totalMH=null` -> `effectiveMH=3.0`, `mhSource="default"`
- Record ID 9133: `hasWorkpackage=true`, `totalMH=40`, `wpMode="include"` -> `effectiveMH=40.0`, `mhSource="workpackage"`
- Record ID 9133 with override=25: -> `effectiveMH=25.0`, `mhSource="manual"`

### 7.2 Daily Demand Apportionment

When an aircraft's ground time spans multiple days, its effectiveMH is apportioned proportionally:

```
For aircraft A on day D:
  dayStart = max(A.arrival, startOfDay(D))
  dayEnd = min(A.departure, endOfDay(D))
  groundHoursToday = (dayEnd - dayStart) / 3600000  // ms to hours
  dailyMH = A.effectiveMH * (groundHoursToday / A.groundHours)
```

**Example**: Aircraft C-FOIJ
- Arrival: Feb 7 05:38, Departure: Feb 9 10:00
- groundHours: 52.37
- effectiveMH: 3.0 (no WP)
- Feb 7: groundHoursToday = 18.37h -> dailyMH = 3.0 * (18.37/52.37) = 1.05
- Feb 8: groundHoursToday = 24.0h -> dailyMH = 3.0 * (24.0/52.37) = 1.38
- Feb 9: groundHoursToday = 10.0h -> dailyMH = 3.0 * (10.0/52.37) = 0.57

### 7.3 Daily Capacity

```
For day D:
  theoreticalCapacity = SUM over shifts S of (S.headcount * config.theoreticalCapacityPerPerson)
  realCapacity = SUM over shifts S of (S.headcount * config.realCapacityPerPerson)
```

**Example** with default config (Day=8, Swing=6, Night=4):
- theoreticalCapacity = (8*8) + (6*8) + (4*8) = 64 + 48 + 32 = 144 MH/day
- realCapacity = (8*6.5) + (6*6.5) + (4*6.5) = 52 + 39 + 26 = 117 MH/day

### 7.4 Utilization

```
utilizationPercent = (totalDemandMH / realCapacityMH) * 100
surplusDeficitMH = realCapacityMH - totalDemandMH
overtimeFlag = utilizationPercent > 100
criticalFlag = utilizationPercent > 120
```

**Example**: Feb 14 demand = 68.2 MH, real capacity = 117 MH
- utilization = (68.2 / 117) * 100 = 58.3%
- surplus = 117 - 68.2 = 48.8 MH
- overtimeFlag = false
- criticalFlag = false

### 7.5 Hourly On-Ground Count

```
For hour H (e.g., Feb 13 15:00 to 16:00):
  onGroundCount = COUNT of packages WHERE arrival < H_end AND departure > H_start
  arrivalsCount = COUNT of packages WHERE arrival >= H_start AND arrival < H_end
  departuresCount = COUNT of packages WHERE departure >= H_start AND departure < H_end
```

### 7.6 KPI: Average Ground Time

```
avgGroundTime_under24 = MEAN(groundHours WHERE groundHours < 24)
avgGroundTime_over24 = MEAN(groundHours WHERE groundHours >= 24)

Format as HH:MM —
  hours = floor(avgHours)
  minutes = round((avgHours - hours) * 60)
```

**Example from dataset**:
- 56 records with groundHours < 24: avg = ~7.17h -> "7:10"
- 30 records with groundHours >= 24: avg = ~35.53h -> "35:32"

---

## 8. Milestones & Definition of Done

### Milestone 0: Project Scaffold (P0 — 2 hours)

**Goal**: Runnable Next.js app with base layout, theme, and navigation.

**Tasks**:
1. Initialize Next.js 15 project with TypeScript, App Router, Tailwind v4
2. Install dependencies: `shadcn/ui`, `next-themes`, `zustand`, `recharts`, `@tanstack/react-table`, `@wx/svelte-gantt` (SVAR)
3. Configure Tailwind with neutral dark color palette
4. Set up Font Awesome webfonts in `public/vendor/fontawesome/`
5. Create root layout with sidebar navigation and theme provider
6. Create 4 page stubs: `/flight-board`, `/dashboard`, `/capacity`, `/settings`
7. Copy `input.json` to `data/input.json`
8. Create `data/config.json` with default values

**Definition of Done**:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes without errors
- [ ] Navigating to all 4 routes renders page stubs
- [ ] Sidebar highlights active route
- [ ] Dark theme active by default
- [ ] Font Awesome icon visible in sidebar (e.g., `fa-plane` for Flight Board)
- [ ] Mobile: sidebar collapses to hamburger menu below 768px

### Milestone 1: Data Pipeline (P0 — 3 hours)

**Goal**: Raw SharePoint JSON is normalized and served via API.

**Tasks**:
1. Define all TypeScript types (`types/*.ts`)
2. Implement `lib/data/reader.ts` — read JSON from filesystem
3. Implement `lib/data/transformer.ts` — normalize SharePoint to WorkPackage
4. Implement `lib/utils/date.ts` — date parsing and timezone helpers
5. Implement `lib/utils/aircraft-type.ts` — registration-to-type inference
6. Implement `GET /api/work-packages` route with filtering
7. Implement `GET/PUT /api/config` route
8. Write unit tests for transformer and aircraft-type inference

**Definition of Done**:
- [ ] `GET /api/work-packages` returns 86 normalized records
- [ ] `GET /api/work-packages?customer=Aerologic` returns 18 records
- [ ] All `groundHours` values are numbers (not strings)
- [ ] All `arrival`/`departure` values are valid ISO date strings in response JSON
- [ ] `effectiveMH` computed correctly: 3.0 for no-WP records, actual MH for WP records
- [ ] Aircraft type inference returns correct types for all 6 customers
- [ ] `GET /api/config` returns default config
- [ ] `PUT /api/config` persists changes to disk
- [ ] Unit tests pass: `npm test`

### Milestone 2: Flight Board (P0 — 4 hours)

**Goal**: Interactive Gantt timeline showing all aircraft.

**Tasks**:
1. Create Zustand store `use-work-packages.ts`
2. Implement `gantt-timeline.tsx` — SVAR React Gantt wrapper
3. Implement `gantt-toolbar.tsx` — date picker, customer filter, zoom
4. Implement `flight-tooltip.tsx` — hover tooltip with flight details
5. Implement `aircraft-sidebar.tsx` — scrollable aircraft list
6. Wire up to API via Zustand store
7. Style Gantt bars with customer colors
8. Add customer filter multi-select (shadcn/ui Select)
9. Add zoom controls (6h/12h/1d/3d/1w)

**Definition of Done**:
- [ ] Gantt displays all 86 work packages as horizontal bars
- [ ] Y-axis shows 57 unique aircraft registrations
- [ ] X-axis shows date/time spanning Feb 7-23 with hour-level ticks
- [ ] Bars colored by customer using `CUSTOMER_COLORS` map
- [ ] Hovering a bar shows tooltip: Reg, Customer, FlightID, Arrival, Departure, Ground Hours, MH, Status
- [ ] Customer filter narrows visible bars
- [ ] Zoom changes time scale
- [ ] Default view: 3-day window starting from today (Feb 13)
- [ ] Bottom legend shows customer color mapping
- [ ] No horizontal scrollbar jank — smooth panning

### Milestone 3: Statistics Dashboard (P0 — 5 hours)

**Goal**: Full statistical dashboard matching the reference design.

**Tasks**:
1. Implement `lib/data/hourly-engine.ts` — hourly snapshot computation
2. Implement `GET /api/hourly-snapshots` route
3. Build `kpi-cards.tsx` — Average Ground Time (split <24h / >24h), Total Aircraft count
4. Build `man-hours-bar-chart.tsx` — horizontal bar chart of scheduled MH by customer
5. Build `aircraft-type-card.tsx` — B777/B767/B747/B737 counts
6. Build `arrivals-departures-chart.tsx` — combined bar+line with Recharts
7. Build `aircraft-donut-chart.tsx` — donut chart of aircraft count by customer
8. Build `mini-gantt.tsx` — compressed Gantt strip at bottom
9. Compose all into dashboard page with grid layout
10. Add date range selector to control dashboard window

**Definition of Done**:
- [ ] KPI: Avg Ground Time shows two values split by <24h and >=24h threshold
- [ ] KPI: Total Aircraft shows count for selected date range
- [ ] Bar chart: Scheduled MH by customer, horizontal bars, sorted descending
- [ ] Aircraft type card: Shows counts for B777, B767, B747, B737
- [ ] Combined chart: Blue arrival bars, pink departure bars, yellow on-ground line
- [ ] Combined chart: Hour-level X-axis with day separators and day name labels
- [ ] Donut chart: Segments sized by aircraft count per customer, labeled with percentages
- [ ] Mini Gantt: Compressed timeline with aircraft labels on bars
- [ ] All charts respond to date range filter
- [ ] Dark navy theme matching reference screenshot
- [ ] Tooltip on all chart elements showing exact values

### Milestone 4: Capacity Modeling (P1 — 4 hours)

**Goal**: Demand vs. capacity analysis with configurable parameters.

**Tasks**:
1. Implement `lib/data/capacity-engine.ts` — demand, capacity, utilization computations
2. Implement `GET /api/capacity` route
3. Create Zustand store `use-capacity.ts`
4. Build `staffing-config.tsx` — shift/headcount configuration UI
5. Build `what-if-panel.tsx` — default MH slider, WP inclusion toggle
6. Build `utilization-chart.tsx` — daily utilization bar chart with threshold lines
7. Build `demand-capacity-table.tsx` — expandable TanStack Table
8. Wire up live recalculation when config changes
9. Add drill-down: expand row to see by-customer and by-aircraft breakdown

**Definition of Done**:
- [ ] Utilization chart shows daily bars colored by utilization range (green/blue/amber/red)
- [ ] Reference lines at 100% and 120% thresholds
- [ ] Table shows: Date, Demand MH, Capacity MH, Utilization %, Surplus/Deficit, Flag
- [ ] Expanding a table row shows per-customer breakdown
- [ ] Changing default MH slider (1-10, step 0.5) recalculates demand in <500ms
- [ ] Toggling WP MH include/exclude recalculates demand
- [ ] Changing shift headcount recalculates capacity
- [ ] All formulas match Section 7 specifications
- [ ] CSV export button downloads utilization data

### Milestone 5: Polish & Responsiveness (P1 — 3 hours)

**Goal**: Production-quality UI across all breakpoints.

**Tasks**:
1. Add loading skeletons to all data-dependent components
2. Add empty states for zero-data scenarios
3. Implement responsive breakpoint behavior per Section 6.6
4. Add keyboard navigation for sidebar
5. Add `<title>` and meta tags per page
6. Performance audit: ensure <500ms render for dashboard
7. Add error boundaries with user-friendly messages
8. Cross-browser test: Chrome, Firefox, Edge

**Definition of Done**:
- [ ] All pages render correctly at 1280px, 768px, and 375px widths
- [ ] Loading states show skeletons (not blank screens)
- [ ] Empty states show helpful messages with FA icons
- [ ] Page titles update per route (e.g., "Flight Board | CVG Maintenance")
- [ ] No console errors or warnings in production build
- [ ] Lighthouse performance score >= 80

### Milestone 6: Data Import & Settings (P2 — 3 hours)

**Goal**: Users can import new data and manage configuration.

**Tasks**:
1. Build settings page UI per Section 6.5 wireframe
2. Implement file upload for JSON/CSV import
3. Add CSV parsing (detect columns, map to schema)
4. Add validation with error reporting
5. Add deduplication by ID/DocumentSetID
6. Implement "Reset to Defaults" for config
7. Add import history/stats display

**Definition of Done**:
- [ ] Upload JSON file re-imports and normalizes data
- [ ] Upload CSV with matching columns works
- [ ] Validation errors displayed inline (missing columns, bad dates, etc.)
- [ ] Duplicate records detected and skipped with count shown
- [ ] Config changes persist across page reloads
- [ ] Reset to Defaults restores all config to initial values
- [ ] Import stats shown: records imported, skipped, date range

---

## 9. Prioritized Backlog

### P0 — Must Have (MVP, Days 1-2)

| ID | Feature | Milestone | Effort |
|----|---------|-----------|--------|
| P0-01 | Next.js project scaffold with Tailwind, shadcn/ui | M0 | 1h |
| P0-02 | Sidebar navigation with Font Awesome icons | M0 | 1h |
| P0-03 | TypeScript type definitions (all entities) | M1 | 0.5h |
| P0-04 | Data transformer (SharePoint -> WorkPackage) | M1 | 1h |
| P0-05 | API route: GET /api/work-packages | M1 | 1h |
| P0-06 | API route: GET/PUT /api/config | M1 | 0.5h |
| P0-07 | Zustand store for work packages | M2 | 0.5h |
| P0-08 | Flight Board Gantt timeline | M2 | 2h |
| P0-09 | Flight Board toolbar (filters, zoom) | M2 | 1h |
| P0-10 | Flight Board tooltip | M2 | 0.5h |
| P0-11 | Dashboard KPI cards | M3 | 1h |
| P0-12 | Dashboard combined bar+line chart | M3 | 2h |
| P0-13 | Dashboard donut chart | M3 | 0.5h |
| P0-14 | Dashboard man-hours bar chart | M3 | 0.5h |
| P0-15 | Dashboard aircraft type card | M3 | 0.5h |
| P0-16 | Hourly snapshot engine + API | M3 | 1h |

### P1 — Should Have (Days 3-4)

| ID | Feature | Milestone | Effort |
|----|---------|-----------|--------|
| P1-01 | Capacity engine (demand/capacity/utilization) | M4 | 2h |
| P1-02 | Capacity API route | M4 | 0.5h |
| P1-03 | Utilization chart | M4 | 1h |
| P1-04 | Demand/capacity detail table with drill-down | M4 | 1.5h |
| P1-05 | What-if panel (sliders, toggles) | M4 | 1h |
| P1-06 | Dashboard mini Gantt | M3 | 1h |
| P1-07 | Responsive layout for all pages | M5 | 1.5h |
| P1-08 | Loading skeletons and empty states | M5 | 1h |
| P1-09 | CSV export from capacity table | M4 | 0.5h |

### P2 — Nice to Have (Days 5+)

| ID | Feature | Milestone | Effort |
|----|---------|-----------|--------|
| P2-01 | Settings page full UI | M6 | 1h |
| P2-02 | JSON/CSV file import | M6 | 1.5h |
| P2-03 | Import validation and dedup | M6 | 1h |
| P2-04 | Manual MH override per record | M4 | 1h |
| P2-05 | Keyboard navigation | M5 | 0.5h |
| P2-06 | Performance optimization | M5 | 1h |
| P2-07 | Unit tests for all engines | M1 | 2h |
| P2-08 | SQLite migration (replace JSON) | Future | 4h |
| P2-09 | Per-record WP MH inclusion toggle | M4 | 1h |
| P2-10 | Shift-level capacity drill-down | M4 | 1h |

---

## 10. File-by-File Implementation Order

Execute in this exact sequence. Each step should result in a working (or at least building) application.

### Phase 1: Scaffold (files 1-12)

```
 1. package.json                    — npm init, add all dependencies
 2. next.config.ts                  — Next.js 15 config (App Router)
 3. tsconfig.json                   — TypeScript config with path aliases
 4. tailwind.config.ts              — Tailwind v4 with neutral dark theme
 5. src/app/globals.css             — Tailwind directives, FA import, CSS vars
 6. public/vendor/fontawesome/      — Copy FA CSS + webfonts here
 7. src/types/config.ts             — AppConfig, ShiftDefinition types
 8. src/types/sharepoint.ts         — Raw SharePoint types
 9. src/types/work-package.ts       — WorkPackage, CustomerName, CUSTOMER_COLORS
10. src/types/capacity.ts           — DailyDemand, DailyCapacity, DailyUtilization, HourlySnapshot
11. src/types/gantt.ts              — GanttTask, GanttScale types
12. src/lib/constants.ts            — Default config values, customer colors, aircraft type rules
```

### Phase 2: Layout (files 13-20)

```
13. src/components/ui/              — Run `npx shadcn@latest init` then add: button, card, badge, select, table, tabs, tooltip, dropdown-menu, sheet, dialog, switch, slider
14. src/components/layout/sidebar.tsx           — Sidebar nav with FA icons
15. src/components/layout/header.tsx            — Top header bar
16. src/components/layout/mobile-nav.tsx        — Mobile Sheet-based nav
17. src/components/layout/theme-toggle.tsx      — Dark/light toggle
18. src/app/layout.tsx                          — Root layout composing sidebar + header + ThemeProvider
19. src/app/page.tsx                            — Redirect to /flight-board
20. src/app/flight-board/page.tsx               — Stub: "Flight Board" heading
    src/app/dashboard/page.tsx                  — Stub: "Dashboard" heading
    src/app/capacity/page.tsx                   — Stub: "Capacity" heading
    src/app/settings/page.tsx                   — Stub: "Settings" heading
```

**Checkpoint**: `npm run dev` — navigate all 4 routes, see sidebar, dark theme, FA icons.

### Phase 3: Data Layer (files 21-30)

```
21. data/config.json                            — Default config JSON file
22. data/input.json                             — Copy from .claude/assets/input.json
23. src/lib/utils/date.ts                       — parseISO, formatDate, formatHoursMinutes, getHourBoundaries, clampToDay
24. src/lib/utils/aircraft-type.ts              — inferAircraftType function
25. src/lib/utils/format.ts                     — formatNumber, formatPercent, formatMH
26. src/lib/data/reader.ts                      — readRawWorkPackages, readConfig, writeConfig
27. src/lib/data/transformer.ts                 — transformWorkPackages, computeEffectiveMH
28. src/lib/data/hourly-engine.ts               — computeHourlySnapshots
29. src/lib/data/capacity-engine.ts             — computeDailyDemand, computeDailyCapacity, computeUtilization
30. src/lib/data/store.ts                       — Thin wrapper: getWorkPackages(filters), getConfig, saveConfig
```

### Phase 4: API Routes (files 31-34)

```
31. src/app/api/work-packages/route.ts          — GET with query filters
32. src/app/api/hourly-snapshots/route.ts       — GET with date range
33. src/app/api/capacity/route.ts               — GET with date range
34. src/app/api/config/route.ts                 — GET + PUT
```

**Checkpoint**: `curl localhost:3000/api/work-packages | jq '.meta'` -> `{ total: 86, filtered: 86 }`

### Phase 5: Zustand Stores (files 35-38)

```
35. src/lib/hooks/use-config.ts                 — Config store with fetch/update
36. src/lib/hooks/use-work-packages.ts          — WorkPackages store with filters
37. src/lib/hooks/use-capacity.ts               — Capacity model store
38. src/lib/hooks/use-filters.ts                — Shared filter state (customer, dateRange)
```

### Phase 6: Shared Components (files 39-43)

```
39. src/components/shared/fa-icon.tsx            — <i className={`fa-solid fa-${name}`} />
40. src/components/shared/customer-badge.tsx     — Colored badge with customer name
41. src/components/shared/date-range-picker.tsx  — Reusable date range selector
42. src/components/shared/loading-skeleton.tsx   — Skeleton cards and chart placeholders
43. src/components/shared/empty-state.tsx        — "No data" with FA icon
```

### Phase 7: Flight Board (files 44-48)

```
44. src/components/flight-board/gantt-timeline.tsx   — SVAR Gantt with data binding
45. src/components/flight-board/gantt-toolbar.tsx     — Filters + zoom controls
46. src/components/flight-board/flight-tooltip.tsx    — Hover card
47. src/components/flight-board/aircraft-sidebar.tsx  — Left panel (if not using SVAR built-in)
48. src/app/flight-board/page.tsx                     — Full page composing above components
```

**Checkpoint**: Flight Board renders 86 bars across 57 rows, colored by customer.

### Phase 8: Statistics Dashboard (files 49-56)

```
49. src/components/dashboard/kpi-cards.tsx               — 3 KPI cards
50. src/components/dashboard/man-hours-bar-chart.tsx      — Horizontal bar chart
51. src/components/dashboard/aircraft-type-card.tsx       — Type counts
52. src/components/dashboard/arrivals-departures-chart.tsx — Combined bar+line
53. src/components/dashboard/aircraft-donut-chart.tsx     — Donut chart
54. src/components/dashboard/mini-gantt.tsx               — Compressed Gantt strip
55. src/app/dashboard/page.tsx                           — Grid layout composing all above
56. (adjust) src/app/globals.css                         — Dashboard-specific dark navy overrides
```

**Checkpoint**: Dashboard shows all 6 chart/card components with real data.

### Phase 9: Capacity View (files 57-62)

```
57. src/components/capacity/staffing-config.tsx     — Shift/headcount editor
58. src/components/capacity/what-if-panel.tsx        — Default MH, WP toggle sliders
59. src/components/capacity/utilization-chart.tsx    — Daily utilization bars
60. src/components/capacity/demand-capacity-table.tsx — TanStack Table with expand
61. src/app/capacity/page.tsx                        — Full page layout
62. (add) CSV export utility in lib/utils/export.ts  — generateCSV helper
```

### Phase 10: Settings & Polish (files 63-66)

```
63. src/app/settings/page.tsx                       — Full settings page
64. src/components/shared/file-upload.tsx            — JSON/CSV file upload component
65. (adjust) All page.tsx files                      — Add loading skeletons, error boundaries
66. (adjust) All components                          — Responsive tweaks per breakpoint table
```

---

## 11. MVP Scope (1-2 Day Build)

### Day 1 Target (8 hours): Scaffold + Data + Flight Board

| Hour | Task | Deliverable |
|------|------|-------------|
| 0-1 | Project scaffold (M0) | Running Next.js app with sidebar |
| 1-2 | Types + constants | All TypeScript interfaces defined |
| 2-3 | Data layer: reader + transformer | Normalized WorkPackage array |
| 3-4 | API routes: work-packages + config | Endpoints returning data |
| 4-5 | Zustand stores | Client state management wired |
| 5-7 | Flight Board Gantt + toolbar | Interactive Gantt timeline |
| 7-8 | Flight Board tooltip + polish | Complete Flight Board page |

**Day 1 deliverable**: Working Flight Board showing all 86 work packages as colored Gantt bars with customer filtering and hover tooltips.

### Day 2 Target (8 hours): Statistics Dashboard + Capacity Basics

| Hour | Task | Deliverable |
|------|------|-------------|
| 0-1 | Hourly engine + API | Hourly snapshot data |
| 1-2 | KPI cards + aircraft type card | Top-left dashboard section |
| 2-4 | Combined bar+line chart | Main dashboard visualization |
| 4-5 | Donut chart + MH bar chart | Right and left dashboard panels |
| 5-6 | Dashboard page composition | Full dashboard grid layout |
| 6-7 | Capacity engine + API | Demand/capacity calculations |
| 7-8 | Basic utilization chart + table | Capacity page with core features |

**Day 2 deliverable**: Complete Statistics Dashboard with all charts, plus basic Capacity view with utilization chart and data table.

### MVP Exclusions (deferred to P1/P2)

- Mini Gantt on dashboard (P1)
- Drill-down in capacity table (P1)
- CSV/JSON import (P2)
- Settings page beyond basic config display (P2)
- Manual MH overrides per record (P2)
- Per-record WP MH inclusion toggle (P2)
- Unit tests (P2)
- Mobile responsive polish (P1)
- Loading skeletons and empty states (P1)

---

## 12. Assumptions

| # | Assumption | Impact if Wrong | Mitigation |
|---|-----------|-----------------|------------|
| A1 | `input.json` format matches SharePoint OData response exactly | Data pipeline breaks | Validate first 3 records on import; log schema mismatches |
| A2 | All 86 records have valid Arrival and Departure dates | Gantt rendering fails | Filter out records with null/invalid dates, show warning |
| A3 | `TotalGroundHours` string always parses to valid float | NaN in calculations | Default to 0 if `parseFloat` returns NaN; log warning |
| A4 | Aircraft type can be inferred from registration prefix + customer | Wrong type counts | Make inference rules configurable; allow manual override |
| A5 | SVAR React Gantt MIT edition supports custom bar colors via CSS | Gantt bars all same color | Fall back to CSS class injection or custom renderer |
| A6 | CVG timezone is America/New_York (Eastern Time) | Time display off | Make timezone configurable in settings |
| A7 | Font Awesome Free includes all needed icons (plane, chart-bar, gear, etc.) | Missing icons | Use Lucide as fallback for any missing FA icons |
| A8 | Dataset represents a typical 2-week operational window | Dashboard designed for wrong scale | Make date range user-selectable |
| A9 | User has Node.js 18+ installed | Build may fail | Document minimum Node version in README |
| A10 | shadcn/ui chart component wraps Recharts correctly for combined bar+line | Chart rendering issues | Use Recharts directly if shadcn/ui wrapper is limiting |

---

## 13. Open Questions

| # | Question | Default If Unanswered | Impact |
|---|----------|----------------------|--------|
| Q1 | Which Font Awesome edition is downloaded (Free or Pro)? | Assume Free | Icon availability |
| Q2 | Is there a mapping table for aircraft registration -> aircraft type? | Use inference rules in Section 3.3 | Aircraft type accuracy |
| Q3 | Should "IsNotClosedOrCanceled = 0" records be hidden or shown differently? | Show with reduced opacity + strikethrough | UX clarity |
| Q4 | Are shifts fixed (Day/Swing/Night) or do they vary by day of week? | Fixed for v0, configurable later | Capacity accuracy |
| Q5 | What is the source timezone for Arrival/Departure? | UTC (ISO strings end in Z) | Time display |
| Q6 | Should the dashboard auto-refresh or only on manual reload? | Manual reload for v0 | UX expectations |
| Q7 | Are there additional data fields expected in future SP exports? | Build transformer to ignore unknown fields | Forward compatibility |
| Q8 | What is the expected update frequency for the data? | Weekly import for v0 | Data freshness |
| Q9 | Should CargoJet's Canadian fleet show "Singapore" label as in reference? | Use "CargoJet Airways" consistently | Labeling accuracy |
| Q10 | Is the 3-day default window (Fri-Mon) a business requirement? | Configurable, default to 3 days from today | Dashboard scope |

---

## 14. Acceptance Criteria

### Flight Board

1. **AC-FB-01**: Page loads in < 2 seconds with 86 records
2. **AC-FB-02**: All 57 unique aircraft appear as Y-axis rows
3. **AC-FB-03**: Bar width accurately reflects ground time duration (proportional to hours)
4. **AC-FB-04**: Each of the 6 customers has a distinct, consistent color across all views
5. **AC-FB-05**: Tooltip displays at minimum: Registration, Customer, Flight ID, Arrival (formatted), Departure (formatted), Ground Hours (Xh Ym), Status
6. **AC-FB-06**: Customer multi-select filter hides/shows bars instantly
7. **AC-FB-07**: Zoom levels change the visible time window without losing bar accuracy

### Statistics Dashboard

8. **AC-SD-01**: KPI "Average Ground Time" shows two separate values: one for stays < 24h, one for >= 24h, formatted as H:MM
9. **AC-SD-02**: KPI "Total Aircraft" shows count of unique registrations in selected date range
10. **AC-SD-03**: "Scheduled Man Hours" bar chart shows one horizontal bar per customer, value = sum of effectiveMH
11. **AC-SD-04**: "Total Aircraft By Type" shows counts that sum to the total unique aircraft count
12. **AC-SD-05**: Combined chart Y-axis max accommodates the highest on-ground count (peak ~30)
13. **AC-SD-06**: Combined chart X-axis spans selected date range at hourly granularity
14. **AC-SD-07**: Day separators (dashed vertical lines) appear at midnight boundaries
15. **AC-SD-08**: Donut chart segments sum to 100% and match customer distribution

### Capacity Modeling

16. **AC-CM-01**: Default MH slider adjusts from 0.5 to 10.0 in 0.5 increments
17. **AC-CM-02**: Changing any input recalculates all outputs within 500ms
18. **AC-CM-03**: Utilization chart uses 4-tier color coding (green < 80%, blue 80-100%, amber 100-120%, red > 120%)
19. **AC-CM-04**: Table sorts by any column
20. **AC-CM-05**: Capacity formula uses real (not theoretical) capacity for utilization percentage

### General

21. **AC-GN-01**: Application runs entirely locally with `npm run dev` — no external API calls at runtime
22. **AC-GN-02**: Dark theme is default; light theme available via toggle
23. **AC-GN-03**: No console errors in production build
24. **AC-GN-04**: All data calculations use UTC internally; display in configured timezone

---

## 15. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **R1**: SVAR React Gantt MIT edition missing needed features (custom colors, tooltips, zoom) | Medium | High — would need to rewrite Gantt | Spike test SVAR in first 30 min of M2; fallback: build custom Gantt with plain `<div>` bars + CSS Grid (2h extra) |
| **R2**: Recharts combined bar+line chart has rendering issues with dual Y-axis | Low | Medium — chart displays incorrectly | Use single Y-axis (count) for all three series; only split if scale differs >10x |
| **R3**: 86 records with hourly granularity over 16 days = ~384 hourly data points | Low | Low — performance fine | Pre-compute on server, cache in API response |
| **R4**: Aircraft type inference is wrong for some registrations | High | Low — cosmetic issue only | Show "Unknown" type; make rules editable in settings |
| **R5**: `TotalGroundHours` string parsing fails for edge cases | Low | Medium — NaN propagates | Add explicit NaN check; default to `(departure - arrival) / 3600000` as fallback |
| **R6**: Font Awesome webfont paths break in production build | Medium | Low — icons missing | Test with `npm run build && npm start` early; use relative paths in CSS |
| **R7**: Tailwind v4 breaking changes from v3 syntax | Medium | Medium — styles don't apply | Reference Tailwind v4 migration guide; use `@import "tailwindcss"` syntax |
| **R8**: next-themes flash of unstyled content (FOUC) on initial load | Medium | Low — visual glitch | Use `suppressHydrationWarning` on `<html>`, set `attribute="class"` |
| **R9**: Zustand store hydration mismatch with SSR | Medium | Medium — hydration errors | Use `skipHydration` option; fetch data client-side only via `useEffect` |
| **R10**: Large JSON file read on every API call is slow | Low | Low — 86 records is tiny | Cache parsed data in module-level variable; invalidate on import |

---

## Appendix A: Dependency Installation Commands

```bash
# Initialize Next.js 15 project
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Core UI
npx shadcn@latest init
npx shadcn@latest add button card badge select table tabs tooltip dropdown-menu sheet dialog switch slider chart

# Additional dependencies
npm install zustand next-themes recharts @tanstack/react-table
npm install @wx/react-gantt  # SVAR React Gantt (verify exact package name)

# Dev dependencies
npm install -D @types/node
```

## Appendix B: Color Token Reference (Tailwind v4 Neutral Dark)

```css
/* globals.css — CSS custom properties for neutral dark theme */
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 96.1%;
  --secondary-foreground: 0 0% 9%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 89.8%;
  --input: 0 0% 89.8%;
  --ring: 0 0% 3.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 0 0% 3.9%;         /* #09090b equivalent */
  --foreground: 0 0% 98%;
  --card: 0 0% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;
  --secondary: 0 0% 14.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 0 0% 14.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 0 0% 83.1%;
}

/* Dashboard-specific navy override (applied via data attribute or class) */
.dashboard-theme {
  --card: 232 47% 13%;              /* dark navy for dashboard cards */
  --card-foreground: 0 0% 98%;
}
```

## Appendix C: Customer Color Constants

```typescript
// lib/constants.ts
export const CUSTOMER_COLORS = {
  "CargoJet Airways":    { bg: "#22c55e", text: "#ffffff", label: "CargoJet" },
  "Aerologic":           { bg: "#8b5cf6", text: "#ffffff", label: "Aerologic" },
  "Kalitta Air":         { bg: "#f97316", text: "#ffffff", label: "Kalitta Air" },
  "DHL Air UK":          { bg: "#ef4444", text: "#ffffff", label: "DHL Air UK" },
  "Kalitta Charters II": { bg: "#06b6d4", text: "#ffffff", label: "Kalitta Chrt II" },
  "21 Air":              { bg: "#ec4899", text: "#ffffff", label: "21 Air" },
} as const;

export const AIRCRAFT_TYPE_DISPLAY_ORDER: AircraftType[] = [
  "B777", "B767", "B747", "B737"
];

export const DEFAULT_CONFIG: AppConfig = {
  defaultMHWhenNoWorkpackage: 3.0,
  wpMHGlobalInclusionMode: "include",
  theoreticalCapacityPerPerson: 8.0,
  realCapacityPerPerson: 6.5,
  headcount: {
    shifts: [
      { name: "Day",   startHour: 7,  endHour: 15, headcount: 8 },
      { name: "Swing", startHour: 15, endHour: 23, headcount: 6 },
      { name: "Night", startHour: 23, endHour: 7,  headcount: 4 },
    ],
    defaultHeadcountPerShift: 8,
  },
  timelineDefaultDays: 3,
  timezoneName: "America/New_York",
  theme: "dark",
  aircraftTypeRules: DEFAULT_AIRCRAFT_TYPE_RULES,
  dataFilePath: "data/work-packages.json",
};
```

## Appendix D: SVAR React Gantt Configuration

```typescript
// components/flight-board/gantt-timeline.tsx — key config
const ganttConfig = {
  scales: [
    { unit: "day", step: 1, format: "EEE, MMM d" },    // "Fri, Feb 13"
    { unit: "hour", step: 3, format: "HH:mm" },         // "07:00"
  ],
  columns: [
    { name: "text", label: "Aircraft", width: 100 },
  ],
  cellWidth: 40,        // pixels per hour (adjusts with zoom)
  cellHeight: 28,       // row height
  start: startDate,     // from date range filter
  end: endDate,         // from date range filter
};

// Task data mapping
function toGanttTasks(packages: WorkPackage[]): GanttTask[] {
  return packages.map(pkg => ({
    id: pkg.id,
    text: pkg.aircraftReg,
    start: pkg.arrival,
    end: pkg.departure,
    type: "task",
    customer: pkg.customer,
    flightId: pkg.flightId,
    progress: 0,
    // CSS class for coloring: `gantt-bar-${customerToSlug(pkg.customer)}`
  }));
}
```

---

*End of FINAL-PLAN.md*
