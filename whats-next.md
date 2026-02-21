# Handoff Document — Rotation-Based Staffing System (v0.3.0)

**Created:** 2026-02-20
**Branch:** `feat/capacity-mvp`
**Repo:** `gh4-io/dts-dash`
**Status:** WS-7 complete, WS-8 pending. All changes uncommitted.

---

<original_task>

Build a rotation-based staffing matrix system for MRO workforce planning (133 AMTs across 60+ rotation patterns). The system extends the existing capacity modeling MVP (WS-1 through WS-6, already committed) with:

1. **3-week rotation patterns** — 21-day on/off cycles stored as `x`/`o` strings
2. **Staffing configurations** — Named sets for experimentation (only one active at a time)
3. **Custom shift definitions** — Combine rotation patterns with shift times, categories (Day/Swing/Night/Other), headcount
4. **Three-panel admin UI** — Rotation library (left), shift definitions (center), weekly matrix visualization (right)
5. **Staffing engine** — Pure computation functions for rotation resolution and weekly matrix generation
6. **Integration with capacity page** — Mode toggle between Simple (headcount plans) and Advanced (rotation-based)
7. **Import schemas** — Bulk import rotation patterns and staffing shifts via Data Hub

After initial implementation, the user requested several UI refinements:
- Compact rotation dots (21 inline squares, no gaps)
- Name character limits (32 chars) + description fields on both rotations and shifts
- TimePicker component for shift start/end times (replacing number inputs)
- Headcount as a normal always-visible input (not click-to-edit) with auto-save to local cache + beforeunload warning
- Allow deleting rotations in use — show warning badge on orphaned shifts
- Update the master plan file with current configuration

</original_task>

---

<work_completed>

## Database Layer

### New Tables (Migration M007 + M008)

**M007 — `rotation_patterns`:**
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL | Max 32 chars |
| pattern | TEXT NOT NULL | 21-char string, `x`=work `o`=off |
| is_active | INTEGER DEFAULT 1 | |
| sort_order | INTEGER DEFAULT 0 | |
| created_at, updated_at | TEXT | ISO timestamps |

**M007 — `staffing_configs`:**
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL | |
| description | TEXT | Nullable |
| is_active | INTEGER DEFAULT 0 | Only one active at a time |
| created_at, updated_at | TEXT | |
| created_by | INTEGER FK → users | |

**M007 — `staffing_shifts`:**
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| config_id | INTEGER FK → staffing_configs | CASCADE delete |
| name | TEXT NOT NULL | Max 32 chars |
| category | TEXT NOT NULL | Enum: DAY/SWING/NIGHT/OTHER |
| rotation_id | INTEGER FK → rotation_patterns | **Nullable** (0 = orphaned) |
| rotation_start_date | TEXT NOT NULL | YYYY-MM-DD |
| start_hour, start_minute | INTEGER | 0-23, 0-59 |
| end_hour, end_minute | INTEGER | 0-23, 0-59 |
| break_minutes, lunch_minutes | INTEGER DEFAULT 0 | |
| mh_override | REAL | Nullable. Pre-productivity paid hours override |
| headcount | INTEGER NOT NULL DEFAULT 0 | |
| is_active | INTEGER DEFAULT 1 | |
| sort_order | INTEGER DEFAULT 0 | |
| created_at, updated_at | TEXT | |

**M008 — Added `description TEXT` column to both `rotation_patterns` and `staffing_shifts`.**

### Files Modified (Data Layer)

- **`src/lib/db/schema.ts`** — Added 3 Drizzle table definitions (`rotationPatterns`, `staffingConfigs`, `staffingShifts`) + relations. `rotationId` is nullable (removed `.notNull()`). Added `description` columns.
- **`src/lib/db/schema-init.ts`** — Added M007 (CREATE TABLE + indexes) and M008 (ALTER TABLE ADD COLUMN) migrations.
- **`src/lib/db/bootstrap.ts`** — Added `ensureDefaultStaffingData()` that seeds 5 default rotation patterns + 1 default config from `data/seed/rotation-patterns.json`.
- **`src/types/index.ts`** — Added `RotationPattern`, `StaffingConfig`, `StaffingShift`, `StaffingShiftCategory`, `WeeklyMatrixResult`, `WeeklyMatrixCell`, `StaffingDayResult`, `ShiftStaffingResult` interfaces. All include `description: string | null`.

### Files Created (Data Layer)

