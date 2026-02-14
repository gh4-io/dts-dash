# REQ: Data Import

> **What changed and why (2026-02-13):** Extracted from REQ_Admin.md into a standalone spec per PASS 2 re-plan. Data import is a cross-cutting concern (affects data layer, admin UI, logging, and analytics), so it warrants its own document.
> MVP + vNext scoped. Linked: D-016, OI-004 (resolved), R15.

---

## Overview

Data enters the system from SharePoint OData exports. MVP supports two import mechanisms; vNext adds automation.

| Mechanism | Scope | Access | Description |
|-----------|-------|--------|-------------|
| File ingest | MVP | Admin | Load JSON file from local filesystem |
| Paste JSON | MVP | Admin | Paste raw OData JSON into Admin UI |
| Secure POST | vNext | API key | Authenticated HTTP endpoint for Power Automate |

## MVP: File Ingest

**Current behavior**: Application reads `data/input.json` on startup and caches in memory. No live connection to SharePoint.

**Setup**: Copy OData export to `data/input.json`. The data layer reads on first API request and caches at module level.

## MVP: Admin Paste JSON (`/admin/import`)

### Layout
```
+----------------------------------------------------------+
| Data Import                                                |
+----------------------------------------------------------+
| TABS: [File Upload] [Paste JSON]                           |
+----------------------------------------------------------+
| [File Upload tab]:                                         |
|   Drag & drop or click to select JSON file                 |
|   Accepted: .json (OData format)                           |
|                                                            |
| [Paste JSON tab]:                                          |
|   +----------------------------------------------+        |
|   | (textarea -- paste JSON here)                 |        |
|   +----------------------------------------------+        |
|   [Validate & Preview]                                     |
+----------------------------------------------------------+
| PREVIEW (after validation):                                |
|   [check] 86 records parsed                                |
|   [check] 6 customers, 57 aircraft                         |
|   [check] Date range: Feb 7-23, 2026                       |
|   [warn] 66 records missing TotalMH (will use default 3.0) |
|   [warn] 3 unknown aircraft types (will map to "Unknown")  |
|                                               [Import]     |
+----------------------------------------------------------+
| IMPORT HISTORY:                                            |
|   2026-02-13 14:30 -- 86 records, admin@cvg.local          |
|   ...                                                      |
+----------------------------------------------------------+
```

### Validation Flow

1. **Parse JSON** — verify OData structure (`{ "odata.metadata": ..., "value": [...] }`) or bare array
2. **Schema validation** — each record against `SharePointWorkPackage` interface
3. **Report** — record count, customer count, aircraft count, date range, missing fields, type mapping coverage
4. **User reviews** preview → clicks "Import" to commit
5. **Commit** — validated data written to `data/input.json` (overwrites previous)
6. **Log** — import logged to `import_log` SQLite table
7. **Cache invalidation** — server-side module cache cleared; clients re-fetch on next request

### Validation Rules

| Check | Pass | Fail |
|-------|------|------|
| JSON parseable | Continue | Error: "Invalid JSON" |
| Has `value` array or is array | Continue | Error: "Expected OData format or JSON array" |
| Each record has `Aircraft.Title` | Continue | Warning: "N records missing aircraft registration" |
| Each record has `Arrival` + `Departure` | Continue | Error: "Records must have arrival and departure dates" |
| Date range reasonable (not future >1yr) | Continue | Warning: "Date range extends beyond 1 year" |
| File size ≤ 10MB | Continue | Error: "File exceeds 10MB limit" |

### API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/admin/import/validate` | Parse + validate without importing |
| `POST` | `/api/admin/import/commit` | Write validated data to `data/input.json` + log |
| `GET` | `/api/admin/import/history` | Import history (paginated) |

### Import Log (SQLite `import_log` table)

```typescript
interface ImportLogEntry {
  id: string;                        // UUID
  userId: string;                    // Who imported
  source: "file_upload" | "paste_json" | "api_ingest";
  recordCount: number;
  customerCount: number;
  aircraftCount: number;
  dateRangeStart: string;            // Earliest arrival
  dateRangeEnd: string;              // Latest departure
  warnings: string[];                // JSON-serialized
  timestamp: Date;
}
```

## vNext: Secure POST Endpoint

A future authenticated endpoint at `/api/ingest` for Power Automate HTTP requests:

- **Auth**: Bearer token (API key stored in environment variable)
- **Rate limit**: 1 request/minute
- **Audit**: Full import logging (same as admin import)
- **Validation**: Same schema validation as admin import
- **Status**: Documented as vNext stub — **no implementation in v1**

**Note (D-016)**: Do not assume premium Power Automate. The secure POST is a simple authenticated HTTP endpoint that any automation tool can call.

## Files

| File | Purpose |
|------|---------|
| `src/app/admin/import/page.tsx` | Data import page |
| `src/components/admin/data-import.tsx` | File upload, paste JSON, preview, commit |
| `src/app/api/admin/import/validate/route.ts` | Validation API |
| `src/app/api/admin/import/commit/route.ts` | Commit API |
| `src/app/api/admin/import/history/route.ts` | History API |
| `src/lib/db/schema.ts` | `import_log` table schema |

## Links

- [DECISIONS.md](../DECISIONS.md) D-016
- [OPEN_ITEMS.md](../OPEN_ITEMS.md) OI-004 (resolved)
- [RISKS.md](../DEV/RISKS.md) R15
- [REQ_Admin.md](REQ_Admin.md) — Admin section navigation
- [REQ_Logging_Audit.md](REQ_Logging_Audit.md) — Import logging detail
- [REQ_Analytics.md](REQ_Analytics.md) — `data_import` event tracking
