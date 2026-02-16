# REQ: Database Tools & Event Data Reset

**Status:** Implemented
**Created:** 2026-02-15
**Related:** [REQ_DataImport.md](REQ_DataImport.md), [REQ_Admin.md](REQ_Admin.md), [DEV_COMMANDS.md](../DEV/DEV_COMMANDS.md)

## Overview

A suite of 9 `npm run db:*` CLI scripts for database lifecycle management, plus an Admin UI reset button. The primary use case is resetting aircraft event data (work packages) while preserving system configuration, but the suite also covers seeding, backups, exports, migrations, and password resets.

All scripts live in `scripts/db/`, are TypeScript (run via `npx tsx`), and share `_cli-utils.ts` for consistent UX. Seed data is externalized to JSON files in `data/seed/` — see [DEV_COMMANDS.md](../DEV/DEV_COMMANDS.md) for the full command reference.

## Use Cases

1. **Corrupted Data Recovery** — Event data is corrupted and needs to be replaced
2. **Fresh Start** — Clear all events for testing or new operational period
3. **Data Migration** — Reset before importing data from a new source

## Architecture

### Data Storage Model

- **Event Data (cleared by reset):**
  - `data/input.json` — work package records
  - In-memory cache (via `reader.ts`)

- **System Data (preserved):**
  - SQLite tables:
    - `users` — user accounts
    - `sessions` — active sessions
    - `customers` — customer configuration (colors, IATA/ICAO codes, etc.)
    - `user_preferences` — user settings
    - `mh_overrides` — manual MH overrides
    - `aircraft_type_mappings` — aircraft type normalization
    - `manufacturers` — airframe manufacturers
    - `aircraft_models` — aircraft model reference data
    - `engine_types` — engine type reference data
    - `aircraft` — aircraft registry (registration, operator, model)
    - `import_log` — import history (preserved for audit trail)
    - `master_data_import_log` — master data import history
    - `analytics_events` — analytics data
    - `app_config` — system configuration

## Full Script Suite

| Script | File | Purpose |
|--------|------|---------|
| `db:seed` | `scripts/db/seed.ts` | Seed DB from `data/seed/*.json` (idempotent) |
| `db:migrate` | `scripts/db/migrate.ts` | Create tables + run migrations (idempotent) |
| `db:status` | `scripts/db/status.ts` | Read-only health check (14 tables, file sizes) |
| `db:backup` | `scripts/db/backup.ts` | WAL checkpoint + snapshot to `data/backups/` |
| `db:export` | `scripts/db/export.ts` | Export all 14 tables as JSON to `data/exports/` |
| `db:reset-password` | `scripts/db/reset-password.ts` | Reset superadmin password |
| `db:event-reset` | `scripts/reset-event-data.mjs` | Clear event data (input.json) |
| `db:analytics-clear` | `scripts/db/analytics-clear.ts` | Delete analytics_events rows |
| `db:reset` | `scripts/db/reset.ts` | Full factory reset (delete DB + re-seed) |

### Shared Infrastructure

- **`scripts/db/_cli-utils.ts`** — ANSI colors, `banner()`, `log()`, `confirm()`, `formatBytes()`, `timestamp()`
- **`data/seed/*.json`** — 7 JSON files providing seed data (users, customers, aircraft-type-mappings, aircraft-models, manufacturers, engine-types, app-config)
- **`src/lib/db/seed-data.ts`** — Loads JSON seed files via `fs.readFileSync`, exports typed constants
- **`src/lib/db/seed.ts`** — Exports `createTables()`, `runMigrations()`, `seedData()`, `seed()`

## Event Data Reset Implementation

### 1. NPM Script: `npm run db:event-reset` (Recommended)

**Location:** `scripts/reset-event-data.mjs`

**Features:**
- ✅ Cross-platform (works on Windows, macOS, Linux)
- ✅ Displays current data statistics (record count)
- ✅ Color-coded terminal output
- ✅ Interactive confirmation prompt
- ✅ Creates timestamped backup in `data/backups/`
- ✅ Resets `input.json` to empty array `[]`
- ✅ Provides restore instructions
- ✅ Proper error handling with helpful messages

**Usage:**
```bash
npm run db:event-reset
```