- **`src/lib/capacity/staffing-data.ts`** — 18 Drizzle query functions:
  - Rotation Patterns: `loadRotationPatterns(activeOnly?)`, `loadRotationPattern(id)`, `createRotationPattern(data)`, `updateRotationPattern(id, data)`, `deleteRotationPattern(id)`, `isRotationPatternInUse(id)`
  - Staffing Configs: `loadStaffingConfigs()` (returns with shiftCount + totalHeadcount), `loadActiveStaffingConfig()`, `loadStaffingConfig(id)`, `createStaffingConfig(data)`, `updateStaffingConfig(id, data)`, `deleteStaffingConfig(id)`, `activateStaffingConfig(id)`, `duplicateStaffingConfig(sourceId, newName, createdBy?)`
  - Staffing Shifts: `loadStaffingShifts(configId)`, `createStaffingShift(data)`, `updateStaffingShift(id, data)`, `deleteStaffingShift(id)`
  - **Key behavior:** `deleteRotationPattern()` first detaches referencing shifts (sets `rotationId = 0`) before deleting the pattern. Returns `boolean`.
- **`data/seed/rotation-patterns.json`** — 5 default patterns (Standard 5-2, Compressed 4-3, Weekend Bridge, Panama 2-2-3, Dupont)

---

## Staffing Engine (Pure Functions)

**File: `src/lib/capacity/staffing-engine.ts`**

All functions are pure (no DB access). Key exports:

| Function | Signature | Notes |
|----------|-----------|-------|
| `isWorkingDay` | `(targetDate: string, pattern: string, rotationStartDate: string) → boolean` | `dayIndex = ((daysBetween % 21) + 21) % 21` — handles before start |
| `computeEffectivePaidHours` | `(shift: StaffingShift) → number` | `mhOverride ?? (duration - breaks - lunch) / 60` |
| `resolveStaffingDay` | `(date: string, shifts: StaffingShift[], patterns: Map) → StaffingDayResult` | Returns `byCategory` headcount + `byShift` array |
| `computeWeeklyMatrix` | `(weekStart: string, shifts, patterns, assumptions) → WeeklyMatrixResult` | 7 days × 4 categories. Applies full productivity chain. |
| `resolveStaffingForCapacity` | `(dates: string[], shifts, patterns) → Map<string, Map<string, {headcount, effectivePaidHours}>>` | Format compatible with capacity engine. Excludes OTHER category. |
| `buildPatternMap` | `(patterns: RotationPattern[]) → Map<number, RotationPattern>` | |
| `validatePattern` | `(pattern: string) → string \| null` | Validates 21 chars, x/o only |
| `countWorkingDays` | `(pattern: string) → number` | Count 'x' chars |

**File: `src/lib/capacity/staffing-engine.test.ts`** — 36 unit tests covering pattern wrapping, negative offsets, category aggregation, MH override, break deduction, inactive exclusion, empty config, conservation. All tests have `description: null` in fixtures.

**File: `src/lib/capacity/index.ts`** — Barrel export for all staffing engine + data functions alongside existing capacity/demand exports.

---

## API Routes (14 route files)

### Rotation Patterns
| Method | Path | File |
|--------|------|------|
| GET/POST | `/api/admin/capacity/rotation-patterns` | `src/app/api/admin/capacity/rotation-patterns/route.ts` |
| PUT/DELETE | `/api/admin/capacity/rotation-patterns/[id]` | `.../[id]/route.ts` |
| POST | `/api/admin/capacity/rotation-patterns/bulk` | `.../bulk/route.ts` |

- DELETE now **allows deletion even when pattern is in use** — returns `{ success: true, wasInUse: boolean }`. Shifts get orphaned (`rotationId = 0`).
- PUT accepts `description` field.

### Staffing Configs
| Method | Path | File |
|--------|------|------|
| GET/POST | `/api/admin/capacity/staffing-configs` | `src/app/api/admin/capacity/staffing-configs/route.ts` |
| GET/PUT/DELETE | `/api/admin/capacity/staffing-configs/[id]` | `.../[id]/route.ts` |
| POST | `/api/admin/capacity/staffing-configs/[id]/activate` | `.../activate/route.ts` |
| POST | `/api/admin/capacity/staffing-configs/[id]/duplicate` | `.../duplicate/route.ts` |

