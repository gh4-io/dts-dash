# Open Items

> Tracked questions, decisions needed, and unresolved issues.
> Format: `OI-###` with priority, status, and owner.
> **Restructured 2026-02-26** — open items at top; resolved items archived in compact tables below.

---

## Active Bugs

### OI-100 | Capacity Engine Ignores Shift Effective Dates — Historical Capacity Is Unstable

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-06 |
| **Resolved** | 2026-08-07 (`64f979b`) |

OI-080 added `rotationEndDate` and auto-versioning, but **nothing consumes the effective dates**. `resolveStaffingDay()` filters on `isActive` only — it never compares the target date against `rotationStartDate`/`rotationEndDate`. Worse, `isWorkingDay()` deliberately normalises negative offsets (`((diffDays % 21) + 21) % 21`), so a rotation projects infinitely backwards past its own start date.

Consequences: archived versions (`isActive = false`) disappear from **every** date, including the dates they were actually true for; the current version is applied to all of history. Historical capacity numbers therefore change every time someone edits headcount — the exact problem OI-080 was meant to solve.

**Fix**: filter on `rotationStartDate <= date && (rotationEndDate === null || date <= rotationEndDate)`, and stop using `isActive` to exclude archived versions from past dates.

**Resolution**: Added `isShiftEffectiveOn(shift, date)` — a version applies when the date falls inside `[rotationStartDate, rotationEndDate]`, null end meaning open-ended. `isActive` now gates only open-ended shifts, so an archived version still describes the dates it covered. Applied in `resolveStaffingDay()`, `computeCoverageGaps()` (per date, since an overnight shift is tested against both today and yesterday) and `computeWeeklyMatrix()` (`totalConfigHeadcount` scoped to the week viewed).

**Behaviour change**: dates before a shift's `rotationStartDate` now report zero headcount instead of a backwards-projected roster. Verified against the dev DB — 2025-11-01 returns 0 with `isNonOperating=true`, 2026-02-01 unchanged at DAY 23 / NIGHT 24.

**Files**: `src/lib/capacity/staffing-engine.ts`
**Links**: OI-080 (partial), OI-101, OI-102, OI-103

---

### OI-101 | Rotation Patterns Have No Versioning

| Field | Value |
|-------|-------|
| **Type** | Design Gap |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-06 |
| **Resolved** | 2026-08-07 (`97b019c`) |

`rotation_patterns` has no effective dating of any kind — no end date, no version column (`id, name, description, pattern, is_active, sort_order, created_at, updated_at`). Because the 21-char pattern string determines which days are worked, editing a pattern in place silently rewrites what every past date meant. OI-080 versioned `staffing_shifts` only.

**Decision (user, 2026-08-07)**: full versioning, mirroring shifts.

**Resolution**: M026 adds `effective_from`/`effective_to` plus `group_id` — a stable identity across versions. A shift keeps referencing a pattern *row*; resolution follows that row's group to the version whose window contains the date, so no shift needs repointing. `buildPatternResolver()` / `PatternResolver` replace the flat `Map<id, pattern>`; `buildPatternMap()` is kept as an alias returning a resolver. Editing the pattern string via PUT auto-versions; name/description/sort order/active state still edit in place. New PATCH supports `archive` and `can-archive`.

Also fixed a latent bug: `/api/capacity/overview` loaded patterns with `activeOnly=true`, which would have dropped superseded versions.

**Files**: `src/lib/capacity/staffing-engine.ts`, `staffing-data.ts`, `src/lib/db/schema-init.ts`, `rotation-patterns/[id]/route.ts`
**Links**: OI-080, OI-100, OI-102

---

### OI-102 | Shift Version Boundary Overlaps

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-06 |
| **Resolved** | 2026-08-07 (`1ab5f4b`) |

`versionStaffingShift()` sets the archived shift's `rotationEndDate` to **today**, but backdates the new version's `rotationStartDate` to **the Sunday of the current week** (via `alignRotationStartToSunday`, since patterns are 21-day Sunday-anchored). Versioning on a Thursday leaves the two versions overlapping Sunday→Thursday.

Currently harmless only because OI-100 means nothing reads the dates. Must be resolved as part of the OI-100 fix.

**Root cause**: `rotationStartDate` served two roles — the effective start *and* the anchor the 21-day pattern is indexed from (`pattern[0]` == that date). Moving the start rotated the pattern phase, so versions had to begin on the aligned Sunday.

**Decision (user, 2026-08-07)**: split the anchor from the effective date. New version takes effect on the **save date**; old version closes the day before.

**Resolution**: M025 adds nullable `staffing_shifts.pattern_anchor_date` (null falls back to `rotationStartDate`, so pre-M025 rows keep their phase). The new version inherits the old anchor, preserving rotation phase across a mid-week boundary. A same-day edit amends in place rather than inverting the window. Creating a new shift now honours the exact chosen start date and anchors the pattern to the aligned Sunday. `versionStaffingShift()` no longer accepts `rotationStartDate` in `changes`.

**Files**: `src/lib/capacity/staffing-data.ts`, `staffing-engine.ts`, `src/lib/db/schema-init.ts`
**Links**: OI-100, OI-101

---

### OI-103 | No Test Coverage for Shift Versioning

| Field | Value |
|-------|-------|
| **Type** | Test Gap |
| **Status** | **Open** — partially addressed |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-06 |

`staffing-versioning.test.ts` covered only the two pure helpers (`alignRotationStartToSunday`, `canArchiveShift`).

**Done (2026-08-07)**: 32 engine tests added across OI-100/101/102 — window semantics for shifts and patterns, resolution either side of a version boundary, no backward projection, phase preserved across a mid-week split, group resolution when a shift references the superseded row id, and history staying stable when a newer version lands. Suite is now 705.

**Still open**: `versionStaffingShift()` and `versionRotationPattern()` — the archive-and-create transactions themselves — remain untested *in the suite*. Both live in `*-data.ts` and need a DB harness; no capacity test currently mocks the database (every existing test is pure-engine), so this needs a new fixture pattern.

**Update 2026-08-07**: `versionStaffingShift()` was exercised end-to-end against the dev DB while fixing OI-107 — editing `10WKD`'s hours archived it closed 2026-08-06 and opened a new version 2026-08-07 with `patternAnchorDate` inherited, no overlap and rotation phase preserved. That is manual verification, not coverage; the harness is still needed. `versionRotationPattern()` remains manually verified only.

**Links**: OI-100, OI-101, OI-102

---

### OI-043 | Chunked Upload Location Header Returns Localhost Behind Proxy

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** — fix committed, not yet deployed/verified |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |

When Power Automate initiates a chunked upload, the server returns a `Location` header pointing to `https://localhost:5015/api/ingest/chunks/{sessionId}`. PA rejects this. Fix applied (use `X-Forwarded-Host` / `X-Forwarded-Proto` headers) but not deployed.

**Verification needed**: (1) Confirm Cloudflare Tunnel sends `X-Forwarded-Host` + `X-Forwarded-Proto`. (2) Deploy to Braxton and restart. (3) Test chunked upload — Location header should read `https://cvg.gh4.io/...`.

**Files**: `src/app/api/ingest/route.ts` (lines 140–145)
**Links**: OI-034, OI-037, [REQ_DataImport.md](SPECS/REQ_DataImport.md)

---

### OI-083 | Flight Board ECharts Chart Does Not Update on Theme Switch — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | -- |
| **Created** | 2026-02-26 |
| **Resolved** | 2026-02-26 |

**Root cause**: Two issues combined: (1) CSS variable resolution via `getComputedStyle` ran synchronously in `useMemo` during render, racing with the browser's style recalculation after `next-themes` changed the `class` attribute on `<html>`. (2) Passing the ECharts built-in `"dark"` theme caused `echarts-for-react` to `dispose()`+`reinit()` the canvas instance on theme switch, which raced with the async CSS variable update and discarded post-init effects (NOW line, midnight markers).

**Fix**: (1) Moved CSS variable resolution from `useMemo` to `useEffect` + `requestAnimationFrame`, guaranteeing `getComputedStyle` reads values after browser paint. (2) Removed the ECharts built-in theme prop entirely -- all chart colors are explicitly set via resolved CSS variables (`cc`), so the heavy dispose+reinit cycle is unnecessary. Theme switches now flow through `setOption`/`notMerge` option updates. (3) Added `cc` to the NOW line + midnight markers effect dependency array so those overlays are re-applied after theme-triggered option changes.

**Files**: `src/components/flight-board/flight-board-chart.tsx`
**Links**: [REQ_Themes.md](SPECS/REQ_Themes.md), OI-047

---

### OI-047 | Flight Board Chart Color Reset on Rapid Clicks

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P1 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Customer colors on the flight board Gantt occasionally revert to defaults after rapid clicks. Likely: ECharts state mutation during rapid updates, or Zustand customer store not syncing across re-renders.

**Investigation**: Debug ECharts chart update flow; verify Zustand customer store invalidates correctly; consider key-based cache invalidation for series colors.

**Files**: `src/components/flight-board/flight-board-chart.tsx`, `src/lib/hooks/use-customers.ts`

---

### OI-074 | Dashboard Aircraft & Turns Section Date Mismatch

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-25 |
| **Resolved** | 2026-02-26 |

Aircraft & Turns section on `/dashboard` does not reflect date selection from the global FilterBar. The card was computing its displayed date range from the min/max of WP arrival/departure times, which could extend beyond the filter window due to the overlap query. Fixed by passing the FilterBar's `start`, `end`, and `timezone` to the card so the subtitle always reflects the user's selected date range.

**Files**: `src/app/(authenticated)/dashboard/page.tsx`, `src/components/dashboard/total-aircraft-card.tsx`
**Links**: [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md)

---

### OI-079 | Staffing Peak Day Calculations Overflow

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-02-26 |
| **Resolved** | 2026-02-26 |

"Peak Day" values on `/admin/capacity/staffing` display unrounded decimals that overflow cells. Round to 2 decimal places.

**Fix**: Applied `fmtNum(value, 2)` to both Peak Day and Min Day headcount displays in `weekly-matrix-panel.tsx`.

**Files**: `src/components/admin/capacity/weekly-matrix-panel.tsx`

---

### OI-081 | Server Settings: Cleanup Grace Period Duplicated

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P3 |
| **Owner** | Claude |
| **Created** | 2026-02-26 |
| **Resolved** | 2026-02-26 |

"Cleanup Grace Period" setting appeared twice on the Admin Settings page — once in the "Flight Display" section (system setting) and once as a standalone input in the "Cleanup Canceled WPs" action card. Removed the duplicate input from the cleanup card. The cleanup action now reads the grace period from the Flight Display system setting (`flightSettings.cleanupGraceHours`), with a fallback to `DEFAULT_CLEANUP_GRACE_HOURS`. The cleanup card description now shows the current grace period value for context.

**Files**: `src/components/admin/server-tab.tsx`

---

### OI-131 | Dashboard Chart Changed Its Numbers When an Operator Was Clicked — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

The Arrivals / Departures / On Ground chart was counted in two places with two different definitions of "on ground", and clicking an operator row switched between them.

`computeHourlySnapshots()` counted presence **at the hour boundary** (`arrival <= hour && departure > hour`). The dashboard's client-side recount in `displaySnapshots` counted **overlap anywhere inside the hour** (`arrival < hourEnd && departure > hourStart`), and that recount only ran `if (focusedOperator)`. So with an operator already selected in the FilterBar the chart used the server's numbers; clicking that same operator's row in Operator Performance re-counted an identical set of work packages with the looser formula and the On Ground series jumped.

Measured against the production snapshot — CargoJet Airways, 2026-08-02 01:00 ET → 2026-08-10 13:00 ET, 77 WPs, 205 hours: **36 hours disagreed, by up to +5 aircraft.** The overlap formula is always ≥ the boundary formula, since it also counts anything arriving or departing partway through the hour.

Secondary divergence: the client recount reads `useTransformedData` output, so it also applied the Actions column filters, which the server snapshot knows nothing about. Any active column filter was a second, independent reason the two views disagreed.

**Resolution**: `countArrivalsInHour` / `countDeparturesInHour` / `countOnGroundAtHour` exported from the engine as the single definition of each series, accepting either `Date` or serialized-string rows. Both `computeHourlySnapshots()` and the dashboard now call them. The client recount is no longer gated on `focusedOperator` — it runs always, so it agrees with the server for the unfocused case and picks up the column filters consistently.

