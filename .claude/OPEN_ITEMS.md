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

The ambiguous `headcount` field is **retained as a deprecated alias** equal to `effectiveHeadcount`, so the `/api/admin/capacity/staffing-matrix` response stays backwards-compatible per D-028. Remove on the next MAJOR.

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

### OI-111 | staffing_shifts Has No Version Lineage (group_id)

| Field | Value |
|-------|-------|
| **Type** | Design Gap |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-08-07 |

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

### OI-119 | Timezone Selector Does Nothing on /capacity

| Field | Value |
|-------|-------|
| **Type** | Bug |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-08-07 |

`/api/capacity/overview` builds its day grid from UTC dates (`generateDateRange`) and shift bucketing reads each shift's own stored timezone (D-049). The UI TZ selector therefore only re-interprets the start/end timestamps — every day boundary, heatmap row and rollup stays UTC. A user switching to Eastern sees no change and has no way to know the numbers are not on their clock.

Changing it touches the demand engine, the heatmap, the monthly/weekly rollups and every stored shift boundary, so it is its own session. Until then the selector is misleading on this page.

**Links**: OI-117, D-049

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

### OI-106 | README Screenshots for GitHub

| Field | Value |
|-------|-------|
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

### OI-104 | Work-Package Man-Hour Override Management

| Field | Value |
|-------|-------|
| **Type** | Feature Request |
| **Status** | **Open** — specced, not started |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-08-04 (filed 2026-08-06) |

Admin-facing workflow for managing per-work-package MH overrides without direct DB access. Editable man-hours in the WP detail drawer showing imported MH / effective MH / MH source together; explicit **Save Override** and **Clear Override** actions; no override created when the entered value equals imported `work_packages.total_mh` (clear the redundant one instead); bulk CSV workflow with a preview of matches, duplicates, invalid values, unchanged values and unmatched WP identifiers before commit; optional minimum-hours transformation retaining the original supplied value in the audit output; authenticated CRUD endpoints for `mh_overrides`; admin-role gated with user + timestamp recorded; cache invalidation so flight board and capacity refresh without a server restart; override history/audit view with before/after values and export.

**Acceptance criteria**: saved override becomes `effectiveMH` and is labelled **Override** app-wide; clearing restores the priority chain (imported WP MH → contract MH → default MH); capacity planned-demand reflects changes on the next request; bulk updates are transactional with a downloadable error/audit report; tests cover permissions, create/update/clear, redundant-value handling, cache invalidation, and capacity propagation.

The full spec is the body of this item. (An earlier note pointed at an untracked root `roadmap.md`; that file no longer exists — the surviving spec is here.)

**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md), OI-086

---

### OI-105 | Cron Scheduler Administration and Disabled-State UX

| Field | Value |
|-------|-------|
| **Type** | Feature Request |
| **Status** | **Open** — specced, not started |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-08-04 (filed 2026-08-06) |

Make the scheduler's global state explicit and stop the Cron Jobs UI presenting controls that cannot take effect. `features.cronEnabled` stays the deployment-level hard gate (never writable from the web app); add a **DB-backed "Scheduler Active" runtime switch** available only when the deployment gate is on.

When the server gate is **off**: prominent "Cron scheduler disabled by server configuration" banner; jobs, schedules, options and run history shown read-only; enable/disable, schedule editing, option editing and **Run Now** all locked; explain that an authorised server admin must enable `features.cronEnabled` and restart. Clearly distinguish *disabled by server configuration* from *paused by an administrator*.

When the gate is **on**: admins can switch between **Running** and **Paused**; per-job enable/disable preserved beneath the global switch; show each job's next run, last run, last result and message; show last successful DB backup, configured retention, and warn when no successful backup exists within the expected interval; record global pause/resume with acting user and timestamp.

**Acceptance criteria**: no editable/executable cron controls appear active while the server gate is disabled; GUI pause stops execution without a restart and without changing server config; resume registers enabled jobs without duplicate schedules; **Run Now** respects the gate and role permissions; scheduler state and backup freshness are visible without inspecting container logs or the filesystem; tests cover all gate × runtime-state × role × restart × duplicate-registration combinations.