### Staffing Shifts
| Method | Path | File |
|--------|------|------|
| GET/POST | `/api/admin/capacity/staffing-shifts` | `src/app/api/admin/capacity/staffing-shifts/route.ts` |
| PUT/DELETE | `/api/admin/capacity/staffing-shifts/[id]` | `.../[id]/route.ts` |
| POST | `/api/admin/capacity/staffing-shifts/bulk` | `.../bulk/route.ts` |

- POST requires `headcount` field (>= 0). The UI now sends `headcount: 0` as default on creation.
- PUT includes `description` in allowed update fields.

### Computed Matrix
| Method | Path | File |
|--------|------|------|
| GET | `/api/admin/capacity/staffing-matrix?configId=X&weekStart=YYYY-MM-DD` | `src/app/api/admin/capacity/staffing-matrix/route.ts` |

All admin routes enforce admin/superadmin role via `auth()` check.

---

## UI Components (6 files, 2261 lines total)

### `rotation-dots.tsx` (87 lines)
21-square visual representation of rotation pattern.
- **Props:** `pattern`, `categoryColor?`, `size?: "sm" | "md"`, `showWeekLabels?`, `interactive?`, `onToggle?`
- **`"sm"` (default):** Compact inline strip, 5px×10px per square, zero gap, rounded ends. Used in lists and shift bars.
- **`"md"`:** 3×7 grid with optional week/day labels (W1/W2/W3, S/M/T/W/T/F/S), 14px×14px squares, 2px rounded. Used in dialog previews.

### `rotation-pattern-editor.tsx` (220 lines)
Dialog for creating/editing rotation patterns.
- 3×7 interactive grid of clickable squares (toggle on/off)
- Name input (32 char max), description input (optional)
- Presets: Weekdays, Weekends, All On, Clear
- Shows work days count and raw code
- `onSave` passes `{ name, description, pattern }`

### `rotation-pattern-list.tsx` (264 lines)
Left panel — scrollable list of rotation patterns.
- Each row: checkbox → inline dots → name (truncated) → work days count → hover actions (edit/toggle active/delete)
- Description shown in tooltip on name hover
- Bulk select + actions (activate/deactivate/delete)
- Deactivated rows: reduced opacity, sorted to bottom
- Delete confirmation warns about orphaned shifts

### `shift-definitions-grid.tsx` (874 lines)
Center panel — shift definitions grouped by category.
- **Category sections:** Collapsible headers with icon, color accent, shift count, headcount total
  - DAY: amber, SWING: orange, NIGHT: indigo, OTHER: gray
- **Each shift bar:** checkbox → name (32 max) + time → rotation dots (sm) → rotation name → headcount input → hover actions
- **Headcount:** Always-visible `<Input type="number">`, auto-saves on blur to `pendingHeadcounts` Map
  - Pending values shown with amber border highlight
  - "Save (N)" button appears in toolbar when changes pending
  - `beforeunload` warning if navigating away with unsaved changes
  - Key-based remounting (`key={s.id}-${s.headcount}`) for clean state sync
- **Orphaned rotation warning:** `rotationId === 0` shows destructive triangle-exclamation icon with tooltip
- **Shift edit dialog:** Name, description, category, rotation selector, rotation start date, **TimePicker** for start/end, break/lunch, MH override. **No headcount in dialog** — sends `headcount: 0` on create.
- **Sub-component:** `HeadcountInput` — stateful input that caches locally on blur

### `staffing-config-selector.tsx` (383 lines)
Config dropdown with CRUD actions.
- Dropdown shows all configs with active indicator
- Actions: New Config, Rename, Duplicate, Activate (with confirmation), Delete

### `weekly-matrix-panel.tsx` (433 lines)
Right panel — weekly visualization.
- Week selector with prev/next arrows
- Heatmap grid: rows=categories (DAY/SWING/NIGHT/OTHER/Total), cols=Sun-Sat+Total
- Cells: headcount with colored intensity background
- MH Summary: Paid/Available/Productive MH per day with productivity chain
- Key Stats cards: total AMTs, avg daily, peak/min, coverage gaps

### Page & Navigation
- **`src/app/(authenticated)/admin/capacity/staffing/page.tsx`** — Three-panel responsive layout: 280px left | flex-1 center | 320px right. Auto-selects active config.
- **`src/app/(authenticated)/admin/capacity/page.tsx`** — Admin capacity hub with "Staffing Matrix" card (first position).
- **`src/components/admin/admin-nav.tsx`** — "Capacity" nav item links to `/admin/capacity`.