**Example Output:**
```
═══════════════════════════════════════════════════════════
  Reset Event Data Tool
═══════════════════════════════════════════════════════════

Current Data:
  Records: 672

⚠  WARNING: This will DELETE all aircraft event data from input.json
   System data (users, customers, settings) will NOT be affected.

Create backup and reset? [y/N]: y

Creating backup...
✓ Backup saved: data/backups/input_2026-02-15T20-30-45.json
Resetting input.json...
✓ Event data cleared

═══════════════════════════════════════════════════════════
✓ Reset complete
═══════════════════════════════════════════════════════════

Next steps:
  1. Restart the dev server (if running) to clear cache
  2. Import new data via Admin UI or API
  3. To restore backup: cp data/backups/input_2026-02-15T20-30-45.json data/input.json
```

### 2. Bash Script: `scripts/reset_event_data.sh` (Alternative)

**Location:** `/scripts/reset_event_data.sh`

**Features:**
- ✅ Displays current data statistics (record count or file size)
- ✅ Prompts for confirmation before reset
- ✅ Creates timestamped backup in `data/backups/`
- ✅ Resets `input.json` to empty array `[]`
- ✅ Provides restore instructions

**Usage:**
```bash
./scripts/reset_event_data.sh
```

**Example Output:**
```
════════════════════════════════════════════════════════════════
  Reset Event Data Tool
════════════════════════════════════════════════════════════════

Current Data:
  Records: 86

⚠  WARNING: This will DELETE all aircraft event data from input.json
   System data (users, customers, settings) will NOT be affected.

Create backup and reset? [y/N]: y

Creating backup...
✓ Backup saved: data/backups/input_20260215_143022.json
Resetting input.json...
✓ Event data cleared

════════════════════════════════════════════════════════════════
✓ Reset complete
════════════════════════════════════════════════════════════════

Next steps:
  1. Restart the dev server (if running) to clear cache
  2. Import new data via Admin UI or API
  3. To restore backup: cp data/backups/input_20260215_143022.json data/input.json
```

### 3. Admin UI: Reset Button

**Location:** Admin > Import page (`/admin/import`)

**Features:**
- ✅ Confirmation dialog with detailed warning
- ✅ Lists what will be cleared vs. preserved
- ✅ Automatic backup creation
- ✅ Success/error notifications
- ✅ Auto-refreshes import history
- ✅ Admin/superadmin role enforcement

**UI Elements:**

1. **Reset Section** (destructive styling)
   - Heading: "Reset Event Data"
   - Description: "Clear all aircraft event data. System data will be preserved. A backup will be created automatically."
   - Button: "Reset Data" (destructive variant)

2. **Confirmation Dialog**
   - Title: "Reset Event Data?"
   - Sections:
     - Warning message
     - **What will be cleared** (with warning icon)
       - All aircraft ground time events
       - Flight board data
       - Dashboard statistics
     - **What will be preserved** (with check icon)
       - User accounts and preferences
       - Customer configurations
       - Aircraft type mappings
       - System settings
       - Import history log
     - Backup notice
   - Actions: "Cancel" | "Reset Data" (destructive)

3. **Success Message** (amber alert)
   - Shows record count cleared
   - Shows backup file path
   - Auto-dismisses after 5 seconds

### 4. API Endpoint

**Route:** `POST /api/admin/import/reset`

**Auth:** Admin/superadmin only (enforced by Auth.js session check)

**Request:** None (POST with no body)

**Response:**
```json
{
  "success": true,
  "message": "Reset complete. Cleared 86 records.",
  "recordCount": 86,
  "backupPath": "data/backups/input_2026-02-15T19-30-22.json"
}
```

**Error Response:**
```json
{
  "error": "Failed to reset event data",
  "details": "Error message"
}
```

**Behavior:**
1. Check session and role (401/403 if unauthorized)
2. Read current `input.json` to count records
3. Create `data/backups/` directory if needed
4. Copy `input.json` to timestamped backup
5. Write `[]` to `input.json`
6. Call `invalidateCache()` to clear in-memory cache
7. Log reset action to `import_log` table
8. Return success response with count and backup path

## Backup Strategy

### Backup Location
`data/backups/input_{timestamp}.json`

### Timestamp Format
- **Script:** `YYYYMMDD_HHMMSS` (e.g., `20260215_143022`)
- **API:** ISO 8601 with colons/periods replaced (e.g., `2026-02-15T19-30-22`)

### Restore Process
```bash
# List backups
ls -lh data/backups/

# Restore a specific backup
cp data/backups/input_20260215_143022.json data/input.json

# Restart dev server to reload data
npm run dev
```

