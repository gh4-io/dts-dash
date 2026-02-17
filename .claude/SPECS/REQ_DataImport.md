# REQ: Data Import

> **What changed and why:**
> - **2026-02-13**: Extracted from REQ_Admin.md into a standalone spec per PASS 2 re-plan. Data import is a cross-cutting concern (affects data layer, admin UI, logging, and analytics), so it warrants its own document.
> - **2026-02-16 (D-029)**: Work packages moved from file-based `data/input.json` to SQLite `work_packages` table. Import now UPSERTs by GUID. Added `db:import` CLI script for file/stdin imports.
>
> MVP + vNext scoped. Linked: D-016, D-026, D-029, OI-004 (resolved), OI-038 (v0.2.0), R15.

---

## Overview

Data enters the system from SharePoint OData exports. MVP supports two import mechanisms; vNext adds automation.

| Mechanism | Scope | Access | Description |
|-----------|-------|--------|-------------|
| File ingest | MVP | Admin | Load JSON file from local filesystem |
| Paste JSON | MVP | Admin | Paste raw OData JSON into Admin UI |
| CLI import | **Implemented** (D-029) | CLI | `db:import` script with `--file` or `--stdin` |
| Secure POST | **Implemented** (D-026) | API key | Authenticated HTTP endpoint for Power Automate |

## Data Storage (D-029)

**Current behavior**: Work package data stored in SQLite `work_packages` table. Import UPSERTs records by GUID (idempotent re-imports). No file-based storage.

**Cache**: `reader.ts` queries DB and caches results at module level. Cache invalidated after import commits.

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
5. **Commit** — UPSERT validated records into `work_packages` table by GUID (idempotent)
6. **Log** — import logged to `import_log` SQLite table
7. **Cache invalidation** — reader + transformer caches cleared; clients re-fetch on next request

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
| `POST` | `/api/admin/import/commit` | UPSERT validated records into `work_packages` table + log |
| `POST` | `/api/admin/import/reset` | DELETE all work packages (admin/superadmin only) |
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

## CLI Import (`db:import`) — Implemented (D-029)

Command-line script for importing work packages from files or stdin.

### Usage

```bash
# From file
npm run db:import -- --file data/input.json

# With auto-confirmation (skip prompt)
npm run db:import -- --file data/input.json --yes

# Custom source tracking
npm run db:import -- --file data/input.json --source api

# From stdin (piped)
cat export.json | npm run db:import -- --stdin
```

### Flow

1. **Read JSON** — from file path or stdin
2. **Validate** — reuses `validateImportData()` from `import-utils.ts` (same validation as Admin UI)
3. **Summary** — displays record count, customers, aircraft, date range, warnings
4. **Confirm** — prompts user (skipped with `--yes` flag)
5. **Commit** — reuses `commitImportData()` to UPSERT into `work_packages` by GUID
6. **Result** — displays upserted count and import log ID

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--file <path>` | Path to JSON file | Required (unless `--stdin`) |
| `--stdin` | Read JSON from stdin | Off |
| `--source <type>` | Import source (`file`, `paste`, `api`) | `file` |
| `--yes` | Skip confirmation prompt | Off (prompts user) |

### System User Attribution

- User ID: `00000000-0000-0000-0000-000000000000` (same as HTTP ingest)
- Tracked in `import_log.importedBy`

### Example Output

```
═══════════════════════════════════════════════════════════
  Work Package Import
═══════════════════════════════════════════════════════════

Reading: /home/user/data/input.json
  Size: 318.2 KB

Validating...

Import Summary:
  Records:    86
  Customers:  6
  Aircraft:   57
  Date range: 2026-01-16 → 2026-02-16

⚠ 66 records missing TotalMH (will use default 3.0)

Proceed with import (UPSERT by GUID)? [y/N]: y

Importing...

═══════════════════════════════════════════════════════════
✓ Imported 86 work packages
═══════════════════════════════════════════════════════════
  Import log ID: 9a8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4
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
- Chunk timeout seconds input (min 30, max 3600, default 300)

## Chunked Upload Support (Power Automate) — Implemented

Power Automate can split payloads into multiple requests using Microsoft's proprietary chunking protocol. The ingest endpoint detects this automatically via the `x-ms-transfer-mode: chunked` header.