---

## Import Schemas

### `src/lib/import/schemas/rotation-patterns.ts`
- Schema ID: `rotation-patterns`, Category: `Capacity`
- Fields: name, description, pattern, isActive, sortOrder
- Commit strategy: upsert (dedup by name)
- Export: queries all patterns, returns full data

### `src/lib/import/schemas/staffing-shifts.ts`
- Schema ID: `staffing-shifts`, Category: `Capacity`
- Fields: name, configId, category, rotationName, rotationStartDate, startHour, startMinute, endHour, endMinute, breakMinutes, lunchMinutes, mhOverride, headcount, isActive, sortOrder
- Commit strategy: upsert (dedup by name + configId)
- Resolves rotation pattern by name (case-insensitive lookup)
- Export: resolves rotationId → rotationName for human-readable output
- Category cast: `as "DAY" | "SWING" | "NIGHT" | "OTHER"` to satisfy enum type

### `src/lib/import/schemas/index.ts`
Added `import "./rotation-patterns"` and `import "./staffing-shifts"` to barrel.

---

## Documentation Updates

### `CHANGELOG.md`
Added v0.3.0 unreleased section documenting:
- Rotation-based staffing matrix (full feature description)
- Capacity modeling MVP (all 6 original work streams)
- 3 new DB tables, 14 API routes, 7 UI components, 2 import schemas

### Plan File (`/home/guru/.claude/plans/quiet-questing-tulip.md`)
Updated with:
- Implementation status table (WS-1 through WS-7 = COMPLETE, WS-8 = PENDING)
- Full WS-7 section documenting rotation-based staffing system
- WS-8 placeholder for capacity page mode toggle
- Key files reference expanded with staffing-specific paths
- **Decision documented:** Keep Headcount Plans as "Simple mode" — rotation-based is primary, simple mode stays for backwards compatibility

---

## Key Decisions Made

1. **Keep Headcount Plans as "Simple mode"** — Rotation-based staffing is the primary model going forward, but Headcount Plans remain for quick scenarios without rotation complexity. Capacity page will toggle between both modes.
2. **Orphaned rotation handling** — When a rotation pattern is deleted, referencing shifts get `rotationId = 0` (sentinel value). UI shows warning badge. This was a deliberate choice over blocking deletion.
3. **Headcount outside dialog** — Headcount is the most-edited field, so it lives as a normal input on each shift bar rather than inside the edit dialog. Caches locally on blur, bulk-saves via toolbar button.
4. **Name limits** — 32 chars for both rotation pattern names and shift names. Enforced in UI (`maxLength`) and described in labels.
5. **TimePicker for shift times** — Uses the existing `src/components/ui/time-picker.tsx` component with `format="HH:mm"`, `size="sm"`, `cleanable={false}`. Converts between `Date` objects and hour/minute numbers via `toTimeDate()` helper.

</work_completed>

---

<work_remaining>

## WS-8: Capacity Page Integration (Mode Toggle)

This is the final work stream. All prerequisites are complete.

### Tasks:

1. **Add `mode` query parameter to `GET /api/capacity/overview`**
   - File: `src/app/api/capacity/overview/route.ts`
   - Accept `?mode=simple|rotation` (default: `simple` for backwards compat)
   - When `mode=rotation`: use `resolveStaffingForCapacity()` from staffing engine + active config instead of headcount plans/exceptions
   - When `mode=simple`: use existing `resolveHeadcount()` path (unchanged)

2. **Enhance `useCapacityV2` hook**
   - File: `src/lib/hooks/use-capacity-v2.ts`
   - Add `mode` parameter that gets passed to the API
   - Persist mode in URL search params

3. **Add Mode Toggle UI to `/capacity` page**
   - File: `src/app/(authenticated)/capacity/page.tsx`
   - Segmented control: "Simple" | "Advanced (Rotation)"
   - When Advanced: show active config name + link to admin staffing page
   - Default: Simple (backwards compatible)

4. **Active Config Banner**
   - Show which staffing config is active when in Advanced mode
   - Link to `/admin/capacity/staffing` for configuration

### Validation:
- Old `GET /api/capacity/overview` (no mode param) returns identical results
- `mode=simple` uses headcount plans (existing path)
- `mode=rotation` uses active staffing config + rotation engine
- Toggle works in UI and persists in URL

---

## Uncommitted Work — Needs Commit

**ALL current work is uncommitted.** There are:
- 10 modified files
- 16 new files/directories