**Files**: `src/lib/data/engines/hourly-snapshot.ts`, `src/app/(authenticated)/dashboard/page.tsx`, `src/__tests__/dashboard/hourly-snapshot-consistency.test.ts`
**Links**: OI-124 (the other defect in this chart's data path)

---

### OI-132 | Dashboard Panels Define "Avg Ground" and "Share" Differently

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | Open |
| **Priority** | P3 |
| **Owner** | Jason (decision) |
| **Created** | 2026-08-08 |

Found while scanning for other instances of OI-131. These are cross-panel definitional mismatches, not server/client drift — every panel reads the same `view.wps`, they just measure different things under similar labels.

1. **Avg Ground.** `AvgGroundTimeCard` deliberately splits the set at 24 h and reports two averages; the Operator Performance table's "Avg Ground" column blends everything into one. For CargoJet over the range above: card shows **6:30** (60 short turns) and **36:45** (17 long), table shows **13:11**. All three are correct for their own definition, and none of them equal each other.
2. **Share.** The donut is share of **unique aircraft**; the table's "Share" column is share of **turns**. Same word, different denominator.

Needs a product call on whether these should be reconciled or just labelled more explicitly. No code change made.

**Files**: `src/components/dashboard/avg-ground-time-card.tsx`, `src/components/dashboard/operator-performance.tsx`, `src/components/dashboard/customer-donut.tsx`

---

### OI-133 | Customer Donut Percentages Can Exceed 100%

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | Open (latent) |
| **Priority** | P4 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |

`CustomerDonut` sizes each slice by that customer's unique `aircraftReg` count, but divides by the **global** unique-registration count. A registration flown under two customers is counted in both slices and once in the denominator, so the printed percentages sum above 100% — and worse, Recharts draws the arcs proportional to the sum of the slice values, so the wedge geometry and the printed label disagree.

**Latent today**: the production snapshot has **0 registrations appearing under more than one customer** (152 unique regs, slices sum to exactly 152). It becomes visible the first time an aircraft changes operator inside a filter window, which is plausible for leased tails.

**Fix**: divide by the sum of the slice values rather than the global unique count, or count `(customer, reg)` pairs in the denominator.

**Files**: `src/components/dashboard/customer-donut.tsx`

---

### OI-134 | Import History Grew Without Bound — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Resolved** |
| **Priority** | P3 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

`import_log` had no retention. The production snapshot held **12,159 rows** accumulated over ~170 days (2026-02-18 → 2026-08-07) at ~71/day, essentially all from the `api` ingest. Every single row had status `success`; **4,929 (41%) recorded zero inserts and zero updates**; `warnings`, `errors` and `field_mapping` were empty on all of them. The table plus its two indexes occupied **1.65 MB of an 8.8 MB database — 19%**.

**Growth**: ~139 bytes/row all-in × ~26,000 rows/year ≈ **3.5 MB/year**. Five years would reach ~130,000 rows and ~18 MB, taking the DB to ~27 MB with `import_log` at ~67% of it. Not a query-performance problem — the history page is `ORDER BY imported_at DESC LIMIT 10` against `idx_import_log_imported_at` and stays fast — but it inflates every backup, lengthens `VACUUM`, and buries the handful of runs anyone would actually read.

**Fix**: a `prune-import-history` cron job (nightly, `30 3 * * *`) deleting runs past a **configurable** window, default 10 days, `0` disabling it. Configurable via Admin → Cron; the generic `optionsSchema` renderer supplies the field, so no new settings form was needed. CLI twin `npm run db:prune-import-history -- --days=N`. Verified against the production copy: **12,159 → 589 rows, 1.65 MB → 102 KB**, work packages untouched, `foreign_key_check` clean, idempotent on re-run.

**The foreign key is the trap.** `work_packages.import_log_id` references `import_log(id)` with the default `NO ACTION`, and `src/lib/db/client.ts` sets `foreign_keys = ON`, so the delete fails outright unless those pointers are cleared first. The prune nulls them in the same transaction (5,180 rows on the production copy). The column is write-only provenance — nothing reads it — so nothing is lost. Guarded by an explicit FK regression test.

**Deliberately not done**: no summary/rollup store. See OI-136.

**Files**: `src/lib/cron/tasks/prune-import-history.ts`, `src/lib/cron/index.ts`, `scripts/db/prune-import-history.ts`, `src/app/api/admin/import/history/route.ts`, `src/components/admin/import/import-history.tsx`, `src/__tests__/db/prune-import-history.test.ts`

---

### OI-135 | Staffing Archives Flooded the Admin Lists — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Resolved** |
| **Priority** | P3 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

Every effective-dated edit to a shift or rotation leaves an archived version behind, so both admin lists grow indefinitely. Production has only 7 shifts (1 archived) and 6 patterns (0 archived) today, so this was **anticipated, not yet observed** — reproduced with `npm run db:seed-archives` (50 archived shifts + 50 archived pattern versions over 12 months).

At that scale `rotation-pattern-list.tsx` was much the worse of the two: it had **no archive concept at all**, rendering inactive patterns inline in the main list at `opacity-40` and merely sorting them last, so **56 rows appeared with the 6 real ones buried among them**. `shift-definitions-grid.tsx` at least collapsed to `Archive (n)`, but unpaginated, unfiltered, and sorted by `sortOrder`.

**Fix**: the rotation list gains a collapsed `Archive (n)` section mirroring the shift grid; both gain a search box, a 10-row cap with `Show more (n remaining)`, and archives sorted most-recently-retired first. Post-fix: 12 live rotations + `Archive (44)`, 6 live shifts + `Archive (51)`.

**⚠️ Archives must never be pruned — considered and explicitly rejected.** `isShiftEffectiveOn` / `isPatternEffectiveOn` in `staffing-engine.ts` resolve the roster for any **past** date from exactly these archived rows (see the comment at line 53). Deleting versions older than N days would silently zero out historical capacity and utilization for the periods they covered — the OI-108 failure mode returning through a different door. They are also tiny (a few versions per shift per year), so there is no storage argument. Both archive sections now carry a caption saying so, as a durable guard against a future "cleanup".

**Files**: `src/components/admin/capacity/rotation-pattern-list.tsx`, `src/components/admin/capacity/shift-definitions-grid.tsx`, `scripts/db/dev-seed-archives.ts`

---

### OI-136 | Pruned Import Runs Leave No Durable Trace

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | Open (deferred, by decision) |
| **Priority** | P4 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |

OI-134 deletes import runs outright. Past the retention window, "did the feed run on March 3rd, and did it do anything" becomes unanswerable.

Accepted deliberately. A per-day rollup table was designed and **rejected by Jason as unnecessary schema** — and there is no existing system log to hand the summary to: `/admin/audit` is a "Coming Soon" placeholder with no table behind it; `analytics_events` is user-behaviour telemetry with a `NOT NULL` user FK, a JSON blob for payload, and no retention of its own (moving the problem, not solving it); pino writes to stdout only; `cron_job_runs` holds one last-run row per job, not a history. Given every one of the 12,159 production rows was `success`, the trace has arguably never carried information.

**Revisit when the Audit Log is built for real.** That is the correct home: pruned import runs should fold into it as a per-day summary at that point, and the retention window can then be shortened without losing anything.

**Files**: `src/app/(authenticated)/admin/audit/page.tsx` (stub), `src/lib/cron/tasks/prune-import-history.ts`

---

### OI-137 | Drawer Links Hijacked the Flight Board Instead of Navigating — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | UX / Architecture |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-09 |
| **Resolved** | 2026-08-09 |

The flight detail drawer's links were not links. Each was a `<button>` that wrote the subject into the **global** filter store (`setAircraft` / `setOperators`) and flipped the board's view mode. Three consequences:

1. **The Back arrow did not work.** No navigation happened — the URL was only rewritten by the store→URL mirror, which uses `router.replace`, so no history entry existed. Back left the Flight Board entirely.
2. **The board's state was destroyed in place.** The user's filters were overwritten, the view forced to list, and the pan/zoom window discarded when the row set changed. There was nothing to go back *to*.
3. **The selection leaked.** `useFilterUrlSync` hydrated from the URL on mount but only *added* params it found, never clearing store values absent from the URL — so the selection followed the user to every other page for the session.

**Resolution** — the links now navigate to an isolated **Focus view**, `/flight-board/focus?scope=…&subject=…`:

- **`FlightBoardView`** (`src/components/flight-board/flight-board-view.tsx`) is the board's body, extracted and parameterised. Both `/flight-board` and the Focus route render it, so the Focus view has the *whole* board — Gantt **and** list, zoom presets, pan, expand, condense, print, Actions, date filtering. The Focus view **defaults to list on every device** — following one of these links asks a question whose answer is a set of rows — while the board keeps its device-based default. The Gantt is one click away and the choice is remembered per subject.
- **The subject lives in the URL, never in the filter store.** It narrows the fetched rows (`FOCUS_SCOPES[scope].match`) before any transform runs. Nothing the drawer does touches shared state, which is what makes Back correct rather than something to undo afterwards. It is **pinned**: no removable chip, and the title never shifts under the user.
- **The date window is inherited**, built from the live store by `buildFilterUrlParams` so the href is self-describing even before the debounced URL mirror has run — and meaningful when opened in a new tab.
- **Session-cached view state** keyed per view (`fbView:flight-board`, `fbView:flight-board:focus:<scope>:<subject>`) restores view mode, zoom level and the ECharts window, so Back lands on the view that was left. `sessionStorage`, so it is a "where I was" cache and not a preference competing with `defaultZoom`.
- **`useFilterUrlSync` fixed twice**: the store→URL mirror now seeds from the live URL and overwrites only the nine filter keys (otherwise it stripped `scope`/`subject` 300ms after arrival); and mount hydration is authoritative for the six selection lists — absent from the URL means empty, which is the leak in (3) closed generally.
- **The duplicate aircraft link is gone** — "View all `<reg>` work packages" and "All `<reg>` visits" were the same action under two labels. One link remains, labelled from `FOCUS_SCOPES` so it always equals the page title.

**Verified** in Chromium against a copy of production data: from a board filtered to `op=21 Air` at a 12h zoom, following "All N753CS visits" lands on `/flight-board/focus?…&scope=aircraft&subject=N753CS` titled *All N753CS visits*, showing that lane only, with the window and the operator filter intact and no N753CS chip; `scope`/`subject` survive the debounce; **Back returns to the board with the 21 Air chip, the Gantt, and the 12h window — and no leaked aircraft filter**. Focus→focus navigation works with Back at each step; `scope=nonsense` and a subject with no rows render empty states rather than throwing; operator names containing spaces round-trip. 0 console errors. `npm run validate` exits 0 — 936 tests / 44 files.

**Files**: `src/lib/utils/flight-board-focus.ts` (new), `src/components/flight-board/flight-board-view.tsx` (new), `src/app/(authenticated)/flight-board/focus/{page,error}.tsx` (new), `src/app/(authenticated)/flight-board/page.tsx`, `src/components/flight-board/flight-detail-drawer.tsx`, `src/lib/hooks/use-filter-url-sync.ts`, `src/lib/utils/filter-helpers.ts`, `src/__tests__/components/flight-board-focus.test.ts`
**Links**: OI-128 (superseded), OI-138 (found while verifying)

---

### OI-138 | End Date Picker Displays a Different Instant Than the One Queried

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | Open |
| **Priority** | P2 |
| **Owner** | — |
| **Created** | 2026-08-09 |

On a **fresh page load** the End picker renders a wall clock that does not correspond to the `end` the app actually queries with. Observed on `/flight-board` with TZ = Eastern:

- picker shows **`8/11/2026 10:00`**
- store holds **`2026-08-11T02:00:00.000Z`**, which is `8/10 22:00` Eastern
- `/api/work-packages/all` is called with `end=2026-08-11T02:00:00.000Z`

So the **data is right and the label is wrong** — the user is shown a window 12 hours wider than the one being fetched. Start is unaffected (`2026-08-08T14:00:00.000Z` → `8/8 10:00` ET, correct).

It corrects itself after a client-side navigation: arriving back on the board via the browser Back arrow, the same store value renders as `8/10/2026 22:00`. That points at the load-time ordering between `getDefaults()`, `PreferencesLoader.hydrateFromPreferences` and `setTimezone`'s `reinterpretDate` — the picker appears to render a value from before one of those steps.

**Confirmed pre-existing**, not introduced by OI-137: reproduced with that work stashed, on `dev` at `c916d37`. It surfaced only because the Focus view's href carries the raw store value, making the discrepancy visible.

**Files**: `src/components/shared/datetime-picker.tsx`, `src/lib/hooks/use-filters.ts`, `src/components/layout/preferences-loader.tsx`
**Links**: OI-137, OI-124 (the other filter-window defect), D-049

---

## Open Enhancements

### OI-107 | Shift Edit Dialog Rewrote History Instead of Versioning — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

OI-100/101/102 made the engine honour effective-date windows, but the shift **edit dialog** still saved via `PUT` → `updateStaffingShift`, mutating the current version's row in place. `PUT`'s allow-list accepted every field, so changing a shift's hours or rotation silently restated every date that version already covered — the exact failure OI-100 was filed to fix, re-entering through a different door. Only the inline headcount input on the shift bar versioned correctly (`PATCH {action:"version"}`).

`versionStaffingShift()` already accepted every field the dialog edits, so the plumbing existed and was simply unused.

**Resolution**: the dialog now splits its save. Fields that change what a date meant — `category`, `rotationId`, `startHour/Minute`, `endHour/Minute`, `breakMinutes`, `lunchMinutes`, `mhOverride`, `headcount` — go through `PATCH {action:"version"}`. Cosmetic fields — `name`, `description`, `rotationStartDate`, `rotationEndDate` — amend in place. Mirrors the split OI-101 settled for rotation patterns. `category` is versioned because it routes headcount into a capacity bucket; moving a shift to OTHER drops it from capacity entirely. A pending inline edit is cleared on dialog save so the two paths cannot disagree.

**Verified**: exercised `versionStaffingShift` against the dev DB — editing `10WKD` hours archived it closed 2026-08-06 and opened a new version 2026-08-07 with `patternAnchorDate` inherited, no overlap, phase preserved.

**Files**: `src/components/admin/capacity/shift-definitions-grid.tsx`
**Links**: OI-100, OI-101, OI-102, OI-103, OI-108

---

### OI-108 | Overlapping Shift Versions Double-Count Headcount — RESOLVED (detection)

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** — detection shipped; no schema-level lineage |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

Two versions of one shift effective on the same date are summed by the engine, silently doubling that shift's roster. Found in **live production data**: `13SMD` existed as `id=3` (9 AMTs, from 2025-12-01, open-ended) and `id=7` (11 AMTs, from 2026-08-04), both effective from 2026-08-04 — **20 AMTs for one shift**. The week of 2026-08-09 read 66 raw where the prior week read 55.

`versionStaffingShift` closes the predecessor the day before the successor opens, but a version created any other way — **Add Shift**, a direct `PUT`, an import — leaves the predecessor open-ended, and nothing flagged it.

**Resolution**: `findShiftOverlaps()` in the staffing engine detects same-name, same-config shifts whose effective windows intersect. Surfaced as a warning banner listing the shift, the version ids, the first overlapping date and the combined headcount, plus a per-row badge. 5 unit tests.

Detection is **by name**, the only lineage marker `staffing_shifts` carries — unlike `rotation_patterns`, which got a `group_id` in OI-101 (M026). A `group_id` on `staffing_shifts` would make this exact rather than heuristic; deferred, see OI-111.

**Data**: the live `13SMD` duplicate was resolved by the user before the fix landed (`id=3` end-dated 2026-08-03). **The same two rows still exist in production** and need the same correction on upgrade.

**Files**: `src/lib/capacity/staffing-engine.ts`, `src/components/admin/capacity/shift-definitions-grid.tsx`
**Links**: OI-100, OI-102, OI-107, OI-111

---

### OI-109 | Weekly Matrix Headcount Silently Discounted by paidToAvailable — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

`WeeklyMatrixCell.headcount` held `roster × paidToAvailable` (0.89 in production) but was rendered under a column labelled **HC**, rounded to an integer, so the discount was invisible: a raw 66 displayed as **59**. In the same panel, `totalConfigHeadcount` was raw, putting two headcount figures on different bases side by side. `capacity-core.ts` already modelled this correctly with separate `rosterHeadcount` / `effectiveHeadcount`; the weekly matrix had collapsed both into one ambiguous field.

**Resolution**: `WeeklyMatrixCell` gains `rosterHeadcount` (undiscounted) and `effectiveHeadcount` (the MH basis). The HC column, avg daily, peak/min day and the category row-hiding checks use the roster; all MH math still uses effective. Peak/min dropped from 2 decimals to 0 — they were rendering "49.84" for a count of people.

The ambiguous `headcount` field was **retained as a deprecated alias** equal to `effectiveHeadcount`, so the `/api/admin/capacity/staffing-matrix` response stayed backwards-compatible per D-028, to be removed on the next MAJOR.

**Removed 2026-08-07 in v1.0.0 — that MAJOR.** `WeeklyMatrixCell` now carries only `rosterHeadcount` and `effectiveHeadcount`. No runtime consumer read the alias: the `peakDay`/`minDay` reducers in `weekly-matrix-panel.tsx` build their own accumulator objects from `rosterHeadcount` and merely happen to name the field `headcount`. The only references were six assertions in `staffing-engine.test.ts`, all already describing effective headcount in their comments, plus one test whose sole purpose was asserting the alias equalled `effectiveHeadcount` — tautological once the alias is gone, so it was deleted with it. A clean illustration of the vitest-does-not-type-check trap: those tests passed while the build broke.

Also: "Config Headcount" is scoped to the week start (OI-100), so it legitimately differs from the shift grid footer when a version takes effect mid-week. Label now reads "as of &lt;weekStart&gt;" rather than leaving two unequal totals unexplained.

**Files**: `src/types/index.ts`, `src/lib/capacity/staffing-engine.ts`, `src/components/admin/capacity/weekly-matrix-panel.tsx`
**Links**: OI-100, OI-110, D-028

---

### OI-110 | Paid/Available/Productive MH Chain Collapsed — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

`capacity-core.ts`'s own header documents a three-stage chain — `paidHours × paidToAvailable × availableToProductive × nightFactor` — where **paid** is payroll, **available** is what remains after PTO/training/absence, and **productive** is wrench time. Both engines applied `paidToAvailable` at the *paid* stage and then set `availableMH = paidMH`, collapsing the first two stages. The tell was Paid MH and Available MH rendering the identical figure (3105.2).

Consequence: **Paid MH understated by the paidToAvailable factor** (~11% at 0.89) and Available MH a meaningless duplicate.

**Resolution**: `paidMH = roster × paidHours`; `availableMH = paidMH × paidToAvailable`; `productiveMH = availableMH × availableToProductive × nightFactor`. Fixed in `computeWeeklyMatrix` and both compute paths in `capacity-core.ts` (so `/capacity` had it too).

**`productiveMH` is algebraically unchanged** — `roster × hours × p2a × a2p × nf` either way — so utilization, gap analysis, the heatmap and every capacity chart are untouched. `paidMH`/`availableMH` are display-only (`totalPaidMH`, shift drill-down, matrix totals). Live for Aug 2–8: Paid 3105.2 → **3399.0**, Available → **3025.1**, Productive unchanged in meaning.

**Note**: a test named `"availableMH equals paidMH (paidToAvailable absorbed into headcount)"` asserted the old behaviour, so this was a conscious simplification at some point — it just contradicted both the documented chain and the labels users read. Rewritten to assert the stages are distinct.

**Files**: `src/lib/capacity/capacity-core.ts`, `src/lib/capacity/staffing-engine.ts`, tests in both
**Links**: OI-109

---

### OI-111 | staffing_shifts Has No Version Lineage (group_id) — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Design Gap |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-08 |

**Done in v1.0.0 specifically because the DDL is additive but the backfill is not repeatable later.** Lineage was still reconstructible at the tag: every version of a shift shared a `name` within its `config_id`. The first rename after that point destroys the evidence permanently — nothing distinguishes "10WKD renamed to 10WKD-A" from two unrelated shifts, and no future migration can recover it. Deferring would not have meant "ship it in v1.1.0"; it would have meant shipping it against data that had been quietly corrupting itself since the tag.

**Resolution**: `group_id` + `idx_ss_group` on `staffing_shifts`, mirroring what `rotation_patterns` got in M026. `createStaffingShift()` seeds a new shift's group from its own id; `versionStaffingShift()` propagates the predecessor's, so a rename in `changes` can no longer split a lineage. `findShiftOverlaps()` keys on `groupId`, which fixes the detector in **both** directions — a renamed version's overlap was previously invisible, and two unrelated shifts sharing a name were previously reported as overlapping when they were not. Rows with a null `groupId` (a database not yet through `db:upgrade-v1`) fall back to the old name key, because reporting nothing is the worst possible outcome for a check whose job is catching a double-counted roster.

Backfilled in `db:upgrade-v1`: each row becomes its own lineage, then rows sharing `(config_id, name)` collapse onto the lowest id. Verified on the dev database — the `13SMD` pair (ids 3 and 7, the live OI-108 defect) collapsed to one lineage, the other five shifts each became their own, and a second run is a no-op.

**Not changed**: the bulk importer's `dedupKey: ["name", "configId"]` (`src/lib/import/schemas/staffing-shifts.ts`). A CSV cannot carry a `groupId`, and name is the legitimate way a user identifies a shift in an import; the null fallback keeps those rows working. Revisit only if imports start creating versions rather than upserting.

**Links**: OI-101 (the pattern precedent), OI-107, OI-108, OI-125, OI-126

---

### OI-125 | mh_override_history FK Aborted the cleanup-canceled Cron — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

Found in the pre-release DB future-proofing review. `mh_override_history.work_package_id` shipped (OI-104, one day earlier) as `NOT NULL REFERENCES work_packages(id)` with no `ON DELETE`, and `foreign_keys` is `ON` (`client.ts`). `cleanup-canceled` deletes `mh_overrides` and flight comments explicitly but **nothing anywhere deletes history rows** — so `DELETE FROM work_packages` threw `FOREIGN KEY constraint failed` and rolled back the entire job the first time a canceled work package had override history. Production carries 722 overrides, so history rows would have appeared immediately.

**Reproduced** before fixing: seeded one history row, deleted the override, attempted the work-package delete — `FOREIGN KEY constraint failed`.

**Resolution**: the reference is now logical, with no FK, matching `flight_events` / `time_bookings` / `billing_entries`. `ON DELETE CASCADE` was rejected deliberately — it would have traded a loud failure for a routine scheduled job silently erasing the append-only audit trail the table exists to preserve. History outlives its work package; a row pointing at a deleted WP is expected, not corruption.

SQLite cannot `ALTER` a constraint away, so `db:upgrade-v1` rebuilds the table, guarded on detecting the old FK and therefore idempotent. Verified: FK to `work_packages` gone, `users` FK retained, rows and both indexes preserved, the work-package delete now succeeds, the history row survives it, `integrity_check` clean.

**Links**: OI-104, D-067

---

### OI-126 | No UNIQUE Guard on the Single-Active-Row Tables — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Design Gap |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

`capacity_assumptions` and `staffing_configs` are both documented as having exactly one active row and enforced it nowhere. `loadActiveAssumptions()` selects on `is_active` with no ordering and `loadActiveStaffingConfig()` takes `LIMIT 1`, so a second active row would not fail — it would silently return an arbitrary one, changing every capacity number in the app based on row order. That is the same shape as OI-108's double-counted roster, and just as invisible.

Done now rather than later because a UNIQUE index that passes today may not pass in six months, and adding it to already-dirty data fails outright.

**Resolution**: partial unique indexes `WHERE is_active = 1` on both. Verified the constraint rejects a duplicate active row on each table, and that `activateStaffingConfig()` still works — it deactivates all before activating one, so the constraint is never transiently violated. `capacity_assumptions` is only ever updated in place by id, so it has no such flow.

Also made index creation in `db:upgrade-v1` report-and-continue rather than abort: a UNIQUE index failing on pre-existing duplicates should name the constraint the data breaks, not strand the upgrade halfway with a stack trace.

**Links**: OI-108, OI-111

---

`rotation_patterns` got a `group_id` in M026 (OI-101) giving versions a stable identity across edits. `staffing_shifts` never did — a shift's only lineage marker is its **name**. Consequences:

- `findShiftOverlaps()` (OI-108) must match on name, so renaming a shift hides an overlap and two genuinely distinct shifts sharing a name would false-positive.
- Nothing can render a shift's version history as one timeline.
- A rename splits the lineage silently.

**Scope**: add `group_id` to `staffing_shifts` (additive migration, backfill each existing row to its own id, then group known lineages), have `versionStaffingShift` propagate it, and switch overlap detection and any history view to group rather than name.

**Links**: OI-101 (the pattern precedent), OI-107, OI-108

---

### OI-112 | Weekly Matrix Clipped Values on Every Screen Size — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug (UI) |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

The weekly matrix table was wrapped in `overflow-hidden` (there for rounded corners) inside a panel narrower than the table's min-content width. Measured at 1440×900: wrapper **277px**, table **433px** — the entire Saturday column and the **Tot** column were clipped with no way to reach them.

Worse, the three-panel grid was `lg:grid-cols-[320px_1fr_320px]`, pinning the matrix column at 320px for **every** width from 1024px up. A 4K display was as cramped as a laptop; the middle column absorbed all extra space.

**Resolution**: wrapper is `overflow-x-auto` (matching the admin grids in OI-078) with `min-w-[420px]` on the table, and the grid widens the matrix column by breakpoint — `xl:400px`, `2xl:490px`.

**Verified across resolutions** (all three view modes: HC / Paid MH / Prod MH):

| Viewport | Matrix panel | Content | Result |
|----------|--------------|---------|--------|
| 3840×2160 | 462px | 462px | no scroll, Tot visible |
| 2560×1440 | 462px | 462px | no scroll, Tot visible |
| 1920×1080 | 447px | 447px | no scroll, Tot visible |
| 1366×768 | 357px | 433px | scrolls, Tot reachable |
| 820×1180 (iPad) | 489px | 489px | no scroll, Tot visible |

**Known, pre-existing and out of scope**: at 390px the entire admin content region collapses to ~103px, so every panel is squeezed. Not caused by this change — only `grid-cols-1` applies at that width. Filed as OI-113.

**Files**: `src/components/admin/capacity/weekly-matrix-panel.tsx`, `src/app/(authenticated)/admin/capacity/staffing/page.tsx`
**Links**: OI-078, OI-097, OI-113

---

### OI-113 | Admin Capacity Pages Unusable at Phone Width

| Field | Value |
|-------|-------|
| **Type** | Bug (UI) |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-08-07 |

At a 390px viewport the admin content region on `/admin/capacity/staffing` measures ~**103px** wide, so every panel inside it is squeezed to near-unusable. The page-level container, not the three-panel grid, is the constraint — `grid-cols-1` is correctly applied at that width.

Discovered while verifying OI-112 across resolutions. Pre-existing and unrelated to that fix. Admin capacity administration on a phone is a low-frequency case, hence P3, but the layout is currently broken rather than merely cramped.

**Scope**: trace the width constraint in the authenticated admin layout, and decide whether these pages get a mobile treatment or an explicit "use a larger screen" state.

**Links**: OI-112, OI-097 (iPad/tablet UX), OI-084

---

### OI-114 | Responsive Panel Priority on Admin Capacity Staffing — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Enhancement (UI) |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

Follow-on from OI-112. Making the weekly matrix legible was only half the problem — at reduced widths the page had no notion of which panel matters most, so the shift grid (the actual working surface) absorbed every squeeze. At 1366 it had fallen to 319px.

**Changes**

1. **Sidebar auto-collapses on narrow non-touch viewports.** Below 1536px the sidebar renders icons-only (240px → 56px). Keyed on `!isTouchCapable` rather than `device.type`, because a desktop window narrowed to 1024 classifies as `tablet` via the width-only fallback — exactly the case this targets. Genuine touch tablets keep their tap-to-toggle behaviour; OI-097 owns that surface.
   - The stored `mode` is **not** overwritten — auto-collapse is presentation-only via an `effectiveMode`, so widening the window restores the user's choice.
   - A non-persisted `autoOverride` flag plus the edge toggle (now shown on narrow desktop) makes it escapable; without it the collapse was a trap, since the header hamburger only appears when the sidebar is *fully* collapsed. Verified round-trip 56 → 240 → 56.

2. **Rotations panel condenses below 2xl** — the 21-dot pattern strip hides (still on the tooltip and in the editor), the **Select** bulk-mode toggle hides (kept mounted when already active so an in-progress selection is never stranded by a resize), and **Add** drops to a bare `+`. Column narrows 320px → 180/200px.

3. **Shift grid has a hard floor of 420px** (`minmax(420px, 1fr)`). At `lg` the weekly matrix leaves the side-by-side row and stacks full width beneath, so the squeeze lands on the panel that can afford it rather than the working surface.

4. **Editing a shift is always reachable.** The shift row itself is now `role="button"` + click/Enter/Space → editor, guarded so the checkbox, headcount input and action buttons still win their clicks. The icon buttons are hover-gated on pointer devices and can be cramped at narrow widths; the row is the guaranteed route in.

**Verified**

| Viewport | Sidebar | Columns | Shift grid | Matrix |
|----------|---------|---------|-----------|--------|
| 1920×1080 | 240px | 340 / 778 / 490 | 778px | side-by-side, no scroll |
| 1366×768 | 56px | 200 / 638 / 400 | 638px (was 319) | side-by-side |
| 1100×800 | 56px | 180 / 605 | 605px | stacked, 797px |
| 1024×768 | 56px | 180 / 713 | 713px | stacked |

No horizontal page scroll at any width; 6 editable rows and row-click-to-edit confirmed at each. Clicking the headcount input does not open the dialog.

**Files**: `src/lib/hooks/use-sidebar.ts`, `src/components/layout/sidebar.tsx`, `src/components/admin/capacity/rotation-pattern-list.tsx`, `src/components/admin/capacity/shift-definitions-grid.tsx`, `src/app/(authenticated)/admin/capacity/staffing/page.tsx`
**Links**: OI-112, OI-075 (4-tier nav), OI-097, OI-113

---

### OI-115 | Two Capacity Engines / Dead Settings Misled Configuration — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug (Architecture) |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

The app carried **two unrelated capacity models**, with different settings, different formulas and different answers for the same roster:

| | Engine A (legacy) | Engine B (capacity v2) |
|---|---|---|
| Code | `src/lib/data/engines/capacity.ts` | `src/lib/capacity/capacity-core.ts` + `staffing-engine.ts` |
| Setting | `app_config.realCapacityPerPerson` = 6.5 | `capacity_assumptions` = 0.89 × 0.65 |
| Formula | `headcount × 6.5` | `headcount × paidHours × 0.89 × 0.65` |
| Shift length | ignored | scales with it |
| 8 heads, 10h | 52 MH | 46.3 MH |

**Impact**: the user set "8 → 6.5" in Admin → Settings and reasonably expected it to govern, but that field belonged to Engine A — which **no page consumed**. `useCapacity` had zero consumers; `utilization-chart.tsx` and `config-panel.tsx` were never rendered. A live-looking setting drove nothing.

**Decision (user, 2026-08-07)**: the two-factor model in Engine B is correct as originally intended — the ratio was simply misremembered. **No formula or value changes.** Remove the dead engine and its settings.

**Resolution — deleted** (all confirmed to have zero live consumers first):
`src/lib/data/engines/capacity.ts`, `src/app/api/capacity/route.ts`, `src/lib/hooks/use-capacity.ts`, `src/components/capacity/utilization-chart.tsx`, `src/components/capacity/config-panel.tsx`.

Also removed: `theoreticalCapacityPerPerson`, `realCapacityPerPerson` and `shifts` from `AppConfig`, `config-defaults.ts`, `transformer.ts`, `/api/config` (response + write whitelist) and the `bootstrap.ts` seeds; the **Capacity Model** and **Shift Configuration** sections from Admin → Settings; and the orphaned `ShiftDefinition` / `DailyDemand` / `DailyCapacity` / `ShiftCapacity` / `DailyUtilization` types.

**Kept**: the **Demand Model** section — `defaultMH` and `wpMHMode` are live, feeding `computeEffectiveMH` in `transformer.ts`.

Verified `/api/capacity/overview` reads `capacity_shifts` via `loadShifts()`, not `app_config.shifts`, so the live v2 hook was unaffected. Full clean rebuild (`rm -rf .next`) — `npm run validate` exits 0, 714 tests.

**Note**: existing `app_config` rows for the three removed keys are left in place — harmless orphans, no longer read or seeded. Production has them too.

**Files**: 5 deleted; `config-defaults.ts`, `transformer.ts`, `api/config/route.ts`, `bootstrap.ts`, `types/index.ts`, `admin/settings/page.tsx`
**Links**: OI-109, OI-110, OI-116, D-028

---

### OI-116 | Productivity Chain Undocumented in the UI — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Enhancement (UX) |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

`paidToAvailable` and `availableToProductive` **multiply** — 0.89 × 0.65 = 0.5785 — but nothing in the UI said so, so the pair reads as a single ratio and the resulting MH looks wrong.

**Resolution**: an explainer block under Productivity Factors on `/admin/capacity/assumptions` stating the formula `HC x HOURS x ATT x PROD [x NIGHT] = Productive MH`, a worked example using the live values (`8 heads x 10h x 0.89 x 0.65 = 46.3 MH`), a definition list naming each stage (Paid → Available → Productive) and what each factor removes, and the combined efficiency (57.9%) with an explicit note that the factors multiply rather than average. A one-line form of the same chain sits above Weekly Totals in the staffing weekly matrix, where the numbers are actually read.

Also on that page (delegated): the three Productivity Factor percentages are now **click-to-edit** — click the value, type, Enter or blur commits, Escape cancels; clamped to each field's range, non-numeric restores the previous value. Opt-in `editable` prop on `SliderField`, so non-percent fields (Default MH, Arrival/Departure Weight) are unchanged.

**Files**: `src/components/admin/capacity/assumptions-form.tsx`, `src/components/admin/capacity/weekly-matrix-panel.tsx`
**Links**: OI-109, OI-110, OI-115

---

### OI-121 | Capacity Chart Legend Inert and Ambiguous — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Enhancement (UX) |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

Demand vs Capacity drew nine series in By Shift mode but labelled five — `legendType={i === 0 ? undefined : "none"}` collapsed three capacity lines and three utilization lines into one entry each — and nothing was clickable. Two near-identical orange curves had no label: Day `#f59e0b` and Swing `#f97316` were barely distinguishable, and within a shift the capacity and utilization lines shared a hue, differing only by dash.

**Resolution** (see D-065): one shared shift palette (`shift-colors.ts`) consumed by all six previously-duplicated sites; Swing re-hued to pink; role encoded by form (bar / dashed line / solid line with a per-shift dot shape); and a custom two-row `ChartLegend` where every entry toggles. Clicking **Days** hides the Day bar, capacity line and utilization line together; clicking **Capacity** hides that role across all shifts. Applied to all three charts behind the aggregation toggle.

Demand has no separate legend entry when the entity row is present — those bars are the entity entries. Shift labels read as plurals ("Days", "Swings", "Nights"), per Jason.

**Extended to the dashboard** — Arrivals / Departures / On Ground on `/dashboard` had the same inert legend (it even set `pointerEvents: "none"` explicitly) and now toggles the same way. `ChartLegend` moved to `src/components/shared/` so both pages share one implementation. The print render path keeps Recharts' own legend — there is no wrapper element to place ours in — but a series hidden on screen drops out of both the plot and the printed legend (`hide` + `legendType="none"`).

**Files**: `src/lib/utils/shift-colors.ts` (new), `src/components/shared/chart-legend.tsx` (new), `src/components/capacity/chart-series-style.tsx` (new), `src/lib/hooks/use-chart-series-visibility.ts` (new), `capacity-summary-chart.tsx`, `monthly-rollup-chart.tsx`, `forecast-pattern-chart.tsx`, `capacity-pie-charts.tsx`, `capacity-heatmap.tsx`, `shift-drilldown-drawer.tsx`, `admin/capacity/projection-grid.tsx`, `admin/capacity/headcount-grid.tsx`, `dashboard/combined-chart.tsx`
**Links**: D-065, OI-117

---

### OI-117 | Capacity Page Ignored Every Filter — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

Filters did nothing on `/capacity`, for three independent reasons found while driving the live page:

1. **No filter values to pick.** `ColumnsFilterDialog` — the only live operator/aircraft/type picker, since `FilterDropdown` and `FilterBarMobile` are dead code imported by nothing — reads its option lists from `useWorkPackagesStore().facets`, populated only by `useWorkPackages()`. The capacity page never calls that hook, so the Operator dropdown rendered "No values" and no filter could be set at all.
2. **`!=` / `not in` never left the browser.** `handleApply` bridged only `=` and `in` on the three API columns into the filter store; negative rules fell through to `useActions().columnFilters`, applied client-side by `useTransformedData` — a hook `/capacity` does not use. `Operator != Kalitta Air` carried over from the flight board rendered a chip and changed nothing.
3. **Server-computed demand saw only work packages.** Status, Ground Time, Arrival, Departure, Man-Hours and Shift rules never reached the API; and `/api/capacity/overview` loaded demand contracts, flight events, time bookings and billing entries unfiltered, so an operator filter could not remove that customer from the allocated/worked/billed lenses, the KPI strip or the pies.

**Resolution**:
- `?facetsOnly=1` on `/api/work-packages/all` + `fetchFacets()` in the work-packages store, called from `TopMenuBar` — which is on every page, so option lists populate everywhere without shipping ~2000 rows.
- Exclusions became first-class filter state: `excludeOperators` / `excludeAircraft` / `excludeTypes` in `FilterState`, in the URL as `nop` / `nac` / `ntype`, applied in `applyEntityFilters` after the inclusions (an exclusion always wins). The dialog bridges `!=` / `not in` into them and hydrates them back as `not in` rows; `TopMenuBar` renders `≠ Value` chips and clears them in Clear All.
- The remaining rules are serialized to a `cf` query param and applied server-side via `applyColumnFiltersToRecords()`, a `Date`-aware wrapper over the same `applyColumnFilters` the client uses, so both sides evaluate identically. `timezone` is now sent too, which the `shift` rule needs.
- `makeCustomerPredicate()` filters demand contracts, flight events, time bookings and billing entries. Aircraft/type filters are deliberately NOT applied to flight events — `FlightEvent.aircraftReg` holds a flight number, not a registration.
- `useCapacityV2` now waits for `_urlSynced` and aborts in-flight requests, matching `useWorkPackages`. Without it a deep link fired two overlapping fetches and the stale one could win — enough on its own to make a filter look ignored.
- Work packages are now filtered on the same whole-day bounds as the capacity grid; the sub-day timestamps produced partial demand against full-day capacity.

**Verified live** against production data: `Operator not in [Kalitta Air]` takes Total Demand 471 → 442 MH and Avg Utilization 55.7% → 52.1%, with Kalitta gone from the By Customer breakdown; `Man-Hours > 5` takes it to 116 MH (that chip previously did nothing).

**Files**: `src/lib/utils/filter-helpers.ts`, `src/lib/utils/data-transforms.ts`, `src/lib/hooks/use-filters.ts`, `src/lib/hooks/use-filter-url-sync.ts`, `src/lib/hooks/use-work-packages.ts`, `src/lib/hooks/use-capacity-v2.ts`, `src/components/shared/top-menu-bar.tsx`, `src/components/shared/actions-menu/columns-filter-dialog.tsx`, `src/app/api/work-packages/all/route.ts`, `src/app/api/capacity/overview/route.ts`, `src/types/index.ts`
**Links**: OI-118, OI-119, OI-120, D-065, REQ_Filters.md

---

### OI-118 | Date and Overnight-Shift Column Filters Matched Nothing — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

Found while writing tests for OI-117; both predate it and affect the flight board too.

`evaluateCondition()` compared ordering operators numerically via `parseFloat`, which reads `"2026-08-07T12:00:00Z"` as `2026`. Every Arrival/Departure rule therefore compared 2026 against 2026 and quietly matched nothing.

`getOverlappingShifts()` walked calendar days starting at the arrival day's midnight, but the Night window that contains an early-morning arrival (23:00 → 07:00) belongs to the **previous** day. A 02:00 arrival was reported as Day-only, contradicting `getPrimaryShift()`, which correctly said Night.

**Resolution**: ordering comparisons require a fully numeric string before treating a value as a number and fall back to `Date.parse` otherwise; the shift walk starts one day earlier, with the early-exit suppressed on the lead-in day. 8 new tests.

**Files**: `src/lib/utils/data-transforms.ts`, `src/lib/utils/shift-helpers.ts`
**Links**: OI-117

---

### OI-119 | Timezone Selector Does Nothing on /capacity — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-08-07 |
| **Resolved** | 2026-08-07 |

`/api/capacity/overview` builds its day grid from UTC dates (`generateDateRange`) and shift bucketing reads each shift's own stored timezone (D-049). The UI TZ selector therefore only re-interprets the start/end timestamps — every day boundary, heatmap row and rollup stays UTC. A user switching to Eastern sees no change and has no way to know the numbers are not on their clock.

**Investigation corrected the premise.** Capacity is *not* computed on UTC. `enumerateGroundSlots` (`demand-engine.ts:109`), `aggregateConcurrencyByShift` (`concurrency-engine.ts:87`) and `computeAllEventWindows` (`flight-events-engine.ts:125`) all bucket on `shifts[0].timezone` — the operational clock set in Admin → Capacity → Shift Timezone, which is `America/New_York` in production. Only the *day grid* was UTC, and it was the odd one out.

That makes the selector's promise unimplementable rather than merely unimplemented: honouring a display timezone would mean re-slicing the roster's own days onto the viewer's clock, splitting every 07:00–15:00 Eastern shift across two buckets. So the day grid was moved onto the operational clock (a real correctness fix), and the selector is locked rather than made to work.

**Resolution**:
- New pure helpers `toLocalDateStr()` / `buildDayGrid()` in `tz-helpers.ts`; the route builds its grid with `buildDayGrid(start, end, operationalTimezone)`. This also fixed a silent data loss — with a UTC grid and Eastern buckets, demand landing on the operational day before the grid's first date was clamped away by the `dateSet` filter.
- Column-filter rules on this route (`shift`, arrival, departure) now evaluate on the operational clock, not `filterParams.timezone`; the client stopped sending `timezone` for this endpoint.
- `TopMenuBar` gained an optional `timezoneLock` prop. `/capacity` passes the operational timezone, which renders the TZ selector disabled with a lock icon and a tooltip naming the zone and where to change it, and points the date pickers at the same clock so the typed window matches the computed one.

**Follow-up filed**: OI-122 — `aggregateConcurrencyByDay` still groups on UTC dates and its result is joined to operational-clock demand dates.

**Files**: `src/lib/capacity/tz-helpers.ts`, `src/lib/capacity/index.ts`, `src/app/api/capacity/overview/route.ts`, `src/lib/hooks/use-capacity-v2.ts`, `src/components/shared/top-menu-bar.tsx`, `src/app/(authenticated)/capacity/page.tsx`, `src/types/index.ts`, `src/__tests__/capacity/tz-helpers.test.ts`
**Links**: OI-117, OI-122, D-049

---

### OI-122 | Daily Concurrency Aggregates on UTC Days, Joined to Operational Days

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-08-07 |

Found during OI-119. `aggregateConcurrencyByDay()` (`src/lib/capacity/concurrency-engine.ts:26-41`) groups hourly buckets by `b.hour.split("T")[0]` — the UTC date — and documents itself as UTC-only because it has no shift context. `applyConcurrencyPressure()` then looks that map up by `day.date`, which is an *operational-clock* date produced by the demand engine. Under the production `America/New_York` shift timezone the two disagree by 4–5 hours, so each day's `peakConcurrency` / `avgConcurrency` carries the wrong tail hours. Its sibling `aggregateConcurrencyByShift()` already resolves the shift timezone correctly, so only the daily rollup is affected.

Informational only — concurrency does not feed utilization (D-045). The fix is to give the daily aggregate the same shift context its sibling has, which changes its documented UTC contract; left alone in OI-119 to keep that change from riding along untested.

**Links**: OI-119, D-045

---

### OI-120 | Non-API Column Filters Still Inert on Some Surfaces

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-08-07 |

OI-117 routed the full column-filter rule set to the capacity API, so `/capacity` now honours every rule the dialog can express. The same rules are still applied only client-side elsewhere (`useTransformedData`), which is correct for the flight board and dashboard but means two code paths evaluate the same rules. They share `applyColumnFilters`, so semantics match today; a future divergence would be silent.

Also unresolved: the Actions → Filters → **Rows** menu item is disabled app-wide and has never been implemented.

**Links**: OI-117

---

### OI-124 | Dashboard Hourly Chart Ignored the Filter Date Range — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

Found while capturing README screenshots (OI-106). The dashboard's **Arrivals / Departures / On Ground** chart — the largest element on the page — drew the same window around *now* no matter what date range was selected. With the filter set to **Feb 28 – Mar 9 2025**, every other panel updated correctly (57 aircraft, 141 turns, operator table, KPI cards) while the chart still rendered **Aug 8–10 2026** with identical data. Any range that did not happen to include today showed the wrong data, silently.

**Root cause**: `useHourlySnapshots` was the only data hook lacking both halves of the OI-117 fix — it had no `_urlSynced` gate and no abort controller. The filter store starts on defaults and is hydrated from the URL a moment later, so every load fired two fetches: one for the default (roughly *now*) range and one for the URL's range. With nothing cancelling the first, whichever resolved last won, and it was usually the default.

`useCapacityV2` and `useWorkPackages` both received this treatment under OI-117; this hook was missed because `/dashboard` was not the page being debugged at the time.

**Resolution**: mirrored the established pattern — module-level `AbortController` so only the latest fetch can commit, an early return until `_urlSynced`, and `isLoading` reported until hydration completes so the chart shows its skeleton rather than a wrong window.

**Verified** at Feb 28 – Mar 9 2025: the chart now spans Mar 1–9 with the NOW marker correctly absent, and matches the operator table beside it.

**Links**: OI-117 (same defect class), OI-042, OI-106

---

### OI-127 | Dashboard Cross-Filtering Snapped Instead of Transitioning — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | UX |
| **Status** | **Resolved** |
| **Priority** | P3 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

Selecting an operator (or changing the FilterBar) rewrote every dashboard panel in one frame: rows left the MH list and the operator table, the donut re-sliced, the KPI numbers jumped. Two causes — the page swapped itself for `LoadingSkeleton` on *every* refetch, not just the first, and nothing interpolated between the old and new content.

**Resolution**:
- `useSmoothUpdate` (`src/lib/hooks/use-smooth-update.ts`) defers one memoized snapshot of `{ wps, snapshots, focusedOperator }` and commits it inside `document.startViewTransition`, so the synchronous (cross-filter click) and asynchronous (FilterBar refetch) paths animate identically. Falls back to a plain state update where the API is missing or `prefers-reduced-motion: reduce` is set, and skips a still-running transition when a newer value arrives.
- Seven `.vt-*` names in `globals.css` give each panel its own transition group at **500ms** `cubic-bezier(0.4, 0, 0.2, 1)`, so the boxes and the space between them morph rather than cross-fade as one page.
- The skeleton now renders only while `workPackages` is empty; a refetch keeps the current panels on screen.

**Verified** in Chromium against production data: one transition per cross-filter click, all seven groups at 500ms, no skeleton flash on a date change, 0 console errors.

**Files**: `src/lib/hooks/use-smooth-update.ts`, `src/app/(authenticated)/dashboard/page.tsx`, `src/app/globals.css`, `src/components/dashboard/avg-ground-time-card.tsx`

---

### OI-128 | Flight Board Linked-Information Links Landed on the Gantt — SUPERSEDED

| Field | Value |
|-------|-------|
| **Type** | UX |
| **Status** | **Superseded** by OI-137 (2026-08-09) |
| **Priority** | P3 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

> **Superseded**: this resolution treated the symptom. Switching the board to list
> view still left the user *on the board*, with their filters overwritten and no
> history entry to go back to. `onFollowLink` and the filter mutation behind it
> were both removed by OI-137, which gives the links a page of their own.

The flight detail drawer's three links — *View all `<reg>` work packages*, *All `<reg>` visits*, *All `<customer>` work packages* — each apply a filter whose result is a **set of rows**, but left the board in Gantt view.

**Resolution**: `FlightDetailDrawer` takes an `onFollowLink` callback, fired by all three links; the flight board passes `() => setViewMode("list")`. Verified: following the aircraft link applies `ac=N753CS` and renders the list table.

**Files**: `src/components/flight-board/flight-detail-drawer.tsx`, `src/app/(authenticated)/flight-board/page.tsx`

---

### OI-129 | Login Page Showed the Strapline Twice — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | UX |
| **Status** | **Resolved** |
| **Priority** | P4 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

"Line Maintenance Operations" was hardcoded twice on `/login` — under the title and again at the bottom of the card. The lower copy is gone and the remaining one is now config-driven: **`app.subtitle`** in `server.config.yml` (default `"Line Maintenance Operations"`), loaded by `getAppSubtitle()` and exposed to client components as `useAppSubtitle()`, matching the `app.title` pattern.

**Files**: `src/app/login/page.tsx`, `src/lib/config/loader.ts`, `src/components/layout/app-config-provider.tsx`, `src/app/layout.tsx`, `server.config.dev.yml`

---

### OI-130 | Actions → Reset Left the Date Window Untouched — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | UX |
| **Status** | **Resolved** |
| **Priority** | P3 |
| **Owner** | Claude |
| **Created** | 2026-08-08 |
| **Resolved** | 2026-08-08 |

Reset cleared the transforms and the operator/aircraft/type selections but left whatever start/end the user had picked, so "reset" never returned the page to what a fresh load shows.

**Resolution**: `handleReset` now calls the filter store's `reset()` (which restores the system default window along with every selection) and then re-applies the user's own default range via `hydrateFromPreferences` when preferences have loaded — the same precedence `PreferencesLoader` uses at startup. Verified: start moved 8/8 → 8/5, Reset returned it to 8/8 01:00 – 8/11 01:00 and dropped the `ac` filter.

**Files**: `src/components/shared/actions-menu.tsx`

---

### OI-106 | README Screenshots for GitHub — RESOLVED

| Field | Value |
|-------|-------|
| **Status** | **Resolved** 2026-08-08 — four screenshots in `docs/screenshots/`, embedded in README.md under Overview. Captured against a copy of production data at 1600x900, dark theme. **No mobile shot**: Playwright's viewport is not touch-capable, so device detection classifies a 390px window as narrow desktop and renders the desktop layout squeezed rather than the phone surface (bottom tab bar + list cards). A shot labelled "mobile" showing that would misrepresent it, so it was omitted rather than faked. Capturing one needs real touch emulation. Also note the capture surfaced OI-124, a P1 defect in the dashboard chart. |
| **Type** | Documentation |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-08-07 |

`README.md` is entirely text. Since the repo is on GitHub (`gh4-io/dts-dash`), the README is the project's front page and currently shows nothing of what the app looks like.

**Scope**: add screenshots of the three core views — Flight Board (Gantt), Statistics Dashboard, Capacity Modeling — plus at least one Admin view and one mobile/PWA shot. Embed them in README.md near the Overview section so they render on the GitHub repo page.

**Notes**:
- Capture against a production data copy so the screenshots show realistic volume and customer mix, not thin seed data — see the working-preferences memory
- Dark theme is the default; consider one light-theme shot to show the theme system
- Store under a tracked path (e.g. `docs/screenshots/`) and reference with relative paths so they render both on GitHub and in local Markdown viewers
- Watch for anything sensitive in captures — customer names are fine, but avoid live URLs, tokens, or user emails
- Screenshots go stale; note in the README where they came from and roughly when

**Links**: [README.md](../README.md), OI-095 (feature tour)

---

### OI-104 | Work-Package Man-Hour Override Management — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Feature Request |
| **Status** | **Resolved** — 2026-08-08 |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-08-04 (filed 2026-08-06) |

Admin-facing workflow for managing per-work-package MH overrides without direct DB access. Editable man-hours in the WP detail drawer showing imported MH / effective MH / MH source together; explicit **Save Override** and **Clear Override** actions; no override created when the entered value equals imported `work_packages.total_mh` (clear the redundant one instead); bulk CSV workflow with a preview of matches, duplicates, invalid values, unchanged values and unmatched WP identifiers before commit; optional minimum-hours transformation retaining the original supplied value in the audit output; authenticated CRUD endpoints for `mh_overrides`; admin-role gated with user + timestamp recorded; cache invalidation so flight board and capacity refresh without a server restart; override history/audit view with before/after values and export.

**Acceptance criteria**: saved override becomes `effectiveMH` and is labelled **Override** app-wide; clearing restores the priority chain (imported WP MH → contract MH → default MH); capacity planned-demand reflects changes on the next request; bulk updates are transactional with a downloadable error/audit report; tests cover permissions, create/update/clear, redundant-value handling, cache invalidation, and capacity propagation.

The full spec is the body of this item. (An earlier note pointed at an untracked root `roadmap.md`; that file no longer exists — the surviving spec is here.)

**Resolution (2026-08-08)**: `mh_overrides` had existed since D-013 with no UI whatsoever — the only way to set one was direct SQL. Production carries **722** of them, all written by the API ingest, with no record of who set them or what they replaced.

- **Rules are pure** — `src/lib/mh-overrides/rules.ts` (no DB imports): parsing, range checks, the minimum-hours floor and the create/update/clear/unchanged/noop decision. DB access is isolated in `src/lib/mh-overrides/data.ts`.
- **Redundant values are never stored** (D-066) — a value equal to the imported `work_packages.total_mh` clears any existing override instead of writing one, from the drawer, the API and the CSV alike. The floor is applied *before* that check, and the pre-floor value is kept as `mh_override_history.supplied_mh`.
- **Drawer** — `flight-detail-drawer.tsx` shows Imported MH / Effective MH / MH Source together with **Save Override** and **Clear**, admin-gated. The flight board now re-reads the drawer's work package from the store after a write (`drawerWp`), so the drawer reflects its own edits instead of the click-time snapshot.
- **Endpoints** — `GET/POST/DELETE /api/admin/mh-overrides`, `GET/PUT/DELETE /api/admin/mh-overrides/[spId]`, `GET /api/admin/mh-overrides/history` (`?format=csv`). All `["admin","superadmin"]`; every mutation records the acting user and timestamp.
- **Bulk CSV rides the Universal Import Hub** — `src/lib/import/schemas/mh-overrides.ts`, not a parallel path. Preview counts (matched / unchanged / redundant / unmatched / duplicate / invalid) come from `classifyRows()`, which runs identically in `summarize()` and `commit()`. The batch commits in one `sqlite.transaction()`. **Matching accepts `workpackageNo`, then `spId`, then `guid`** — `workpackage_no` is the documented identifier (OI-086) but is populated on **zero** of the 10,080 production rows, so a `workpackageNo`-only matcher would have been correct and unusable.
- **Downloadable report** — `step-results.tsx` gained a **Download Report** button (CSV: stats + errors + per-row warnings) for every import type, not just this one.
- **History/audit** — new `mh_override_history` table declared in `createTables()` only (`runMigrations()` still returns `[]`; `db:upgrade-v1` picks it up by diffing against a reference schema). `mh_overrides` is UNIQUE per WP, so a clear destroys the old value — the append-only history is the only place before/after survives. Surfaced at `/admin/mh-overrides` (Active + History tabs, filter, both CSV exports).
- **Cache invalidation** — `invalidateMHOverrideCaches()` calls `invalidateTransformerCache()` alone. Overrides live in the transformer's `cachedOverrides`; the reader caches raw `work_packages` rows an override never touches, so invalidating it would re-read 10,080 rows for nothing. The bulk import defers per-row invalidation and fires once in `postCommit`.
- **Tests** — `src/__tests__/mh-overrides/` (4 files, 65 cases): pure rules, DB lifecycle + audit trail + cache propagation, route permission matrix and CRUD, and the bulk preview/commit/rollback path. Suite 804 → 869.
- **Verified live** against the production copy (10,080 WPs): an override took `effectiveMH` 3 → 25 with `mhSource: manual`, and `/capacity` `totalDemandMH` moved 332.35 → 354.35 on the next request with no restart; re-entering the imported value cleared it and both figures returned exactly. A mixed CSV previewed and committed with the expected counts.

**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), D-013, D-066, OI-086