## Security

- ✅ **Role enforcement:** Admin/superadmin only
- ✅ **Session validation:** Uses Auth.js session
- ✅ **Confirmation required:** Both CLI and UI require explicit confirmation
- ✅ **Backup safety net:** Automatic backup before any deletion
- ✅ **Audit trail:** Reset action logged to `import_log`

## Testing

### Manual Test Steps

1. **NPM Script Test (Recommended):**
   ```bash
   # Ensure data exists
   cat data/input.json | jq 'length'

   # Run reset
   npm run db:event-reset

   # Confirm at prompt (type 'y')

   # Verify reset
   cat data/input.json  # Should show []

   # Verify backup
   ls -lh data/backups/

   # Restore
   cp data/backups/input_*.json data/input.json
   ```

2. **Admin UI Test:**
   - Login as admin/superadmin
   - Navigate to `/admin/import`
   - Verify "Reset Event Data" section visible
   - Click "Reset Data" button
   - Verify confirmation dialog appears with correct warnings
   - Cancel dialog → verify no data changed
   - Click "Reset Data" again → confirm
   - Verify success message shows correct record count
   - Verify flight board shows no data
   - Verify import history shows reset action
   - Import new data to verify system still works

3. **Role Enforcement Test:**
   - Login as regular user
   - Navigate to `/admin/import` → should redirect to login
   - Direct API call: `POST /api/admin/import/reset` → should return 403

4. **Backup Verification:**
   ```bash
   # Before reset
   cat data/input.json | jq 'length'  # e.g., 86

   # After reset
   cat data/input.json  # []
   cat data/backups/input_*.json | jq 'length'  # 86
   ```

## Error Handling

### Common Errors

1. **File doesn't exist:**
   - Script: Shows "Nothing to reset"
   - API: Returns success with recordCount: 0

2. **Permission denied:**
   - Check file permissions on `data/` directory
   - Ensure write access to `data/backups/`

3. **Disk space:**
   - Backup creation fails if insufficient space
   - Error message shows details

4. **Foreign key constraint (import_log):**
   - API catches and logs error
   - Reset still succeeds (logging is non-critical)
   - Console warning shown

## Future Enhancements

### Planned (Not Implemented)

1. **Selective Reset:**
   - Reset by date range
   - Reset by customer
   - Reset by aircraft

2. **Backup Management:**
   - List backups in Admin UI
   - Restore from backup in UI
   - Auto-delete old backups (retention policy)

3. **Reset Analytics:**
   - Track reset frequency
   - Alert on frequent resets (data quality issue)

4. **Dry Run Mode:**
   - Preview what will be deleted
   - Show backup size estimate

## Related Files

### Created/Modified Files

```
scripts/db/_cli-utils.ts                 # Shared CLI utilities
scripts/db/seed.ts                       # db:seed
scripts/db/reset.ts                      # db:reset (factory reset)
scripts/db/reset-password.ts             # db:reset-password
scripts/db/status.ts                     # db:status (read-only)
scripts/db/backup.ts                     # db:backup
scripts/db/export.ts                     # db:export
scripts/db/analytics-clear.ts           # db:analytics-clear
scripts/db/migrate.ts                    # db:migrate
scripts/reset-event-data.mjs             # db:event-reset
scripts/reset_event_data.sh              # Bash alternative (event reset)
src/lib/db/seed-data.ts                  # JSON-backed seed data loader
src/lib/db/seed.ts                       # Seed logic (createTables, runMigrations, seedData)
src/app/api/admin/import/reset/route.ts  # API endpoint (Admin UI reset)
src/components/admin/data-import.tsx     # UI (reset button added)
data/seed/*.json                         # 7 seed data files
data/backups/                            # Backup directory (gitignored)
data/exports/                            # Export directory (gitignored)
```

### Related Specs

- [REQ_DataImport.md](REQ_DataImport.md) — Data import system
- [REQ_Admin.md](REQ_Admin.md) — Admin section overview
- [REQ_Auth.md](REQ_Auth.md) — Authentication and roles

## Changelog

| Date       | Change                                                      |
|------------|-------------------------------------------------------------|
| 2026-02-15 | Initial implementation — CLI script, API endpoint, Admin UI |
| 2026-02-15 | Added 8 more db:* scripts, seed data JSON refactor          |
| 2026-02-15 | Added 5 new tables (manufacturers, aircraft_models, engine_types, aircraft, master_data_import_log) |