These should be committed before starting WS-8. Suggested commit:
```
feat(capacity): add rotation-based staffing system (WS-7)

- 3 new tables: rotation_patterns, staffing_configs, staffing_shifts (M007 + M008)
- Staffing engine with pure rotation resolution functions (36 tests)
- 14 API routes for patterns/configs/shifts CRUD + computed matrix
- Three-panel admin UI: rotation library, shift definitions, weekly matrix
- 2 import schemas for bulk import via Data Hub
- Description fields, TimePicker for shift times, orphaned rotation warnings
- Headcount auto-save with beforeunload warning
```

---

## Other Remaining Items (Not Started)

- **WS-8 UI polish** — After mode toggle works, may need styling refinements
- **User communication** — The demand model change (distribute vs. duplicate) and capacity number changes should be documented in an in-app info card
- **Seed data tuning** — Default rotation patterns may need adjustment based on actual CVG schedules
- **E2E testing** — Manual browser testing per TEST_PLAN.md checklist

</work_remaining>

---

<attempted_approaches>

## Errors Encountered and Fixed

1. **`staffing-shifts.ts` import schema type error:**
   - `category` typed as `string` was not assignable to enum union `"DAY" | "SWING" | "NIGHT" | "OTHER"`
   - **Fix:** Cast explicitly: `as "DAY" | "SWING" | "NIGHT" | "OTHER"`

2. **Test fixtures missing `description`:**
   - After adding `description` to the `RotationPattern` interface, all 5 test pattern fixtures and `makeShift()` helper needed `description: null`
   - **Fix:** Added `description: null` to every fixture in `staffing-engine.test.ts`

3. **Import schema nullable `rotationId`:**
   - `patternMap.get(r.rotationId)` failed when `rotationId` could be null/0
   - **Fix:** `(r.rotationId ? patternMap.get(r.rotationId) : null) ?? String(r.rotationId ?? 0)`

4. **FK constraint on rotation delete:**
   - SQLite FK constraint prevented deleting a rotation pattern that was referenced by shifts
   - **Fix:** `deleteRotationPattern()` now sets `rotationId = 0` on all referencing shifts before deleting the pattern

5. **Lint error — `setState` in `useEffect`:**
   - `HeadcountInput` sub-component used `useEffect` to sync state when `defaultValue` changed, triggering "Calling setState synchronously within an effect" lint error
   - **Fix:** Replaced with key-based remounting: `key={s.id}-${s.headcount}` on the component. This forces React to remount with fresh state when the server value changes. Removed the `useEffect` entirely.

6. **"headcount must be >= 0" error on shift creation:**
   - After removing headcount from the shift edit dialog, the POST payload no longer included `headcount`, causing the API validation (`body.headcount === undefined`) to fail
   - **Fix:** Added `if (!editingShift) { payload.headcount = 0; }` to default headcount to 0 on creation

7. **Rotation dots visual regression:**
   - Rewriting `rotation-dots.tsx` for compact inline mode removed `size` and `showWeekLabels` props
   - The shift dialog's rotation preview used `size="md"` with `showWeekLabels`
   - **Fix:** Restored both `size` prop (`"sm"` for inline strip, `"md"` for 3×7 grid) and `showWeekLabels` prop. The shift dialog preview now uses `size="md" showWeekLabels` again.

## Approaches That Work

- **Key-based remounting** for controlled inputs that need to sync with server state — avoids the setState-in-effect anti-pattern entirely
- **Pending headcount cache pattern** — `Map<shiftId, pendingValue>` with `beforeunload` listener — clean separation between cached local state and server state
- **Sentinel value (0) for orphaned rotations** — simpler than nullable + migration, works with existing integer FK column
- **`toTimeDate(hour, minute)` helper** — clean conversion between the hour/minute number format (stored in DB) and the `Date` objects required by `TimePicker`

</attempted_approaches>

---

<critical_context>

## Architecture

### Rotation Resolution Algorithm
```
For target date + staffing_shift:
  daysSinceStart = daysBetween(rotation_start_date, targetDate)
  dayIndex = ((daysSinceStart % 21) + 21) % 21   // handles dates before start
  isWorking = rotation.pattern[dayIndex] === 'x'

  If isWorking:
    effectivePaidHours = mh_override ?? (shiftDuration - breaks/60 - lunch/60)
    contribution = headcount → that day's category total
```