---

### OI-105 | Cron Scheduler Administration and Disabled-State UX — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Feature Request |
| **Status** | **Resolved** — 2026-08-07 |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-08-04 (filed 2026-08-06) |

Make the scheduler's global state explicit and stop the Cron Jobs UI presenting controls that cannot take effect. `features.cronEnabled` stays the deployment-level hard gate (never writable from the web app); add a **DB-backed "Scheduler Active" runtime switch** available only when the deployment gate is on.

When the server gate is **off**: prominent "Cron scheduler disabled by server configuration" banner; jobs, schedules, options and run history shown read-only; enable/disable, schedule editing, option editing and **Run Now** all locked; explain that an authorised server admin must enable `features.cronEnabled` and restart. Clearly distinguish *disabled by server configuration* from *paused by an administrator*.

When the gate is **on**: admins can switch between **Running** and **Paused**; per-job enable/disable preserved beneath the global switch; show each job's next run, last run, last result and message; show last successful DB backup, configured retention, and warn when no successful backup exists within the expected interval; record global pause/resume with acting user and timestamp.

**Acceptance criteria**: no editable/executable cron controls appear active while the server gate is disabled; GUI pause stops execution without a restart and without changing server config; resume registers enabled jobs without duplicate schedules; **Run Now** respects the gate and role permissions; scheduler state and backup freshness are visible without inspecting container logs or the filesystem; tests cover all gate × runtime-state × role × restart × duplicate-registration combinations.