The full spec is the body of this item. (An earlier note pointed at an untracked root `roadmap.md`; that file no longer exists — the surviving spec is here.)

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

### OI-084 | iPad Sidebar Collapse — No Way to Expand

| Field | Value |
|-------|-------|
| **Type** | Enhancement |
| **Status** | **Open** |
| **Priority** | P2 |
| **Owner** | Unassigned |
| **Created** | 2026-02-26 |

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

**Known defect carried forward**: deletion removes only one level of replies (two flat `DELETE`s), so replies nested deeper are orphaned. Fixed as part of OI-099 Phase A, which unifies this with `feedback_comments` and adopts its recursive `deleteCommentTree`.

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

### OI-086 | work_packages.title Mapped to Wrong Field

| Field | Value |
|-------|-------|
| **Type** | Data Model Issue |
| **Status** | **Open** |
| **Priority** | P2 |
| **Created** | 2026-02-26 |

In v0.1.1 and earlier, the inbound work package data field `title` is mapped directly to the database `work_packages.title` column. This should have been mapped to `workpackage_no` instead, as the inbound `title` contains the work package number/identifier. The current `title` mapping may conflate display labels with actual work package identifiers.

**Impact**: Breaking change for v0.3.0+. Will require:
1. Schema migration to rename or reinterpret the column
2. Data backfill to preserve existing values
3. Import logic update to map inbound `title` → `workpackage_no`
4. UI/API audit to ensure no code depends on `work_packages.title` for display

**Links**: [REQ_DataModel.md](SPECS/REQ_DataModel.md)

---

### OI-099 | Unified Comments/Notifications/Feedback Table (v1.0.x)

| Field | Value |
|-------|-------|
| **Type** | Refactoring / Architecture |
| **Status** | **Open** |
| **Priority** | P2 |
| **Target Version** | v1.0.x |
| **Created** | 2026-03-17 |

Combine three separate tracking systems (`flight_comments`, `notifications`, `user_notification_dismissals`) into a single unified **messages** table. This reduces schema complexity and enables richer interactions (e.g., a notification can have replies/comments, comments can have reactions, feedback can be shared).

**Current separate tables** (v0.3.0+):
- `flight_comments` — per-WP comments, user feedback, maintenance logs (OI-092)
- `notifications` — system-wide announcements, deprecation warnings (OI-094)
- `user_notification_dismissals` — per-user dismissal state for notifications

**Proposed unified schema (v1.0.x)**:
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'comment', 'notification', 'feedback', 'audit-note'
  scope TEXT,  -- 'global', 'user', 'wp:{id}', 'customer:{id}'
  title TEXT,
  body TEXT NOT NULL,
  author_id TEXT,  -- FK to users (NULL for system messages)
  created_at TEXT NOT NULL,
  updated_at TEXT,
  metadata JSONB,  -- flexible fields per type (priority, severity, category, etc.)
  active BOOLEAN DEFAULT true,
  parent_id TEXT REFERENCES messages(id)  -- for threaded replies
);

CREATE TABLE message_reactions (
  message_id TEXT FK,
  user_id TEXT FK,
  reaction TEXT,  -- emoji or label ('helpful', 'dismiss', 'acknowledge', etc.)
  created_at TEXT
);

CREATE TABLE message_dismissals (
  message_id TEXT FK,
  user_id TEXT FK,
  dismissed_at TEXT,
  UNIQUE(message_id, user_id)
);
```

**Benefits**:
1. Reduces schema surface area (1 table instead of 3+)
2. Enables comments on notifications (e.g., "I saw this announcement, here's feedback")
3. Unified search/audit trail (all messages in one place)
4. Flexible metadata per message type
5. Threaded conversations (parent_id for replies)

**Migration path**: (1) Create new unified schema in parallel; (2) backfill data with type/scope tags; (3) deprecate old tables (keep as views for backwards compat); (4) remove views in v1.1.x

**Related OIs**: OI-092 (Comments), OI-094 (Notifications), [REQ_Logging_Audit.md](SPECS/REQ_Logging_Audit.md)

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