### Productivity Chain
```
Paid Hours × paidToAvailable (0.89) × availableToProductive (0.73) × nightFactor (0.85 if night)
= Productive MH per person

Day:   8.0 × 0.89 × 0.73 = 5.20 MH/person
Night: 8.0 × 0.89 × 0.73 × 0.85 = 4.42 MH/person
```

### Two Capacity Modes (Simple vs Advanced)
- **Simple:** `headcount_plans` + `headcount_exceptions` → flat per-shift headcounts with weekday overrides + date exceptions
- **Advanced:** `rotation_patterns` + `staffing_configs` + `staffing_shifts` → 21-day rotation cycles per shift
- Both produce the same output format: headcount per shift-category per date
- The capacity engine doesn't care which mode generated the headcount

### Orphaned Shift Flow
1. User deletes a rotation pattern that is in use
2. `deleteRotationPattern(id)` sets `rotationId = 0` on all referencing shifts
3. API returns `{ success: true, wasInUse: true }`
4. UI shows destructive triangle-exclamation badge on affected shifts
5. User must assign a new rotation via the shift edit dialog

### Headcount Auto-Save Flow
1. User changes headcount value in the `<Input>` on a shift bar
2. On blur: `handleHeadcountBlur(shiftId, value)` is called
3. If value differs from server value: added to `pendingHeadcounts` Map
4. If value matches server value: removed from `pendingHeadcounts` Map
5. Pending inputs get amber border highlight
6. "Save (N)" button appears in toolbar showing count of pending changes
7. Footer shows "(unsaved)" indicator next to total AMT count
8. `beforeunload` event listener active when `pendingHeadcounts.size > 0`
9. Save button calls `saveAllPendingHeadcounts()` — parallel PUT requests, then refresh

## Important Gotchas

1. **`rotationId` is nullable in the DB but typed as `number` in the interface** — uses `0` as sentinel for "orphaned/no rotation". The data layer maps: `r.rotationId ?? 0`.

2. **`description` columns added in M008 (separate from M007)** — M008 uses `ALTER TABLE ADD COLUMN` with try/catch for "column already exists" safety. Both rotation_patterns and staffing_shifts get description.

3. **Category colors are hardcoded in the UI** — `CATEGORY_META` and `CATEGORY_DOT_COLOR` maps in `shift-definitions-grid.tsx`. DAY=amber, SWING=orange, NIGHT=indigo, OTHER=gray.

4. **Config activation is exclusive** — `activateStaffingConfig(id)` deactivates all other configs first, then activates the target.

5. **`staffing_shifts` cascade on config delete** — Deleting a config automatically deletes all its shifts (SQL `ON DELETE CASCADE`).

6. **TimePicker converts between Date and hour/minute numbers:**
   ```typescript
   function toTimeDate(hour: number, minute: number): Date {
     const d = new Date();
     d.setHours(hour, minute, 0, 0);
     return d;
   }
   // Reading back: form.startTime.getHours(), form.startTime.getMinutes()
   ```

7. **HeadcountInput uses key-based remounting** — `key={s.id}-${s.headcount}` forces React to create a fresh instance when the server value changes (e.g., after save + refresh). This avoids the "setState in useEffect" anti-pattern.

8. **Versioning (D-028):** All changes are additive — no breaking changes. This is a MINOR bump candidate (v0.3.0). The master plan documents the decision to keep Headcount Plans as Simple mode alongside the new rotation-based system.

9. **The `createStaffingShift` API requires `headcount`** — Must be >= 0. The UI sends `headcount: 0` as default on creation since the headcount field is not in the edit dialog.

## Environment

- **Branch:** `feat/capacity-mvp` (off `dev`)
- **Node/npm:** Standard Next.js setup
- **DB:** SQLite via better-sqlite3 at `data/dashboard.db`
- **Tests:** Vitest — `npx vitest run` (175/175 pass)
- **Build:** `npm run build` passes
- **Lint:** `npm run lint` — 0 errors, 21 warnings (all pre-existing)
- **Key framework versions:** Next.js 15+, Drizzle ORM, Auth.js v5, Tailwind CSS v4

## Key File Paths