### Protocol Flow

1. **POST /api/ingest** with `x-ms-transfer-mode: chunked` + `x-ms-content-length: <total>`
   - Auth + rate limit + size validation applied
   - Returns 200 with `Location: /api/ingest/chunks/<sessionId>` + `x-ms-chunk-size: 5242880`
2. **PATCH /api/ingest/chunks/<sessionId>** with `Content-Range: bytes=<start>-<end>/<total>`
   - Auth required on each chunk (same Bearer token)
   - Sequential ordering enforced (rangeStart must match receivedBytes)
   - Server confirms with `Range: bytes=0-<end>` header
3. After final chunk, server assembles payload and processes through standard validate+commit pipeline
   - Same validation rules, idempotency, and response format as non-chunked flow

### Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `ingestChunkTimeoutSeconds` | 300 | Max idle time for chunk sessions (30-3600s) |

### Storage

- In-memory `Map<string, ChunkSession>` (no persistence needed)
- Lazy cleanup of expired sessions on new session creation
- Chunks stored as `Buffer[]`, assembled via `Buffer.concat()` (handles multi-byte UTF-8)
- Sessions lost on server restart — Power Automate retries the full upload
- Ownership verified per PATCH (API key hash must match session creator)

### Error Codes (Chunk-specific)

| Status | Condition |
|--------|-----------|
| 400 | Missing `x-ms-content-length` on initial POST |
| 400 | Missing/invalid `Content-Range` on PATCH |
| 400 | Chunk ordering mismatch |
| 403 | API key mismatch between POST and PATCH |
| 404 | Session not found or expired |
| 413 | Total size exceeds `ingestMaxSizeMB` |
| 422 | Assembled payload validation failed |

## Files

| File | Purpose |
|------|---------|
| `src/app/admin/import/page.tsx` | Data import page |
| `src/components/admin/data-import.tsx` | File upload, paste JSON, preview, commit |
| `src/app/api/admin/import/validate/route.ts` | Validation API (uses shared `import-utils.ts`) |
| `src/app/api/admin/import/commit/route.ts` | Commit API (uses shared `import-utils.ts`) |
| `src/app/api/admin/import/history/route.ts` | History API |
| `src/app/api/ingest/route.ts` | HTTP POST ingest endpoint + chunked transfer detection |
| `src/app/api/ingest/chunks/[sessionId]/route.ts` | PATCH handler for chunked upload chunks |
| `src/lib/data/import-utils.ts` | Shared validate + commit logic (admin + ingest + CLI) — UPSERTs by GUID |
| `scripts/db/import.ts` | CLI import script (`db:import`) (D-029) |
| `src/lib/utils/api-auth.ts` | Bearer token verification against SQLite |
| `src/lib/utils/rate-limit.ts` | In-memory per-key-hash rate limiter |
| `src/lib/utils/chunk-session.ts` | In-memory chunk session manager (create, append, assemble, cleanup) |
| `src/lib/db/schema.ts` | `import_log` table schema (includes `idempotencyKey` column) |

## Links

- [DECISIONS.md](../DECISIONS.md) D-016, D-026, D-029
- [OPEN_ITEMS.md](../OPEN_ITEMS.md) OI-004 (resolved), OI-034 (resolved), OI-038 (v0.2.0)
- [RISKS.md](../DEV/RISKS.md) R15
- [REQ_Admin.md](REQ_Admin.md) — Admin section navigation
- [REQ_DataModel.md](REQ_DataModel.md) — `work_packages` table schema (D-029)
- [REQ_Logging_Audit.md](REQ_Logging_Audit.md) — Import logging detail
- [REQ_Analytics.md](REQ_Analytics.md) — `data_import` event tracking

## Known Issues

- **OI-038 (v0.2.0)**: Interactive fuzzy match resolution — low-confidence operator matches (<70%) auto-fail with no user override option. CLI shows per-occurrence prompts, Admin UI shows mapping table with dropdowns.
- **Master data imports not logged**: Customer and aircraft imports write to `master_data_import_log` table, which is separate from work package `import_log`. Admin import history page only queries `import_log`, so master data imports don't appear. Future: unified import history view or separate tabs.