The full spec is the body of this item. (An earlier note pointed at an untracked root `roadmap.md`; that file no longer exists — the surviving spec is here.)

**Resolution (2026-08-07)**: `features.cronEnabled` was previously read in exactly two places — `config/loader.ts` and `startCron()` — and in none of the UI or admin API, so a gated-off deployment still rendered a fully live Cron Jobs page whose every control was a silent no-op, database backup included.

- Runtime switch stored as one JSON row in the existing `app_config` table (`cronSchedulerState`) — `src/lib/cron/scheduler-state.ts`. No new table; `runMigrations()` still returns `[]`.
- `src/lib/cron/scheduler-status.ts` — pure, client-safe resolution of gate × runtime state into `disabled-by-config | paused | running`, plus backup-freshness evaluation.
- `src/lib/cron/api-guard.ts` — `requireCronGate()` returns 409 from every mutating/executing route (create, update, delete, reset, run, pause/resume), so the gate is enforced server-side and not merely rendered.
- `startCron()` also honours the runtime pause, so a config edit calling `restartCron()` cannot silently resume a paused scheduler; `runJob()` re-checks at fire time.
- `GET/POST /api/admin/cron/scheduler` — state + backup health; pause/resume recorded with acting user and timestamp.
- UI: `cron-scheduler-panel.tsx` (three visually distinct states), read-only table and form, next-run column, backup freshness card with retention.
- Tests: `src/__tests__/cron/` — 58 cases across gate × runtime state × role, duplicate registration on resume, next-run calculation and `app_config` persistence.