| Purpose | Path |
|---------|------|
| DB schema (3 new tables) | `src/lib/db/schema.ts` |
| Migrations (M007 + M008) | `src/lib/db/schema-init.ts` |
| Bootstrap (seed data) | `src/lib/db/bootstrap.ts` |
| TypeScript interfaces | `src/types/index.ts` |
| Staffing data access (18 functions) | `src/lib/capacity/staffing-data.ts` |
| Staffing engine (pure functions) | `src/lib/capacity/staffing-engine.ts` |
| Staffing engine tests (36 tests) | `src/lib/capacity/staffing-engine.test.ts` |
| Module exports barrel | `src/lib/capacity/index.ts` |
| Rotation dots component | `src/components/admin/capacity/rotation-dots.tsx` |
| Rotation pattern editor | `src/components/admin/capacity/rotation-pattern-editor.tsx` |
| Rotation pattern list (left panel) | `src/components/admin/capacity/rotation-pattern-list.tsx` |
| Shift definitions grid (center panel) | `src/components/admin/capacity/shift-definitions-grid.tsx` |
| Config selector | `src/components/admin/capacity/staffing-config-selector.tsx` |
| Weekly matrix panel (right panel) | `src/components/admin/capacity/weekly-matrix-panel.tsx` |
| Staffing page (3-panel layout) | `src/app/(authenticated)/admin/capacity/staffing/page.tsx` |
| Admin capacity hub | `src/app/(authenticated)/admin/capacity/page.tsx` |
| Import schema: rotation-patterns | `src/lib/import/schemas/rotation-patterns.ts` |
| Import schema: staffing-shifts | `src/lib/import/schemas/staffing-shifts.ts` |
| TimePicker component | `src/components/ui/time-picker.tsx` |
| Master plan | `/home/guru/.claude/plans/quiet-questing-tulip.md` |
| Rotation staffing plan | `/home/guru/.claude/plans/tender-beaming-nova.md` |
| Capacity overview API (needs mode param) | `src/app/api/capacity/overview/route.ts` |
| Capacity V2 hook (needs mode param) | `src/lib/hooks/use-capacity-v2.ts` |
| Capacity page (needs mode toggle) | `src/app/(authenticated)/capacity/page.tsx` |

</critical_context>

---

<current_state>

## Verification Status
- **Type check:** Clean (`npx tsc --noEmit` — no errors)
- **Lint:** 0 errors, 21 warnings (all pre-existing, unrelated)
- **Build:** Passes (`npm run build`)
- **Tests:** 175/175 pass (`npx vitest run`)
- **All 8 test suites pass:** capacity-core (25), staffing-engine (36), demand-engine (30), contrast (13), csv-export (2), pagination (12), date-helpers (24), tick-interval (33)

## Git Status
- **Branch:** `feat/capacity-mvp`
- **Last commit:** `13ab3df feat(capacity): add WS-6 integration, import schemas, and docs`
- **Uncommitted changes:** 10 modified files + 16 new files/directories (ALL WS-7 work)
- **Nothing is staged** — needs `git add` + `git commit`

## Deliverable Status

| Deliverable | Status | Notes |
|-------------|--------|-------|
| 3 new DB tables (M007 + M008) | **COMPLETE** | rotationPatterns, staffingConfigs, staffingShifts |
| Staffing data access layer | **COMPLETE** | 18 functions in staffing-data.ts |
| Staffing engine (pure functions) | **COMPLETE** | 8 exported functions, 36 tests |
| API routes (14 files) | **COMPLETE** | Full CRUD + matrix endpoint |
| UI components (6 files, 2261 lines) | **COMPLETE** | All user refinements applied |
| Import schemas (2 files) | **COMPLETE** | rotation-patterns, staffing-shifts |
| Admin nav + hub page | **COMPLETE** | Staffing Matrix card added |
| CHANGELOG.md | **COMPLETE** | v0.3.0 section |
| Plan file update | **COMPLETE** | WS-7 + WS-8 documented |
| **WS-8 Mode Toggle** | **NOT STARTED** | Last remaining work stream |
| **Git commit** | **NOT DONE** | All work uncommitted |

## Open Questions

1. **Should WS-8 mode toggle default to Simple or Advanced?** — Current decision: default Simple (backwards compat). User may want Advanced as default once rotation data is populated.
2. **Should the capacity page show a migration path?** — e.g., "You have Headcount Plans configured. Switch to Advanced mode to use rotation-based staffing." No decision yet.

## Temporary State

- No workarounds or temporary hacks in place
- All code is production-quality
- The `payload` variable in `handleSave` was changed to `Record<string, unknown>` to accommodate the conditional `headcount` field — this is intentional, not a workaround

</current_state>
