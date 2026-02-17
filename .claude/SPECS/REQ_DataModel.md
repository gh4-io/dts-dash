# REQ: Data Model

> Authoritative source for all TypeScript types and schemas.
> Full definitions in `/plan/FINAL-PLAN.md` Section 3.

## Core Types

### SharePointWorkPackage (Raw Input)
```typescript
// src/types/sharepoint.ts — shape of each record in input.json
interface SharePointWorkPackage {
  ID: number;
  DocumentSetID: number;
  Aircraft: { Title: string };        // Registration e.g. "C-FOIJ"
  AircraftId: number;
  Customer: string;                    // e.g. "CargoJet Airways"
  FlightId: string | null;
  Arrival: string;                     // ISO 8601 UTC
  Departure: string;                   // ISO 8601 UTC
  TotalMH: number | null;             // ⚠️ null for 66/86 records
  TotalGroundHours: string;           // ⚠️ STRING, must parseFloat()
  Workpackage_x0020_Status: "New" | "Approved";
  HasWorkpackage: boolean;
  WorkpackageNo: string | null;
  CalendarComments: string | null;     // HTML
  IsNotClosedOrCanceled: "1" | "0";   // ⚠️ STRING, not boolean
  Modified: string;
  Created: string;
}
```

### WorkPackage (Normalized)
```typescript
// src/types/work-package.ts
interface WorkPackage {
  id: number;
  documentSetId: number;
  aircraftReg: string;
  aircraftId: number;
  customer: CustomerName;
  flightId: string | null;
  arrival: Date;
  departure: Date;
  totalMH: number | null;
  groundHours: number;                 // PARSED from string
  status: "New" | "Approved";
  hasWorkpackage: boolean;
  workpackageNo: string | null;
  calendarComments: string | null;
  isActive: boolean;                   // IsNotClosedOrCanceled === "1"
  modified: Date;
  created: Date;
  // Computed:
  effectiveMH: number;
  mhSource: "workpackage" | "default" | "manual";
  manualMHOverride: number | null;
  inferredType: AircraftType;
}
```

### Supporting Types
```typescript
type CustomerName = "CargoJet Airways" | "Aerologic" | "Kalitta Air"
  | "DHL Air UK" | "Kalitta Charters II" | "21 Air";

type AircraftType = "B777" | "B767" | "B747" | "B757" | "B737" | "Unknown";
```

### Filter Types
See [REQ_Filters.md](REQ_Filters.md) → TypeScript Types section.

### Capacity Types
```typescript
interface DailyDemand {
  date: string;
  totalDemandMH: number;
  aircraftCount: number;
  byCustomer: Record<CustomerName, number>;
}

interface DailyCapacity {
  date: string;
  theoreticalCapacityMH: number;
  realCapacityMH: number;
  byShift: ShiftCapacity[];
}

interface DailyUtilization {
  date: string;
  utilizationPercent: number;
  surplusDeficitMH: number;
  overtimeFlag: boolean;
  criticalFlag: boolean;
}

interface HourlySnapshot {
  hour: string;            // ISO datetime for hour boundary
  arrivalsCount: number;
  departuresCount: number;
  onGroundCount: number;
}
```

### AppConfig
```typescript
interface AppConfig {
  defaultMHWhenNoWorkpackage: number;        // Default: 3.0
  wpMHGlobalInclusionMode: "include" | "exclude";
  theoreticalCapacityPerPerson: number;      // Default: 8.0
  realCapacityPerPerson: number;             // Default: 6.5
  headcount: { shifts: ShiftDefinition[]; defaultHeadcountPerShift: number };
  timelineDefaultDays: number;               // Default: 3
  timezoneName: string;                      // Default: "UTC"
  theme: "dark" | "light" | "system";
  aircraftTypeRules: AircraftTypeMapping[];
  dataFilePath: string;                      // Default: "data/work-packages.json"
}
```

### Aircraft Type Mapping (Admin-Editable — D-015)

