# REQ: Aircraft Type Normalization & Mapping

> **What changed and why (2026-02-13):** Extracted from REQ_Admin.md and REQ_DataModel.md into a standalone spec per PASS 2 re-plan. Aircraft type handling is a cross-cutting concern (affects data layer, admin UI, filters, and analytics), so it warrants its own document.
> MVP scope. Linked: D-015, OI-003, R4, R14.

---

## Overview

Aircraft types in inbound data are non-standard. A normalization service resolves raw type strings to canonical types using an admin-editable mapping dataset stored in SQLite.

**Canonical Types**: `B777`, `B767`, `B747`, `B757`, `B737` (and `"Unknown"` only when no type data whatsoever is available).

**Principle**: Type is sourced from inbound data. Do not rely on registration-prefix inference as primary logic. Preserve both raw and normalized type. The `aircraft_type_mappings` table is an optional refinement — types are filterable and countable even without any mapping rules (raw strings appear as-is).

## Data Model

### AircraftTypeMapping (SQLite `aircraft_type_mappings` table)

```typescript
// src/types/aircraft-type.ts
interface AircraftTypeMapping {
  id: string;                         // UUID
  pattern: string;                    // Regex or prefix pattern, e.g. "747", "747-4R7F", "B747"
  canonicalType: AircraftType;        // Normalized output, e.g. "B747"
  description: string | null;         // Optional note, e.g. "747-400F freighter variant"
  priority: number;                   // Higher = matched first (specific before broad)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type AircraftType = "B777" | "B767" | "B747" | "B757" | "B737" | "Unknown";
```

### NormalizedAircraftType (normalization result)

```typescript
interface NormalizedAircraftType {
  canonical: string;                          // "B747" if mapped, raw string if not, "Unknown" if no data
  raw: string;                                // Original input: "747-4R7F"
  confidence: "exact" | "pattern" | "raw" | "fallback";
  mappingId: string | null;                   // Which mapping rule matched (null if raw/fallback)
}
```

**Confidence levels**:
| Level | Meaning |
|-------|---------|
| `"exact"` | Exact pattern match (case-insensitive) |
| `"pattern"` | Glob-wildcard pattern match |
| `"raw"` | No mapping match — raw string returned as-is (D-032) |
| `"fallback"` | No type data at all — `"Unknown"` returned |

## Normalization Service

**File**: `src/lib/utils/aircraft-type.ts`

```typescript
function normalizeAircraftType(
  rawType: string,
  mappings: AircraftTypeMapping[]
): NormalizedAircraftType;
```

**Type resolution priority chain** (in `transformer.ts`):
1. `aircraft` master data table — `aircraft.aircraft_type` (populated from ac.json `field_5` during import)
2. WP-level `Aircraft.field_5` (raw type from work package record)
3. WP-level `Aircraft.AircraftType` (fallback WP field)
4. `null` → normalizer runs with empty input → returns `"Unknown"` with `"fallback"` confidence

**Within the normalizer, resolution order**: exact match → pattern match (descending priority) → raw string fallback (D-032). `"Unknown"` only when the input itself was null/empty.

**Non-standard inputs handled**: `737-200`, `747-4R7F`, `747F`, `767-300ER`, `B777-200LR`, bare `777`, etc.

## Seed Data (Default Mapping Rules)

| Pattern | Canonical | Description | Priority |
|---------|-----------|-------------|----------|
| `B777*` | B777 | Boeing 777 variants | 100 |
| `777*` | B777 | Bare 777 prefix | 90 |
| `B767*` | B767 | Boeing 767 variants | 100 |
| `767*` | B767 | Bare 767 prefix | 90 |
| `B747*` | B747 | Boeing 747 variants | 100 |
| `747*` | B747 | Bare 747 prefix | 90 |
| `B757*` | B757 | Boeing 757 variants | 100 |
| `757*` | B757 | Bare 757 prefix | 90 |
| `B737*` | B737 | Boeing 737 variants | 100 |
| `737*` | B737 | Bare 737 prefix | 90 |

Patterns are case-insensitive. Glob-style `*` matches any suffix.

## Admin UI (`/admin/aircraft-types`)

### Layout
```
+----------------------------------------------------------+
| Aircraft Type Mapping                    [+ Add Rule]      |
+----------------------------------------------------------+
| Pattern       | Canonical | Description        | Actions   |
| 747*          | B747      | All 747 variants   | [Edit][x] |
| 747-4R7F      | B747      | Freighter variant  | [Edit][x] |
| 767*          | B767      | All 767 variants   | [Edit][x] |
| 757*          | B757      | All 757 variants   | [Edit][x] |
| 777*          | B777      | All 777 variants   | [Edit][x] |
| 737*          | B737      | All 737 variants   | [Edit][x] |
| ...                                                        |
+----------------------------------------------------------+
| Test: [input field] -> Result: B747 (pattern, 95%)         |
|                                         [Reset Defaults]   |
+----------------------------------------------------------+
```

### Behavior
- **Pattern**: Glob-style or regex, matched case-insensitively against raw aircraft type
- **Priority**: Higher priority rows match first. Specific patterns above broad ones.
- **Test input**: Real-time field — type a raw string, see which rule matches
- **Seed data**: Pre-populated with defaults (table above)
- **Reset Defaults**: Restores seed mapping rules

### API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/admin/aircraft-types` | List all mapping rules |
| `PUT` | `/api/admin/aircraft-types` | Bulk update rules |
| `POST` | `/api/admin/aircraft-types` | Add new rule |
| `DELETE` | `/api/admin/aircraft-types/:id` | Remove rule |
| `POST` | `/api/admin/aircraft-types/test` | Test a raw string against rules |

## Integration Points

- **Data layer** (`src/lib/data/transformer.ts`): calls `normalizeAircraftType()` during work package transformation
- **FilterBar** (REQ_Filters.md §7): Type multi-select uses canonical types
- **Flight Board** (REQ_FlightBoard.md): `inferredType` → `normalizedType` on WorkPackage
- **Dashboard** (REQ_OtherPages.md): KPI-04 (Aircraft By Type) uses canonical types
- **Admin UI** (REQ_Admin.md): Aircraft Types tab
- **Analytics** (REQ_Analytics.md): KPI-21 (Avg Turnaround by Type) uses canonical types

## Files

| File | Purpose |
|------|---------|
| `src/types/aircraft-type.ts` | AircraftTypeMapping, NormalizedAircraftType types |
| `src/lib/utils/aircraft-type.ts` | `normalizeAircraftType()` service |
| `src/lib/db/schema.ts` | `aircraft_type_mappings` table schema |
| `src/lib/db/seed.ts` | Default mapping rules |
| `src/app/admin/aircraft-types/page.tsx` | Admin mapping editor page |
| `src/components/admin/aircraft-type-editor.tsx` | Editor component with test input |
| `src/app/api/admin/aircraft-types/route.ts` | Mapping CRUD API |
| `src/app/api/admin/aircraft-types/test/route.ts` | Test endpoint |

## Links

- [DECISIONS.md](../DECISIONS.md) D-015
- [OPEN_ITEMS.md](../OPEN_ITEMS.md) OI-003
- [RISKS.md](../DEV/RISKS.md) R4, R14
- [REQ_DataModel.md](REQ_DataModel.md) — AircraftType union, WorkPackage.inferredType
- [REQ_Admin.md](REQ_Admin.md) — Admin section navigation
