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
| Secure POST | **Implemented** (D-026) | API key | Authenticated HTTP endpoint for Power Automate |

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

## Secure POST Endpoint (`/api/ingest`) — Implemented (D-026)

Authenticated HTTP POST endpoint for external automation (Power Automate, curl, etc.).

### Request

```
POST /api/ingest
Authorization: Bearer <api-key-from-admin-settings>
Content-Type: application/json
Idempotency-Key: <optional-client-uuid>

{ "odata.metadata": "...", "value": [ {...}, {...} ] }
```

### Authentication

- **API key** stored in SQLite `app_config` table (`ingestApiKey` key) — admin-rotatable via Admin Settings without restart
- **Verification**: `crypto.timingSafeEqual` constant-time comparison
- If no key configured → 503 "Ingress endpoint not configured"
- Missing/malformed `Authorization: Bearer ...` → 401
- Invalid key → 403

### Rate Limiting

- In-memory Map keyed by `sha256(apiKey)` — raw key never stored in limiter
- Per-key buckets (future-proof for multiple keys)
- Configurable window via `ingestRateLimitSeconds` in `app_config` (default 60s)
- Exceeded → 429 with `Retry-After` header

### Idempotency

- Optional `Idempotency-Key` header → stored in `importLog.idempotencyKey` column
- 24-hour dedup window: if matching key found in recent logs, returns cached result (same logId, `idempotent: true`)
- Prevents duplicate imports on Power Automate retries

### Size Limit

- Configurable via `ingestMaxSizeMB` in `app_config` (default 50MB)
- Exceeded → 413 "Payload exceeds N MB limit"

### Import Attribution

- System user UUID: `00000000-0000-0000-0000-000000000000`
- Email: `system@internal`, display name: "API Ingest", inactive (cannot log in)
- Satisfies `importLog.importedBy` FK constraint

### Response Contract

**Success (200):**
```json
{
  "success": true,
  "logId": "uuid",
  "summary": { "recordCount": 86, "customerCount": 6, "aircraftCount": 57, "dateRange": { "start": "...", "end": "..." } },
  "warnings": ["66 records missing TotalMH (will use default 3.0)"]
}
```

**Idempotent replay (200):** Same shape, `idempotent: true`, from cached importLog row.

**Errors:**

| Status | Condition | Body |
|--------|-----------|------|
| 400 | Empty body | `{ "error": "Request body is empty" }` |
| 401 | Missing/malformed auth header | `{ "error": "Missing or invalid Authorization header" }` |
| 403 | Invalid API key | `{ "error": "Invalid API key" }` |
| 413 | Payload exceeds size limit | `{ "error": "Payload exceeds <N>MB limit" }` |
| 422 | Validation failed | `{ "error": "Validation failed", "summary": ..., "warnings": [...], "errors": [...] }` |
| 429 | Rate limited | `{ "error": "Rate limit exceeded" }` + `Retry-After` header |
| 500 | Server error | `{ "error": "Internal server error" }` |
| 503 | No API key configured | `{ "error": "Ingress endpoint not configured" }` |

### Admin Settings UI

New "API Integration" card in Admin Settings (`/admin/settings`):
- Status indicator: green dot "Endpoint active" / red dot "Endpoint disabled"
- Masked key display (`••••••••<last4>`) when set, "Not configured" when empty
- Generate/Regenerate key (64-char hex, displayed once for copy)
- Revoke key (clears → disables endpoint)
- Rate limit seconds input (min 10, max 3600, default 60)
- Max payload size MB input (min 1, max 200, default 50)

## Files

| File | Purpose |
|------|---------|
| `src/app/admin/import/page.tsx` | Data import page |
| `src/components/admin/data-import.tsx` | File upload, paste JSON, preview, commit |
| `src/app/api/admin/import/validate/route.ts` | Validation API (uses shared `import-utils.ts`) |
| `src/app/api/admin/import/commit/route.ts` | Commit API (uses shared `import-utils.ts`) |
| `src/app/api/admin/import/history/route.ts` | History API |
| `src/app/api/ingest/route.ts` | HTTP POST ingest endpoint (D-026) |
| `src/lib/data/import-utils.ts` | Shared validate + commit logic (admin + ingest) |
| `src/lib/utils/api-auth.ts` | Bearer token verification against SQLite |
| `src/lib/utils/rate-limit.ts` | In-memory per-key-hash rate limiter |
| `src/lib/db/schema.ts` | `import_log` table schema (includes `idempotencyKey` column) |

## Links

- [DECISIONS.md](../DECISIONS.md) D-016, D-026
- [OPEN_ITEMS.md](../OPEN_ITEMS.md) OI-004 (resolved), OI-034 (resolved)
- [RISKS.md](../DEV/RISKS.md) R15
- [REQ_Admin.md](REQ_Admin.md) — Admin section navigation
- [REQ_Logging_Audit.md](REQ_Logging_Audit.md) — Import logging detail
- [REQ_Analytics.md](REQ_Analytics.md) — `data_import` event tracking