```typescript
// src/types/aircraft-type.ts — stored in SQLite `aircraft_type_mappings` table
interface AircraftTypeMapping {
  id: string;                         // UUID
  pattern: string;                    // Regex or prefix pattern, e.g. "747", "747-4R7F", "B747"
  canonicalType: AircraftType;        // Normalized output, e.g. "B747"
  description: string | null;         // Optional note, e.g. "747-400F freighter variant"
  priority: number;                   // Higher = matched first (specific patterns before broad)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Canonical types**: `B777`, `B767`, `B747`, `B757`, `B737` (and `Unknown` as fallback).

**Normalization service** (`src/lib/utils/aircraft-type.ts`):

```typescript
interface NormalizedAircraftType {
  canonical: AircraftType;            // "B747"
  raw: string;                        // Original input: "747-4R7F"
  confidence: "exact" | "pattern" | "fallback";
  mappingId: string | null;           // Which mapping rule matched
}

function normalizeAircraftType(
  rawType: string,
  mappings: AircraftTypeMapping[]
): NormalizedAircraftType;
```

**Resolution order**: exact match → pattern match (descending priority) → `Unknown` fallback.

**Non-standard inputs handled**: `737-200`, `747-4R7F`, `747F`, `767-300ER`, `B777-200LR`, bare `777`, etc.

### Paginated Response (D-017)

```typescript
// src/types/pagination.ts
interface PaginationParams {
  page?: number;                      // 1-based, default 1
  pageSize?: number;                  // Default 30, max 200
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;                    // Total matching records
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}
```

**Table views** (Capacity detail, Admin user list) use pagination. **Charts and Gantt** always receive full filtered datasets (no pagination for visualization endpoints).

### Customer (Admin-Configurable Colors)
```typescript
// src/types/customer.ts — stored in SQLite
interface Customer {
  id: string;                  // UUID
  name: string;                // "CargoJet Airways" — matches work package Customer field
  displayName: string;         // "CargoJet" — short form for charts/legends
  color: string;               // Hex, e.g. "#22c55e"
  colorText: string;           // Auto-calculated contrast text color
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```
See [REQ_Admin.md](REQ_Admin.md) for customer color management.

### User & Auth
```typescript
// src/types/user.ts — stored in SQLite
interface User {
  id: string;                  // UUID
  email: string;               // Unique login identifier
  displayName: string;
  passwordHash: string;
  role: "user" | "admin" | "superadmin";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPreferences {
  userId: string;
  colorMode: "light" | "dark" | "system";
  themePreset: "classic" | "ocean" | "lavender" | "midnight";  // D-018
  accentColor: string | null;          // Hex override or null = use preset
  compactMode: boolean;
  defaultTimezone: string;             // IANA timezone
  defaultDateRange: "1d" | "3d" | "1w";
  tablePageSize: number;               // Default 30 (D-017)
}
```
See [REQ_Auth.md](REQ_Auth.md) and [REQ_Account.md](REQ_Account.md) for full specs.

## Data Storage

### Data Storage

All runtime data stored in SQLite `data/dashboard.db` — local-first, zero-config, included in `.gitignore`.

| Table | Purpose | Key Changes (D-029) |
|-------|---------|---------------------|
| `work_packages` | Work package data (was `data/input.json`) | **D-029**: Moved from file to DB. UPSERT by GUID. Auto-increment PK, SP ID as alternate unique key. |
| `mh_overrides` | Manual MH overrides | **D-029**: FK now references `work_packages.id` (was broken, keyed by non-existent SP ID) |
| `app_config` | System configuration | Key-value store for settings |
| `customers` | Customer master data | Admin-editable, color-coded |
| `users` | User accounts | Auth.js integration |
| `sessions` | User sessions | Auth.js session store |
| `user_preferences` | Per-user settings | Theme, timezone, pagination |
| `aircraft_type_mappings` | Aircraft type normalization | Regex patterns → canonical types |
| `manufacturers` | Aircraft manufacturers | Master data |
| `aircraft_models` | Aircraft models | Master data |
| `engine_types` | Engine types | Master data |
| `aircraft` | Aircraft registry | Master data with fuzzy operator matching |
| `import_log` | Work package import history | Tracks imports (file, paste, API, CLI) |
| `master_data_import_log` | Customer/aircraft import history | Separate from work package imports (OI-039) |
| `analytics_events` | Usage tracking events | User behavior analytics |

## Data Warnings
- `TotalGroundHours` is a **STRING** → `parseFloat()` required, default 0 if NaN
- `TotalMH` is **null** for 66/86 records → effectiveMH defaults to 3.0
- `IsNotClosedOrCanceled` is `"1"` or `"0"` → boolean conversion required
- All dates are UTC (Z suffix) → parse with `new Date()` directly