**Links**: D-030 (cron management), [REQ_Admin.md](SPECS/REQ_Admin.md)

---

### OI-042 | Dashboard Chart Issues — PARTIALLY RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug + Enhancement |
| **Status** | **Partially Resolved** |
| **Priority** | P2 |
| **Resolved** | Items 1, 2, 4, 5 — 2026-02-18 |

Items 1 (pie tooltip), 2 (cross-filter timeline), 4 (timezone in header), 5 (aircraft & turns card) fixed.

**Still open — deferred to v0.3.0+:**
- **Item 3**: Pie chart popout vs single-pick interaction
- **Item 6**: Interactive chart brush selection + customer cross-filter (ECharts brush + Zustand state)

**Files**: `dashboard/page.tsx`, `customer-donut.tsx`, `combined-chart.tsx`
**Links**: [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md)

---

### OI-044 | Generic db:cleanup + Data Retention Policy

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Partially Resolved** |
| **Priority** | P2 |
| **Resolved** | Cron management system — 2026-02-17 (D-030) |

Built-in `cleanup-canceled` cron job with configurable `graceHours` works. **Remaining**: data retention policy (auto-delete WPs older than N days) not yet implemented. Can be added as a built-in job in `src/lib/cron/index.ts`.

**Links**: [REQ_Cron.md](SPECS/REQ_Cron.md), D-030

---

### OI-055 | Sticky Time Headers on Flight Board

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Resolved** | 2026-02-26 |

Moved time labels from body chart xAxis to header chart bottom xAxis. Header already uses `flex-shrink-0` so labels never scroll. Header height 95→135px, grid.bottom 8→46 for label room. Body chart grid.top 34→4 (no labels needed). Adaptive tick effect updated accordingly.

**Files**: `src/components/flight-board/flight-board-chart.tsx`

---

### OI-056 | Shift Highlighting with Visual Time Separators

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Resolved** | 2026-02-26 |

Added shift boundary markLines (dashed at 07/15/23, labeled Day/Swing/Night) and markArea background shading (subtle tints per shift). Theme-aware colors, DST-safe computation, multi-day support. `MarkAreaComponent` registered, `computeShiftBoundaries()` pure function, `shiftData` useMemo.

**Files**: `src/components/flight-board/flight-board-chart.tsx`

---

### OI-057 | Integrate react-to-print for Print/Export

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | -- |
| **Created** | 2026-02-20 |
| **Resolved** | 2026-02-27 |

Print support implemented for Dashboard and Flight Board pages using `react-to-print` v3. Three-layer approach: (1) `@media print` CSS forces Neutral-light variables on all 11 themes, hides chrome via `data-print="hide"` and `.print-hide`, resets layout flow. (2) Reusable `PrintButton` component with `useReactToPrint` hook. (3) ECharts canvas prep layer — `prepareForPrint()`/`restoreAfterPrint()` on chart handle.

**Final ECharts print implementation (Take 3 — 2026-02-27):**
- **Tick density**: compute tick interval synchronously in `prepareForPrint` using `filterStart`/`filterEnd` + `realZoomState` → `computeTickInterval({ availablePixels: 840, visibleMs })` → merge-mode `setOption({ xAxis: [{ interval }] })` before `resize()`. `chartWidthRef.current = PRINT_WIDTH` also set so the async adaptive tick effect reads the correct width when it fires. Belt-and-suspenders approach eliminates race condition from prior implementation.
- **Pixelation**: `getDataURL({ pixelRatio: 3 })` (official ECharts API) renders current chart state to an offscreen 2880px canvas (~288 DPI on letter paper). Insert as `<img width="960px">` before each ECharts div (hide the div); `restoreAfterPrint` removes imgs and unhides divs. Prior `painter.dpr` approach was incorrect — Zrender's `Layer` stores its own `dpr` set at construction time; `Layer.resize()` reads `layer.dpr`, not `painter.dpr`.
- **Page overflow**: `PRINT_MAX_BODY_H = 590px` cap on body height; `printMode` state shrinks header to 80px and hides dataZoom slider via `show: !printMode`.
- **Border**: `print:border-0` on both Gantt and List card wrappers.
- **Fit**: `PRINT_WIDTH = 960` CSS px = 10" × 96 CSS ppi (landscape letter − 0.5in margins). Physical DPI handled by browser rasterization.

**Remaining**: Capacity and Analytics pages not yet wired (reuse `PrintButton` + `printRef` pattern when needed).

**Files**: `globals.css`, `print-button.tsx`, `top-menu-bar.tsx`, `sidebar.tsx`, `header.tsx`, `bottom-tab-bar.tsx`, `flight-board-chart.tsx`, `dashboard/page.tsx`, `flight-board/page.tsx`

---

### OI-038 | Interactive Fuzzy Match Resolution

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |

Aircraft/customer imports with <70% confidence auto-rejected with no UI to confirm/override (e.g., "Singapore" → "Singapore Airlines" at 22%). Admin import validation step should show a mapping table with dropdowns per row — accept/skip/override. Also: CSV export shows operator FK IDs instead of human-readable names.

**Workarounds**: Lower threshold; add substring detection boost; pre-clean import data.

**Files**: `src/lib/utils/fuzzy-match.ts`, `src/lib/data/aircraft-import-utils.ts`
**Links**: [REQ_DataImport.md](SPECS/REQ_DataImport.md)

---

### OI-040 | System Settings Configuration File

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Updated** — partially complete |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-16 |

Timeline defaults migrated to `server.config.yml` ✅. **Remaining**: `ingestRateLimitSeconds`, `ingestMaxSizeMB`, `allowedHostnames`, `masterDataConformityMode` still in `app_config` DB — migrate to `server.config.yml` as file-based settings.

**Links**: `src/lib/config/loader.ts`, `server.config.yml`, OI-048, OI-049

---

### OI-048 | Rate Limiting as System Preference

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Move `ingestRateLimitSeconds` + `ingestMaxSizeMB` from `app_config` DB to `server.config.yml`. Expose in Admin Settings under API Integration section.

**Related**: OI-040
**Files**: `server.config.yml`, `src/lib/config/loader.ts`, admin settings page

---

### OI-049 | Admin Settings Tab Layout Redesign

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Admin Settings mixes DB-stored preferences with file-based system config under inconsistent save patterns. Split into two distinct sections: **System Configuration** (server.config.yml — requires restart) and **Database Preferences** (auto-save). Add visual distinction between the two.

