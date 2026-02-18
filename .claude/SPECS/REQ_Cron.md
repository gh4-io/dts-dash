# REQ: Cron Job Management

> **Decision**: D-030
> **Created**: 2026-02-17

---

## Architecture: Two-Tier Model

```
Code Defaults (built-in jobs) + YAML Overrides (server.config.yml) → Effective Config
                                                                         ↓
                                                                   cron_job_runs (DB)
                                                                   (runtime state only)
```

- **Built-in jobs**: Defined in `src/lib/cron/index.ts` with name, description, script, handler, default schedule, default options, and `optionsSchema`. Always present, cannot be deleted.
- **YAML overrides**: `server.config.yml` `cron.jobs` section. Override any property of built-in jobs. Define new custom jobs.
- **Custom jobs**: YAML-only, must include `script` (path to `.ts` module with `execute()` export) and `schedule`.
- **Runtime state**: `cron_job_runs` table tracks `lastRunAt`, `lastRunStatus`, `lastRunMessage`, `runCount` per job key.
- **Execution**: All in-process via `node-cron`. Built-in jobs use static handler imports. Custom jobs use dynamic `import()`.

## YAML Schema

```yaml
cron:
  jobs:
    # Override built-in job (only fields to change)
    cleanup-canceled:
      schedule: "0 */12 * * *"
      options:
        graceHours: 12

    # Custom job (must have script + schedule)
    nightly-backup:
      name: "Nightly DB Backup"
      script: "scripts/cron/nightly-backup.ts"
      schedule: "0 3 * * *"
      enabled: true
      options:
        keepDays: 30
```

| Field | Built-in | Custom | Purpose |
|-------|----------|--------|---------|
| `name` | optional override | recommended | Display name |
| `description` | optional override | optional | Description |
| `script` | set by code (read-only) | **required** | Path to script module |
| `schedule` | optional override | **required** | 5-field cron expression |
| `enabled` | optional override | optional (default: true) | Active/suspended |
| `options` | optional override | optional | Key-value params to `execute()` |

## Custom Script Interface

```typescript
// scripts/cron/my-task.ts
export async function execute(options: Record<string, unknown>): Promise<{ message: string }> {
  // do work...
  return { message: "Completed: processed 42 items" };
}
```

Built-in task files (`src/lib/cron/tasks/*.ts`) follow the same interface.

## Built-in Jobs

| Key | Name | Default Schedule | Default Options | Description |
|-----|------|-----------------|----------------|-------------|
| `cleanup-canceled` | Cleanup Canceled WPs | `0 */6 * * *` | `graceHours: 6` | Permanently deletes canceled WPs past grace period |

### Adding New Built-in Jobs

Add to the `BUILTIN_JOBS` array in `src/lib/cron/index.ts`:
1. Create handler in `src/lib/cron/tasks/`
2. Add entry with key, name, description, script, handler, defaults, optionsSchema
3. Handler must return `Promise<CronTaskResult>` (`{ message: string }`)

## API Routes

All admin/superadmin gated via proxy middleware.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/cron` | GET | List effective jobs + runtime state |
| `/api/admin/cron` | POST | Add custom job |
| `/api/admin/cron/[key]` | PUT | Update job overrides |
| `/api/admin/cron/[key]` | DELETE | Remove custom job (rejects built-in) |
| `/api/admin/cron/[key]/run` | POST | Manual trigger |
| `/api/admin/cron/[key]/reset` | POST | Reset built-in to defaults |
| `/api/admin/cron/builtins` | GET | List built-in definitions with optionsSchema |

## Admin UI

**Route**: `/admin/cron` (tab: "Cron Jobs", icon: `fa-solid fa-clock-rotate-left`)

### Table Columns
Status dot, Name + badge (Built-in/Custom), Script, Schedule + human-readable, Last Run, Run Count, Actions.

### Actions
- **Edit**: Open form dialog
- **Toggle**: Suspend/resume
- **Run Now**: Execute immediately
- **Reset** (built-in only): Remove YAML overrides
- **Delete** (custom only): Remove from YAML

### Form
- Schedule Builder: presets (minutes/hours/daily/weekly/monthly) or custom cron expression
- Options: dynamic fields from `optionsSchema` for built-in jobs; free-form for custom

### Auto-refresh
30-second polling for runtime state updates.

## DB Table: `cron_job_runs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `job_key` | TEXT UNIQUE | Job identifier |
| `last_run_at` | TEXT | ISO timestamp |
| `last_run_status` | TEXT | "success" or "error" |
| `last_run_message` | TEXT | Result/error message |
| `run_count` | INTEGER | Total executions |
| `created_at` | TEXT | Row creation time |
| `updated_at` | TEXT | Last update time |

## Files

| File | Purpose |
|------|---------|
| `src/lib/cron/index.ts` | Orchestrator: registry, merge, start/stop/restart, status |
| `src/lib/cron/tasks/cleanup-canceled.ts` | Built-in cleanup task |
| `src/lib/config/loader.ts` | YAML read/write for cron overrides |
| `src/lib/utils/cron-helpers.ts` | Client-safe: cronToHuman, validateCronExpression, buildCronExpression |
| `src/lib/db/schema.ts` | `cronJobRuns` Drizzle schema |
| `src/app/api/admin/cron/` | API routes |
| `src/app/(authenticated)/admin/cron/page.tsx` | Admin page |
| `src/components/admin/cron-*` | Table, form, schedule builder components |