**Files**: `src/app/(authenticated)/admin/settings/page.tsx`, `src/components/admin/server-tab.tsx`
**Related**: OI-040

---

### OI-050 | AOG Aircraft Condition & Visual Tracking

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-18 |

Track AOG (Aircraft on Ground — unscheduled maintenance) separately from canceled flights. Needs discovery on data source (WP JSON? admin-entered? inferred from status?). Visual treatment on flight board similar to canceled (D-034). Future: dedicated AOG analytics.

**Files**: `src/lib/db/schema.ts`, `flight-board-chart.tsx`, `reader.ts`
**Links**: D-034

---

### OI-080 | StaffingShift Rotation End Date + Auto-Versioning + Archive

| Field | Value |
|-------|-------|
| **Type** | Feature Request |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-02-26 |
| **Resolved** | 2026-03-04 |

Added `rotationEndDate` (nullable) to `staffing_shifts` table for creating a historical timeline. When headcount changes, the old shift is auto-archived and a new version created. Rotation start dates auto-align to Sunday (pattern[0] = Sunday). Collapsible archive section shows expired shifts with reactivate option. No-gap safety check warns when archiving the last shift in a category.

**Implementation**: M022 migration, `alignRotationStartToSunday()` + `canArchiveShift()` engine functions, `archiveStaffingShift()` + `versionStaffingShift()` data functions, PATCH endpoint for archive/version actions, collapsible archive UI.

**Files**: `src/types/index.ts`, `src/lib/db/schema.ts`, `src/lib/db/schema-init.ts`, `src/lib/capacity/staffing-data.ts`, `src/lib/capacity/staffing-engine.ts`, `src/lib/capacity/index.ts`, `src/app/api/admin/capacity/staffing-shifts/route.ts`, `src/app/api/admin/capacity/staffing-shifts/[id]/route.ts`, `src/components/admin/capacity/shift-definitions-grid.tsx`, `src/__tests__/capacity/staffing-versioning.test.ts`

---

### OI-084 | Sidebar Collapse — No Way to Expand — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-02-26 |
| **Resolved** | 2026-08-07 |

**Worse than filed, and not iPad-specific.** When `mode === "collapsed"` the sidebar renders at width 0, so its own edge toggle unmounts with it. The header did show a hamburger in that state, but it opened the **mobile nav sheet** — it never restored the sidebar. Since the mode is persisted to `localStorage`, a reload restored the collapse too, so there was genuinely no route back short of clearing site data.

Partially masked: an effect auto-expands whenever `device.width >= AUTO_ICONS_BELOW` (1536), so a roomy desktop self-heals on load. **Every width from 768 to 1535 stayed stuck** — laptops and tablets, i.e. exactly where the sidebar is the only navigation.

**Resolution**: the header's collapsed-state button now branches on width. Below `md` the sidebar is not the navigation (D-053) and the sheet remains correct; at `md` and above the button reads **Show sidebar** and calls `setMode("expanded")`.

**Verified** at 1280x800 with a stale `sidebar-mode: "collapsed"`: sidebar width 0 and no nav before, then 56px icons-mode with 5 nav links after one click, surviving a reload, with the edge toggle available to widen further.

**Noted, not changed**: `cycleMode()` in `use-sidebar.ts` is dead — nothing calls it, and it is the only code path that could ever set `"collapsed"`. The state is therefore only reachable from storage written by an older build. It is now escapable either way; removing the dead function is separate cleanup.

When sidebar is fully collapsed on iPad (lg breakpoint), the toggle button is hidden because it's inside the sidebar itself (`width: 0`). User has no way to expand it back without refreshing the page. The hamburger button in the header handles tablet (md-lg), but iPad specifically needs a sidebar toggle button that's always visible.

**Solution**: Add a sidebar toggle button in the header that's visible only on lg (iPad) and hidden on xl (desktop where sidebar is always expanded). Button should:
- Be visible with `hidden lg:block xl:hidden`
- Call `cycleMode()` from `useSidebar()` hook
- Show chevron icon (left when expanded/icons, right when collapsed)
- Have tooltip explaining current action

This matches the existing sidebar collapse pattern and gives iPad users a persistent control outside the sidebar.

**Files**: `src/components/layout/header.tsx`, `src/lib/hooks/use-sidebar.ts`
**Links**: OI-075 (Phase 4 P4-1), [REQ_UI_Interactions.md](SPECS/REQ_UI_Interactions.md)

---

### OI-090 | Aircraft Phase Badges on Mobile Flight Board List

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-03-01 |

Add visual phase indicators for aircraft lifecycle on the mobile flight board list view. Show badges or status text for: **Scheduled**, **Arriving**, **On Ground**, **Departing**, **Complete**. Phases are derived from WP arrival/departure times and ground window status.

**Considerations**: (1) Derive phase from current time vs WP window; (2) Use color/icon coding (e.g., blue=Scheduled, orange=Arriving, red=On Ground, purple=Departing, green=Complete); (3) Update real-time as window progresses.

**Files**: `src/components/flight-board/flight-board-list-cards.tsx`, `src/lib/utils/flight-helpers.ts`, `src/types/index.ts`
**Links**: OI-077 (Phase 4 P4-3), [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md)

---

### OI-091 | Right-Click to Hide/Show Graph Components — SUPERSEDED

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Superseded** by OI-121 |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-03-01 |
| **Closed** | 2026-08-07 |

**Superseded**: this asked for right-click series toggling and noted the fallback — "add a small eye toggle button in the chart legend instead of right-click". OI-121 delivered exactly that fallback, and better: every legend entry toggles on a plain left click, across two axes (per-shift and per-role), via `use-chart-series-visibility.ts` and the shared `ChartLegend`. Applied to all three capacity charts behind the aggregation toggle and to the dashboard combined chart.

Not delivered: persistence via localStorage per page/lens. Visibility resets on navigation. Re-file if that is wanted — it is a small addition on top of the existing hook, not a reason to keep this item open.

**Links**: OI-121, D-065

Add right-click context menu on capacity graphs to toggle visibility of specific data series/components. E.g., right-click on Capacity Utilization chart → menu with checkboxes for lines: Baseline, Forecast, Scenario, etc. Selection persists via localStorage per page/lens.

**Implementation**: Recharts charts don't natively support right-click; need custom ECharts integration or tooltip-based toggle UI. Alternatively: add a small "eye" toggle button in chart legend instead of right-click.

**Files**: `src/components/capacity/*.tsx`, `src/lib/hooks/use-chart-visibility.ts` (new)
**Links**: [REQ_Dashboard_UI.md](SPECS/REQ_Dashboard_UI.md), [REQ_OtherPages.md](SPECS/REQ_OtherPages.md)

---

### OI-092 | Comments Per Flight Event — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Resolved** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-03-01 |
| **Resolved** | Shipped earlier; verified and closed 2026-08-07 |

**Shipped.** The item was left Open in this tracker after the work landed. Verified against the code at v1.0.0 prep: `flight_comments` table exists (schema.ts, plus M023), the API is live at `/api/work-packages/[id]/comments` (GET/POST/DELETE with threading via `parent_id`), comment counts are joined into both `/api/work-packages` and `/api/work-packages/all`, and the thread renders in the flight detail drawer.

**Known defect — RESOLVED in v1.0.0**: deletion removed only one level of replies (two flat `DELETE`s), orphaning anything nested deeper. Fixed by OI-099, which unified flight comments with `feedback_comments` and adopted its recursive subtree walk (`deleteMessageSubtree` in `src/lib/messages/repository.ts`). Done in a single pass, not the phased approach originally sketched. Recorded as an intended behaviour change in the CHANGELOG (D-067).

**Links**: OI-099, OI-094

Add a comments/notes system tied to individual work packages/flight events. Users can attach feedback, maintenance logs, or status updates. Comments are surfaced in:
- Flight detail drawer (expandable section)
- Admin event view
- Export/audit trail

**Schema**: New `flight_comments` table: `id`, `wp_id` (FK), `user_id` (FK), `comment_text`, `created_at`, `updated_at`.

**UI**: Comment input + thread display; integrate with analytics event logging (OI-019).

**Files**: `src/lib/db/schema.ts`, `src/app/api/admin/work-packages/[id]/comments/route.ts`, `src/components/flight-board/flight-detail-drawer.tsx`
**Links**: [REQ_Analytics.md](SPECS/REQ_Analytics.md)

---

### OI-093 | Unique Ground Event Markers (AOG, BTB, etc.)

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-03-01 |

Add special markers for notable ground events beyond standard on-ground status:
- **AOG** (Aircraft on Ground) — unscheduled maintenance
- **BTB** (Back to Blocks) — departure complete
- **Ferry** — positioning/non-revenue flight
- **Maintenance** — scheduled heavy maintenance

Markers visible on flight board Gantt (icon overlay) and mobile list (badge). Data source: WP `status` field or new `ground_event_type` column.

**Considerations**: Coordinate with OI-050 (AOG tracking). May require schema addition if not already captured in status field.

**Files**: `src/lib/db/schema.ts`, `src/components/flight-board/flight-board-chart.tsx`, `src/components/flight-board/flight-board-list-cards.tsx`
**Links**: OI-050, [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md)

---

### OI-094 | One-Time Notification System with Dismiss + Close Options — RESOLVED

| Field | Value |
|-------|-------|
| **Status** | **Resolved** — shipped; verified and closed 2026-08-07 |
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-03-01 |

Implement a notification system for one-time messages/alerts (e.g., system maintenance notices, feature announcements, deprecation warnings). Notifications display via toast/banner and provide two interaction options:
- **Close** — dismiss until next login (cleared on session end)
- **Dismiss** — don't show this notification again (persisted in DB, survives login)

**Schema**: New `notifications` table: `id`, `key` (unique slug), `title`, `body`, `type` (info/warning/error), `active` (bool), `created_at`.
New `user_notification_dismissals` table: `user_id`, `notification_key`, `dismissed_at`.

**UI**: Toast at top or banner in header; slides out and fades.

**Logic**: On page load, fetch active notifications; exclude those in user's dismissals table.

**Shipped, with two deviations from the spec above.** The item was left Open in this tracker after the work landed; verified against the code at v1.0.0 prep.

- `notifications` table exists (M024) — but as a **per-user fan-out**: one row per recipient, keyed `user_id`, with `read_at`, `expires_at`, `action_url`, `metadata`, `type` and `category`. The spec's global-row shape (`key` slug + `active`) was not built.
- **`user_notification_dismissals` was never created.** Dismissal is `notifications.read_at` on the recipient's own row. There is therefore no "close until next login" vs "dismiss forever" distinction — there is one read state. If the two-tier behaviour is still wanted, file it fresh.
- Delivered surface: `/api/notifications` (list), `/unread-count`, `/mark-all-read`, `/[id]/read`, `/api/admin/notifications` (create/broadcast), `src/lib/notifications/create.ts`, and a bell + dropdown + item UI in `src/components/layout/` rather than the specced toast.

**Note for OI-099**: that item's spec still names `user_notification_dismissals` as one of the tables to merge. It does not exist — corrected there.

**Files**: `src/lib/db/schema.ts`, `src/lib/db/schema-init.ts` (M024), `src/app/api/notifications/**`, `src/app/api/admin/notifications/route.ts`, `src/lib/notifications/create.ts`, `src/lib/hooks/use-notifications.ts`, `src/components/layout/notification-{bell,dropdown,item}.tsx`
**Links**: [REQ_Admin.md](SPECS/REQ_Admin.md), OI-092, OI-099

---

### OI-095 | App Version Update Walkthrough / Feature Tour

| Field | Value |
|-------|-------|
| **Type** | Feature |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-03-01 |

Add an interactive guided tour/walkthrough that launches when users log in after an app version update. Highlights new features, UI changes, and breaking changes introduced in the new revision. Tour is dismissible and can be re-triggered from Help/Account menu.

**Features**:
- **Version detection** — compare `app.version` (from build.json or config) against stored `last_viewed_version` in user preferences
- **Tour steps** — modular steps with highlights, tooltips, and navigation (Next/Skip/Done)
- **Multi-step walkthrough** — use Shepherd.js or custom Radix Dialog chain
- **Skip option** — users can dismiss and continue; "What's New" badge on Help menu until dismissed
- **Persistent state** — `last_viewed_version` stored in `user_preferences`, updated when tour completes

**UI Pattern**: Modal overlay with spotlight highlighting new/changed UI elements; step descriptions explain purpose and usage.

**Files**: `src/lib/db/schema.ts` (update user_preferences), `src/lib/hooks/use-version-tour.ts` (new), `src/components/shared/feature-tour.tsx` (new), `src/app/api/user/preferences/route.ts` (update to track version)
**Links**: [REQ_Account.md](SPECS/REQ_Account.md), [REQ_Versioning.md](SPECS/REQ_Versioning.md)

---

### OI-096 | Code Splitting & Component Extraction

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-03-16 |

Extract oversized components and page files into smaller, lazy-loadable modules to reduce bundle size and improve maintainability. Audit identified 2 critical (>1000 lines), 8 high-priority (600–1000 lines), and 25+ medium files.

**Phase 1 — Critical (highest impact):**
- `flight-board-chart.tsx` (2184 lines) → extract render utils, stripe overlay logic, tooltip formatter to separate `.ts` files
- `admin/settings/page.tsx` (1022 lines) → split into HostnameConfigPanel, InviteCodeManager, ShiftConfigEditor sub-components
- `shift-definitions-grid.tsx` (1133 lines) → extract column definitions to separate file

**Phase 2 — High priority:**
- `capacity-table.tsx` (869 lines) → extract column factory + cell renderers
- `capacity-summary-chart.tsx` (832 lines) → extract chart config builders
- `shift-drilldown-drawer.tsx` (787 lines) → extract panel components per shift view
- `server-tab.tsx` (759 lines) → extract status cards, metrics display
- `aircraft-type-editor.tsx` (744 lines) → extract editor modals, lazy-load mapping UI
- `flight-events-editor.tsx` (714 lines) → extract form sections, lazy-load modal content

**Phase 3 — Medium priority (lazy-load candidates):**
- `flight-detail-drawer.tsx` (554 lines) → lazy-load tab content panels
- `dashboard/combined-chart.tsx` (612 lines) → lazy-load if not above-fold
- `capacity-heatmap.tsx` (660 lines) → lazy-load canvas rendering
- `admin/data-import.tsx` (624 lines) → lazy-load multi-step wizard
- `import-hub.tsx` (599 lines) → lazy-load each wizard step

**Completed:**
- `flight-board/page.tsx` — view controls extracted to `flight-board-view-controls.tsx` (2026-03-16)

**Files**: See audit data above; all paths relative to `src/components/` or `src/app/`
**Links**: [DEV_STANDARDS.md](DEV/DEV_STANDARDS.md)

---

### OI-097 | iPad / Tablet UX Enhancements

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **In Progress** |
| **Priority** | P2 |
| **Owner** | Claude |
| **Created** | 2026-03-16 |

iPad-specific UX improvements for landscape and portrait modes.

**Completed:**
- Floating sidebar toggle (circle button on sidebar/content border, tablet only)
- Tap-to-toggle on sidebar empty space (tablet only)
- iPad portrait → flight board defaults to list view
- Print button hidden on tablet (not useful)
- `toggleSemiCollapse()` added to sidebar store (expanded ↔ icons)
- View controls extracted to `flight-board-view-controls.tsx`
- Two-finger pinch-to-zoom + pan on flight board Gantt (OI-098)

**Remaining / Future:**
- Filter bar overlap on tablet widths — date pickers need wrap or abbreviation
- Vertical space optimization — combine title + filter row on tablet
- iPad Quick Info Panel (long-press, OI-051)
- Touch gesture polish (OI-098)

**Files**: `sidebar.tsx`, `use-sidebar.ts`, `layout.tsx`, `flight-board/page.tsx`, `flight-board-view-controls.tsx`, `use-chart-gestures.ts`
**Links**: OI-084, OI-051, OI-098, D-053

---

### OI-098 | Flight Board Touch Gesture Polish

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-03-16 |

Two-finger pinch-to-zoom and pan implemented on flight board Gantt chart via custom pointer events (`use-chart-gestures.ts`). Working but has room for polish.

**Implemented (v1):**
- Pinch-to-zoom: finger distance ratio → dataZoom span scaling
- Two-finger pan: center point delta → horizontal dataZoom shift
- Dead zone (8px) to prevent jitter at gesture start
- RAF throttling (one dispatch per frame)
- `touch-action: pan-y` preserves single-finger vertical scroll
- Only `pointerType === "touch"` tracked — mouse interactions unaffected
- Code split into `use-chart-gestures.ts` (also extracted wheel zoom + drag pan)

**Future refinements:**
- Momentum/inertia after finger lift (coast to stop)
- Zoom anchor at pinch midpoint rather than dataZoom center
- Sensitivity tuning after real iPad testing (scale factor, pan multiplier)
- Double-tap to reset zoom (snap to "all" preset)
- Haptic feedback via `navigator.vibrate()` at zoom limits
- Consider extending touch gestures to header chart slider area
- Test with 3+ finger edge cases (currently capped at 2)

**Files**: `src/components/flight-board/use-chart-gestures.ts`
**Links**: OI-097 (iPad UX), [REQ_FlightBoard.md](SPECS/REQ_FlightBoard.md)

---

## Backlog

### OI-046 | Customer SP ID in Work Packages

| Field | Value |
|-------|-------|
| **Type** | Limitation / Stub |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-17 |

`work_packages.customer_sp_id` is a stub (D-033). WP JSON only provides `Customer` name — no SP ID. After master data import populates `customers.sp_id`, add post-import backfill:
```sql
UPDATE work_packages SET customer_sp_id = (SELECT sp_id FROM customers WHERE name = work_packages.customer) WHERE customer_sp_id IS NULL
```
**Links**: D-033

---

### OI-051 | iPad Quick Info Panel (Long Press / Tap)

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-18 |

On iPad, tapping a flight bar should show a fixed floating info card (not hover tooltip or full-screen drawer). Tap elsewhere to dismiss. Use Radix Popover anchored to the ECharts element.

**Files**: `flight-detail-drawer.tsx`, `flight-board-chart.tsx`

---

### OI-059 | Time/Date Indicator Needs Better Display Area

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-18 |

Active filter pills are the wrong area for date/timezone context. Consider: subtitle under page title (`Dashboard · Feb 18–21 · Eastern`), muted badge near date pickers, or breadcrumb-style context strip.

**Files**: `src/components/shared/top-menu-bar.tsx`

---

### OI-066 | Capacity Dev Overview — Temporary Debug Tool

| Field | Value |
|-------|-------|
| **Type** | Temporary |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-22 |

Admin-only debug page at `/admin/capacity/dev-overview` — shows capacity pipeline intermediate values (headcount, MH formulas, overlays, per-day WP attribution). Remove when capacity model is production-stable (~4–8 weeks).

**Removal**: Delete `dev-overview/` folder + remove hub card from `capacity/page.tsx`. Zero residual impact.

---

### OI-067 | Weekly MH Projections — TEMPORARY FIXTURE

| Field | Value |
|-------|-------|
| **Type** | Temporary |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-22 |

Customer MH target matrix (7 customers × 7 days × 3 shifts) as pink overlay on Forecast Pattern Chart. Self-contained `weekly_mh_projections` table (no FKs for easy removal). Remove when replaced by a proper forecasting pipeline.

**Removal checklist**: Delete 7 new files (`projection-engine.ts`, `projection-data.ts`, API routes, page, grid, test) → revert chart toggle + hub card + barrel changes → add `DROP TABLE weekly_mh_projections` migration. M018 stays (append-only).

---

### OI-085 | Shift Action Column Uses Hardcoded Boundaries

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P3 |
| **Created** | 2026-02-26 |

The Shift action column (highlight, sort, filter, control-break, group-by) uses hardcoded shift boundaries (Day 07–15, Swing 15–23, Night 23–07) in `shift-helpers.ts` and `flight-board-chart.tsx`. These should potentially be sourced from the actual shift matrix in the database (`staffing_shifts` table via `/api/admin/capacity/staffing-shifts`) so that if shifts are reconfigured in Admin > Capacity > Staffing, the flight board reflects the real schedule.

**Considerations**: Shift names, hours, and count may differ from the hardcoded 3. Would need an API call or server-side hydration to provide shift definitions to the client. The chart boundary lines (`SHIFT_BOUNDARIES`) and the action column helpers (`SHIFTS` in `shift-helpers.ts`) would both need to read from the same dynamic source.

**Files**: `src/lib/utils/shift-helpers.ts`, `src/components/flight-board/flight-board-chart.tsx`
**Links**: OI-080 (StaffingShift Rotation End Date — Resolved)

---

### OI-086 | work_packages.title Mapped to Wrong Field — RESOLVED (v1.0.0)

| Field | Value |
|-------|-------|
| **Type** | Data Model Issue |
| **Status** | **Resolved** — 2026-08-07 (v1.0.0, BREAKING) |
| **Priority** | P2 |
| **Created** | 2026-02-26 |

In v0.1.1 and earlier, the inbound work package data field `title` is mapped directly to the database `work_packages.title` column. This should have been mapped to `workpackage_no` instead, as the inbound `title` contains the work package number/identifier. The current `title` mapping may conflate display labels with actual work package identifiers.

**Confirmed against production data** (10,080 rows): `title` holds identifiers — `AALA/L-201125-2`, `782CK-DAILY-TS-11-20-2025`, `9V-DHA-TRANSIT-CHECK-11-2025` — with 8,015 distinct values. `workpackage_no` was **NULL on every single row**, because it was fed only from an inbound `WorkpackageNo` that no SharePoint export sends. The two columns were the same concept under two names, and the flight board already papered over it with `wp.workpackageNo ?? wp.title`.

**Resolution** (v1.0.0 MAJOR, D-028): the columns are collapsed into `workpackage_no`. No `title` column, no `WorkPackage.title` field. Import maps `WorkpackageNo ?? Title`; `Title` is now an alias on the `workpackageNo` import field. No migration was added — `runMigrations()` stays empty; the data move lives in `scripts/db/upgrade-to-v1.ts` Step 3 (copy into empty `workpackage_no`, then `DROP COLUMN title`; a rename is impossible because both columns have coexisted since v0.1.1).

Nothing was displaying the value as a human-readable label — the only two render sites were headed "WP" and "WP Number", i.e. already identifier semantics.

**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), D-028, CHANGELOG `[Unreleased]`

---

### OI-099 | Unified Messages Table — RESOLVED (v1.0.0, BREAKING)

| Field | Value |
|-------|-------|
| **Type** | Refactoring / Architecture |
| **Status** | **Resolved** — shipped 2026-08-08 |
| **Priority** | P2 |
| **Target Version** | v1.0.0 (BREAKING, D-028) |
| **Created** | 2026-03-17 |
| **Resolved** | 2026-08-08 |

Six tables folded into three: `messages`, `labels`, `message_labels`.

#### ⚠️ Corrections to the original spec

The spec as originally written was wrong in three ways. Recorded here so nobody
reintroduces them:

1. **`user_notification_dismissals` never existed.** The original spec named it as
   one of the tables to merge, and proposed a `message_dismissals` table to
   replace it. Notifications are a **per-recipient fan-out** — one row per
   recipient — and `read_at` on the recipient's own row **is** the dismissal
   state. There was never a separate dismissals table to merge, and no
   `message_dismissals` table was created. (Already flagged on OI-094.)
2. **The four `feedback_*` tables were omitted entirely.** The spec listed three
   tables (two of which were really one, per the above). The actual footprint was
   six: `flight_comments`, `notifications`, `feedback_posts`,
   `feedback_comments`, `feedback_labels`, `feedback_post_labels`.
3. **There is no voting on feedback posts.** The spec implied vote/reaction
   support and proposed a `message_reactions` table. No vote column, no vote
   table and no vote code has ever existed. Nothing was designed for it and no
   reactions table was created — adding one speculatively would have been schema
   surface with no consumer, which is what D-064 had just finished removing.

#### What shipped

| Legacy table | Rows at migration | Becomes |
|---|---|---|
| `flight_comments` | 0 | `messages`, `kind = 'flight_comment'` |
| `notifications` | 48 | `messages`, `kind = 'notification'` |
| `feedback_posts` | 3 | `messages`, `kind = 'feedback_post'` |
| `feedback_comments` | 0 | `messages`, `kind = 'feedback_comment'` |
| `feedback_labels` | 5 | `labels` |
| `feedback_post_labels` | 2 | `message_labels` |

58 rows total, no threading anywhere (`parent_id` NULL on every row of both
comment tables). Done in one pass rather than phased: at this volume, phasing
would have forced feedback comments through an external-subject shape and then
converted them to `root_id` later — an intermediate schema existing only to be
undone.

#### Decision: labels stay a SEPARATE table

Folding labels into `messages` as a `kind` was considered and **rejected**:

1. `feedback_labels.name` is `NOT NULL UNIQUE`. Inside `messages` — where every
   column is nullable because four shapes share it — that constraint degrades
   from a declaration into a convention enforced only by application code.
2. `feedback_post_labels` is a composite-PK join with no `id`, no author, no body
   and no timestamps. It cannot be a message row under any reading.
3. A label is a **dimension**, not an utterance. Every `messages` query would
   have had to carry `AND kind != 'label'` forever.

#### Decision: legacy tables RETAINED for one release

They are kept read-only rather than dropped, because they are the only rollback
for a bad remap. Non-readability is enforced three ways: removed from
`createTables()` (so fresh installs never have them), removed from `schema.ts` (so
any stale reference is a **compile error** — the main safety net), and a grep test
(`src/__tests__/db/no-legacy-message-refs.test.ts`) that catches raw SQL, which
`tsc` cannot see. `npm run db:status` lists them with a `(legacy — drop in
v1.1.0)` suffix. **Drop tracked as OI-123.**

#### The empty-boot window — why the backfill runs at startup

`createTables()` creates `messages` **empty** on a database whose six old tables
still hold every row. In that window the app is fully functional and shows **zero**
comments, **zero** notifications and **zero** feedback — no error, no exception, no
log line. An empty thread is indistinguishable from a successfully migrated one.

Had the backfill been a script, that would be the permanent state of any
installation whose operator forgot to run it. The same class of failure already
occurred in this release: after OI-086 renamed a column, the dev database was not
upgraded and the app displayed blank work-package identifiers.

So `backfillMessages()` is wired into `bootstrapDatabase()` immediately after
`runMigrations()`, and `assertMessagesReconciled()` **throws** on any count
mismatch. Crashing at boot is the only failure mode anyone will notice. A
consequence worth knowing: because the backfill is idempotent and runs every
start, a database that somehow loses its `messages` rows **re-migrates them** on
the next boot rather than silently showing empty (verified).

#### Notable implementation traps

- **ID collision across sources.** All four legacy tables used independent
  `AUTOINCREMENT` sequences, so legacy id 3 names four different rows. Confirmed
  live: feedback posts 4/5/6 became messages 49/50/51 while notifications
  occupied 1–48.
- **Ordering.** A feedback comment's `parent_id` points at `feedback_comments`
  while its `root_id` points at `feedback_posts`. A single generic self-join on
  matching `legacy_source` builds silently wrong trees that violate no
  constraint. Handled with explicit per-source remap statements, each guarded
  with `AND parent_id IS NULL` so pass 2 is independently re-runnable.
- **`notifications.metadata.commentId`** held a `flight_comments.id` and breaks
  under remapping. Rewritten, with the original preserved as `legacyCommentId` —
  which doubles as the guard against double-remapping on a re-run.
- **Partial per-kind indexes** are what keep the merge performance-neutral.
  `/api/notifications/unread-count` is polled on an interval by every logged-in
  client and resolves through
  `idx_messages_notif_unread ON messages(recipient_id, read_at) WHERE kind = 'notification'`.
  A partial index only applies when the query repeats its `WHERE` clause, so
  every repository query must carry its literal `kind` filter — correctness and
  performance therefore fail together rather than performance degrading quietly.
- **`author_id` must never cascade** (D-067). See DECISIONS.

#### Files

**Schema:** `src/lib/db/schema-init.ts` (canonical DDL; `runMigrations()` still
returns `[]`), `src/lib/db/schema.ts` (legacy exports deleted)
**Backfill:** `src/lib/db/backfill/messages-backfill.ts`, `src/lib/db/bootstrap.ts`
**Repository:** `src/lib/messages/repository.ts` — every `eq(messages.kind, …)`
filter lives here; routes are thin callers
**Routes:** `api/work-packages/[id]/comments` (rewritten to Drizzle),
`api/work-packages{,/all}` (duplicate comment-count subqueries folded into one
repository call), all four `api/notifications/*`, `api/admin/notifications`,
`lib/notifications/create.ts`, all six `api/feedback/*`
**Scripts:** `scripts/db/backfill-messages.ts` (new, `--dry-run` / `--strict`),
`scripts/db/upgrade-to-v1.ts` (Step 3), `scripts/db/status.ts`,
`scripts/db/export.ts` (⚠️ its table list omitted all six legacy tables, so
`npm run db:export` was **never** a backup of comments, notifications or feedback)
**Tests:** `src/__tests__/db/messages-backfill.test.ts` (25),
`src/__tests__/db/no-legacy-message-refs.test.ts` (5),
`src/__tests__/db/schema-consolidation.test.ts` (updated)

**UI is untouched.** `FlightComment` and `AppNotification` in `src/types/index.ts`
and everything in `src/types/feedback.ts` kept their shape; the repository maps at
the boundary so the DB shape never reaches the client.

**Links**: OI-092, OI-094, OI-123, D-067, [REQ_Logging_Audit.md](SPECS/REQ_Logging_Audit.md)

---

### OI-123 | Drop the six legacy messaging tables (v1.1.0)

| Field | Value |
|-------|-------|
| **Type** | Cleanup / Schema |
| **Status** | **Open** |
| **Priority** | P2 |
| **Target Version** | v1.1.0 |
| **Owner** | Unassigned |
| **Created** | 2026-08-08 |

OI-099 folded six tables into `messages` / `labels` / `message_labels` and
**retained** the originals read-only, because they are the only rollback for a bad
remap. This item drops them once v1.0.0 has been in production long enough to
trust the remap.

**Tables**: `flight_comments`, `notifications`, `feedback_posts`,
`feedback_comments`, `feedback_labels`, `feedback_post_labels`

**Preconditions before dropping**:
1. v1.0.0 has run in production for at least one release cycle with no reported
   loss of comments, notifications or feedback.
2. `npm run db:backfill-messages -- --dry-run` reports every source `balanced`
   with `inserted: 0` (i.e. everything already migrated).
3. A file-level backup exists — `npm run db:backup`, **not** `npm run db:export`,
   which enumerates a table subset.

**Work**:
- Add a drop step to a `db:upgrade-v1_1` script (idempotent; probe `sqlite_master`
  first). Do **not** put `DROP TABLE` in `createTables()` — that function is
  declarative and runs on every boot.
- Drop the stale indexes left behind with them, which `db:upgrade-v1` currently
  reports and deliberately does not remove: `idx_flight_comments_wp`,
  `idx_flight_comments_author`, `idx_notifications_user`,
  `idx_notifications_user_unread`, `idx_notifications_created`,
  `idx_feedback_posts_author`, `idx_feedback_posts_status`,
  `idx_feedback_posts_created`, `idx_feedback_comments_post`,
  `idx_feedback_post_labels_post`, `idx_feedback_post_labels_label`.
- Remove the legacy section from `scripts/db/status.ts` and `LEGACY_MESSAGE_TABLES`.
- Decide the fate of `messages.legacy_source` / `legacy_id` / `legacy_parent_id`.
  **Recommend keeping them**: they are the only remaining record of pre-v1.0.0
  ids, and `/feedback/[id]` bookmarks from v0.3.0 can still be resolved through
  `legacy_id`. They also remain the backfill's idempotency key.
- Once dropped, `backfillMessages()` returns `{ ran: false }` on every boot and
  `messages-backfill.test.ts` becomes the only place the old shape is described.
  Consider whether the module should then be deleted or kept for one more release.

**Files**: `scripts/db/`, `src/lib/db/backfill/messages-backfill.ts`,
`src/__tests__/db/no-legacy-message-refs.test.ts`
**Links**: OI-099, D-067

---

## Acknowledged / Informational

| OI | Title | Notes |
|----|-------|-------|
| OI-006 | CargoJet HAR — No Auth Tokens | Session-based auth not captured. No action for v0; revisit if live API integration is attempted. |
| OI-007 | Pagination Not in HAR | No pagination in 86-record dataset. Revisit if data exceeds 500 records. |

---

### OI-088 | Theme Toggle Race Condition (Production) — RESOLVED

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Resolved** |
| **Priority** | P1 |
| **Owner** | Claude |
| **Created** | 2026-03-01 |
| **Resolved** | 2026-03-01 |

Theme switching was twitchy in Docker production (class toggled but `color-scheme` briefly reverted); sometimes the switch wouldn't stick. Root cause: three-part race condition only visible under production API latency (~200ms) vs. dev (~5ms).

**Root cause**: `fetchPrefs()` (initial DB load) resolved AFTER a concurrent user `update()` call. The stale GET response blindly overwrote `colorMode` in Zustand → `PreferencesLoader` re-called `setTheme(oldValue)` → theme reverted. In dev this race window was too narrow to observe.

**Fix (3 changes)**:
1. `use-preferences.ts` `fetch()` — bail out if `get().loaded` is already true (user has taken control) instead of overwriting state with stale response.
2. `use-preferences.ts` `update()` — set `loaded: true` immediately alongside the optimistic state so the bail-out condition in (1) is reachable.
3. `preferences-loader.tsx` — guard the `setTheme` effect with a `useRef` flag so it fires only once on initial DB load, not on every subsequent `colorMode` change (which eliminated the double-`setTheme` call).

**Files**: `src/lib/hooks/use-preferences.ts`, `src/components/layout/preferences-loader.tsx`

---

### OI-089 | update() Revert Does Not Call setTheme

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P3 |
| **Owner** | Unassigned |
| **Created** | 2026-03-01 |

When `update()` fails (PUT returns non-OK or network error), the revert block restores `colorMode` in Zustand but does NOT call `setTheme()`. Since `header.tsx` and `PreferencesForm` already called `setTheme(newValue)` before the API response, the theme stays visually applied even though Zustand has reverted. On the next user interaction the cycle is off by one step.

**Fix**: Add `setTheme(prev.colorMode)` at the start of both revert blocks in `update()` (the `!res.ok` branch and the `catch` branch).

**Files**: `src/lib/hooks/use-preferences.ts`

---

## Summary

| Priority | Open | Partial | In Progress | Acknowledged | Resolved |
|----------|------|---------|-------------|-------------|----------|
| P0 | 0 | 0 | 0 | 0 | 16 |
| P1 | 1 | 2 | 0 | 0 | 29 |
| P2 | 21 | 3 | 1 | 0 | 26 |
| P3 | 9 | 0 | 0 | 2 | 5 |
| **Total** | **31** | **5** | **1** | **2** | **76** |

**Latest update (2026-08-07, staffing session)**: Resolved four P1 defects found while evaluating shift tracking against a production data copy — **OI-107** (edit dialog rewrote history instead of versioning), **OI-108** (overlapping shift versions double-counted headcount; found live in prod data), **OI-109** (weekly matrix headcount silently discounted by `paidToAvailable`), **OI-110** (paid/available/productive MH chain collapsed, understating Paid MH ~11%). Also **OI-112** (matrix clipped Saturday + Tot columns at every screen size). New open items: **OI-111** (`staffing_shifts` has no `group_id` lineage) and **OI-113** (admin capacity pages unusable at phone width). Suite 705 → 714; `npm run validate` exits 0. Added **OI-114** (responsive panel priority), **OI-115** (removed the dead legacy capacity engine and its misleading Admin → Settings fields) and **OI-116** (productivity-chain explainer + click-to-edit percentages).

**Previous update (2026-08-07, later)**: Added **OI-106** (README screenshots for GitHub).

**Earlier update (2026-08-07)**: Resolved **OI-100** (P1 — engine now honours shift effective dates), **OI-101** (rotation pattern versioning, M026) and **OI-102** (anchor/effective-date split, M025). OI-103 partially addressed — 32 engine tests added, but the two archive-and-create transactions still need a DB harness. **The P1 blocker on the v0.3.0 production upgrade is cleared.**

**Previous update (2026-08-06)**: Added OI-100 → OI-103 (staffing shift versioning gaps) and OI-104/OI-105 (MH override management, cron scheduler admin — both specced inline in their own entries — the root `roadmap.md` they referenced is gone).

**Previous update (2026-03-17)**: Added OI-099 (unified comments/notifications/feedback table for v1.0.x — refactoring for schema simplification and richer interactions). Backlog item targeting post-v0.3.0 release.

---

## Archived — Resolved Items

> Compressed summaries. Full context was preserved in git history (pre-2026-02-26 OPEN_ITEMS.md).

### Foundation Decisions (OI-001–OI-021)

| OI | Title | Resolution | Decision | Date |
|----|-------|------------|----------|------|
| OI-001 | SVAR Gantt Package Name | Replaced entirely by Apache ECharts | D-008 | 2026-02-13 |
| OI-002 | SVAR Gantt MIT Limitations | ECharts provides all features natively; SVAR had Next.js 15 scroll freeze | D-008 | 2026-02-13 |
| OI-003 | Aircraft Type Normalization | Wildcard patterns in seed data; all 57 aircraft resolve correctly | D-015 | 2026-02-14 |
| OI-004 | Data Import Mechanism | File upload + paste-JSON (D-016); `/api/ingest` POST with Bearer auth (D-026) | D-016, D-026 | 2026-02-13 |
| OI-005 | Additional Timezone Options | UTC + America/New_York only in UI; all IANA supported internally | D-014 | 2026-02-13 |
| OI-008 | Manual MH Override Storage | SQLite `mh_overrides` table keyed by WP ID (D-013); survives re-imports | D-013 | 2026-02-13 |
| OI-009 | Shift Schedule Customization | MVP: headcount only; shift time editing deferred to vNext | — | 2026-02-13 |
| OI-010 | Flight Board Row Grouping | One row per registration (D-012) | D-012 | 2026-02-13 |
| OI-011 | Auth.js v5 Beta Stability | Proceed with pinned v5; tested in M1.5 | — | 2026-02-13 |
| OI-012 | Drizzle + better-sqlite3 Compat | `serverComponentsExternalPackages: ['better-sqlite3']` in next.config | — | 2026-02-13 |
| OI-013 | vNext Feature Stubs Scope | Passkeys/2FA/Sessions as "Coming Soon" cards on Account > Security | — | 2026-02-13 |
| OI-014 | Analytics Event Retention | 365-day retention | — | 2026-02-13 |
| OI-015 | Operator Performance Priority | Ships with M3; click-to-focus cross-filtering | — | 2026-02-13 |
| OI-016 | Materialized KPI Views | On-the-fly at current scale; revisit at 500+ records / >200ms | — | 2026-02-13 |
| OI-017 | Event Tracking Batching | Immediate writes (one POST per event) | — | 2026-02-13 |
| OI-018 | Change Password v1 vs Stub | Change Password stays v1 functional | D-021 | 2026-02-13 |
| OI-019 | Operator KPIs Limited by Data | Available-data KPIs only; aspirational marked [Future] in REQ_Analytics.md | — | 2026-02-13 |
| OI-020 | Dashboard Gantt Duplication | No duplication — Gantt on `/flight-board` only | D-023 | 2026-02-13 |
| OI-021 | Theme CSS Size (11 Presets × 2) | All 22 sets enabled; <5KB CSS | D-022 | 2026-02-13 |

### Milestones (OI-022–OI-030)

| OI | Title | Summary | Date |
|----|-------|---------|------|
| OI-022 | M1 Complete | Data layer, reader, transformer, 6 API routes | 2026-02-13 |
| OI-023 | M2 Complete | FilterBar, Zustand stores, Flight Board Gantt | 2026-02-13 |
| OI-024 | M3 Complete | Statistics Dashboard, KPI cards, Operator Performance | 2026-02-13 |
| OI-025 | M4 Complete | Capacity Modeling page, utilization chart, detail table, CSV export | 2026-02-14 |
| OI-026 | M5 Complete | Account page, Settings, 11 Fumadocs theme presets | 2026-02-14 |
| OI-027 | M6 Complete | Admin Core: Customer color editor, User CRUD, Admin settings | 2026-02-14 |
| OI-028 | M7 Complete | Aircraft Type editor, Data Import with validate→preview→confirm | 2026-02-14 |
| OI-029 | M8 Complete | Admin Analytics dashboard, mobile nav, mobile FilterBar sheet | 2026-02-14 |
| OI-030 | Project Steward Skill | `PROJECT_STEWARD.md`, `AUTO_COMMIT_POLICY.md`, `phase_commit.sh` | 2026-02-14 |

### Post-MVP Fixes & Features

| OI | Title | Resolution | Date |
|----|-------|------------|------|
| OI-031 | Dashboard Chart Time Responsiveness | `timezone` prop, day separator ReferenceLine, midnight date labels | 2026-02-14 |
| OI-032 | Flight Board Time Filtering / xAxis Error | Overlap detection for date range filter; xAxis init safety checks | 2026-02-15 |
| OI-033 | Flight Board Time Axis Alignment | Filter-based midnights; clean interval ticks (00:00, 06:00…) | 2026-02-15 |
| OI-034 | HTTP Ingest Endpoint | `/api/ingest` POST, Bearer auth, rate limiting, idempotency (D-026) | 2026-02-15 |
| OI-035 | Event Data Reset Tool | `npm run db:event-reset`, admin API + UI with timestamped backup | 2026-02-15 |
| OI-036 | Master Data Import System | 5 tables, 12 API endpoints, fuzzy matching (70%), admin UI | 2026-02-15 |
| OI-037 | Configurable Allowed Hostnames | `trustHost`, hostname registry in app_config, admin UI (D-027) | 2026-02-16 |
| OI-039 | Master Data Imports Not in History | Unified import history with `data_type` column + type filter (v0.2.0) | 2026-02-19 |
| OI-041* | Collapsible Sidebar v1 | **Superseded by OI-075** (Phase 4 P4-1) | — |
| OI-045 | Canceled WP Visual Treatment | `flights.hideCanceled` system pref; admin toggle writes to server.config.yml (D-034) | 2026-02-18 |
| OI-052* | Flight Board Gantt vs List | **Superseded by OI-077** (Phase 4 P4-3) | — |
| OI-054* | Collapsible Sidebar v2 | **Superseded by OI-075** (Phase 4 P4-1) | — |
| OI-057b | System Pref Filters Shown as Active | Removed default date chip; tz chip compares against system default | 2026-02-18 |
| OI-058 | Bootstrap + Self-Registration + Invite Codes | `instrumentation.ts` bootstrap, `/register`, `invite_codes` table (D-035) | 2026-02-18 |
| OI-060 | baseUrl / AUTH_URL Normalization | `BASE_URL` env + `app.baseUrl` YAML; `AUTH_URL` internal only (D-037) | 2026-02-19 |
| OI-061 | System User (system@internal) Read-Only | Filter SYSTEM_AUTH_ID from users API; 403 on edit/delete routes | 2026-02-19 |
| OI-062 | Superuser Self-Service Account | Profile form editable; JWT refreshes displayName/email from DB | 2026-02-19 |
| OI-063 | User Data Not Populated in Admin Edit | `useEffect` sync in `user-form.tsx` on `open` + `initialData` change | 2026-02-19 |
| OI-064 | Universal Import Hub Post-Bugs | 17 fixes: 6 showstoppers, 2 regressions, 8 code review, 1 validation gap | 2026-02-20 |
| OI-065 | Contract MH Pipeline (Phase 3) | 4-level chain, `"contract"` MHSource, `loadContractMap()` cache, priority field (M019, D-052) | 2026-02-25 |
| OI-068 | Capacity Enhancements E-01–E-04 | Rolling forecast, scenario toggle (+10%), gap analysis, UI integration (D-050); 36 tests | 2026-02-24 |
| OI-069 | Capacity Enhancements E-05–E-06 | `ComputeModeBadge`; today reference line + future `ReferenceArea` shading | 2026-02-24 |
| OI-070 | G-01: Decouple Aggregation | `AggregationToggle`; any lens × any aggregation mode | 2026-02-24 |
| OI-071 | G-07: Cross-Lens Comparison | `CompareSelector` + secondary overlays + KPI delta card + CSV column | 2026-02-25 |
| OI-072 | G-09: Monthly Roll-Up Aggregation | `monthly-rollup-engine.ts`, `MonthlyRollupChart` (4 view modes), 16 tests | 2026-02-25 |
| OI-073 | G-10: Per-Customer Event Attribution | `event-attribution-engine.ts`, top-3 customer KPI strip, 17 tests | 2026-02-24 |
| OI-082 | Staffing-Derived Shift Routing | Replaced static `operatingDays` with `deriveNonOperatingFromStaffing()` — staffing map drives shift existence. M021 drops column. 17 new tests. | 2026-02-26 |
| OI-087 | Sub-Build Tracking Implementation | Implemented Approach B (tracked build.json + pre-commit hook). Build number auto-increments on every commit. Surfaces in health check, admin Server page, and git tags. D-063. | 2026-03-01 |

### Phase 4 — Mobile-First UX (2026-02-26)

| OI | Title | Resolution | Date |
|----|-------|------------|------|
| OI-053 | PWA Manifest (P4-4) | `site.webmanifest`, 5 icon sizes (192/512 + maskable + apple-touch), `viewport-fit: cover`, theme-color media queries, iOS meta tags | 2026-02-26 |
| OI-075 | Collapsible Sidebar + Bottom Tab Bar (P4-1) | 4-tier nav (D-053): bottom tab `< sm`, hamburger `sm–md`, collapsible sidebar `md–lg`, expanded `lg+`. Zustand + localStorage. `use-sidebar.ts`, `bottom-tab-bar.tsx`, `sidebar-hydrator.tsx` | 2026-02-26 |
| OI-076 | Mobile Touch Targets (P4-2) | Theme toggle `h-11 w-11 md:h-9 md:w-9`, user menu `h-11 md:h-9`. Hamburger `hidden sm:block md:hidden` | 2026-02-26 |
| OI-077 | Flight Board List View (P4-3) | Gantt/List toggle, `flight-board-list-cards.tsx` (mobile), `flight-board-list-table.tsx` (TanStack, desktop). localStorage persistence. D-054, D-056 | 2026-02-26 |
| OI-078 | Mobile Polish Pass (P4-5) | `overflow-x-auto` on 5 admin grids + 1 user table. Pie charts responsive `grid-cols-1 md:grid-cols-3`. Heatmap legend `hidden md:flex`. `h-dvh` layout | 2026-02-26 |

*\* Superseded — planned work reorganized into Phase 4 items.*
