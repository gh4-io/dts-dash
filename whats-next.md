# Handoff Document — Demand Contracts Redesign (Contract Groups + Line Items + Sanity Check)

**Created:** 2026-02-21
**Branch:** `feat/demand-contracts` (off `feat/capacity-mvp`)
**Repo:** `gh4-io/dts-dash`
**Status:** All code implementation COMPLETE. Docs + commit remaining.

---

<original_task>

Implement the "Demand Allocations Redesign — Contract Groups + Line Items + Sanity Check" plan. This replaces the flat `demand_allocations` table with a parent/child `demand_contracts` + `demand_allocation_lines` model, adds sanity-check projection logic (SHORTFALL/OK/EXCESS), and rebuilds the admin UI with collapsible contract rows and inline line editing. 22 files across 10 implementation steps.

</original_task>

---

<work_completed>

## All 22 Planned Files + 2 Additional Files — COMPLETE

### Step 1: Types + Schema + Migration (files 1-3)

**`src/types/index.ts`:**
- Removed `DemandAllocation` interface
- Kept `AllocationMode` type
- Added new types: `ContractPeriodType`, `ProjectionStatus`, `MatchedAllocation`, `DemandAllocationLine`, `DemandContract`
- Updated `CapacityOverviewResponse`: `allocations?: DemandAllocation[]` → `contracts?: DemandContract[]`

**`src/lib/db/schema.ts`:**
- Removed `demandAllocations` table + `demandAllocationsRelations`
- Added `demandContracts` table (customer FK, name, mode, effective dates, contracted_mh, period_type, reason, is_active)
- Added `demandAllocationLines` table (contract FK CASCADE, shift FK, day_of_week, allocated_mh, label)
- Updated relations: `customersRelations`, `capacityShiftsRelations`, added new table relations

**`src/lib/db/schema-init.ts`:**
- Added M015 migration: DROP old `demand_allocations`, CREATE `demand_contracts` + `demand_allocation_lines` with indexes

### Step 2: Engine + Data Layer (files 4-6)

**`src/lib/capacity/allocation-engine.ts`** — Full rewrite:
- `computeContractProjection(contract, lines)` — scales weekly MH by period type (WEEKLY×1, MONTHLY×4.348, ANNUAL×52.143, TOTAL×weeks)
- `getProjectionStatus(projected, contracted)` — SHORTFALL / OK / EXCESS (>20% over)
- `findMatchingAllocations(date, shiftCode, customerId, contracts, shifts)` → `MatchedAllocation[]`
- `computeAllocatedMH(normalMH, matchingAllocations)` — ADDITIVE + MINIMUM_FLOOR logic
- `applyAllocations(demand, contracts, shifts, customerMap)` — sets `allocatedDemandMH` on shifts
- `validateContract(data)` — validates contract+lines payload

**`src/lib/capacity/allocation-data.ts`** — Full rewrite:
- Transactional CRUD: `loadDemandContracts()`, `loadDemandContract()`, `createDemandContract()`, `updateDemandContract()`, `deleteDemandContract()`, `loadCustomerNameMap()`
- Projection computed server-side in load functions

**`src/lib/capacity/index.ts`** — Updated barrel exports

### Step 3: Tests (file 20)

**`src/__tests__/capacity/allocation-engine.test.ts`** — Full rewrite: 60 tests covering all new engine functions

### Step 4: API Routes (files 7-10)

**`src/app/api/admin/capacity/demand-contracts/route.ts`** — NEW (GET list, POST create)
**`src/app/api/admin/capacity/demand-contracts/[id]/route.ts`** — NEW (GET, PUT with lines replace, DELETE cascades)
**Deleted:** `src/app/api/admin/capacity/demand-allocations/route.ts` and `[id]/route.ts`

### Step 5: Downstream Consumers (files 11-14)

**`src/app/api/capacity/overview/route.ts`** — `loadDemandAllocations` → `loadDemandContracts`, response key `allocations` → `contracts`
**`src/app/api/admin/capacity/forecast-models/[id]/generate/route.ts`** — Same import changes
**`src/lib/capacity/lens-config.ts`** — `data.allocations` → `data.contracts`
**`src/lib/hooks/use-capacity-v2.ts`** — Store field `allocations` → `contracts`, hydration from `json.contracts`

### Step 6: Admin UI (files 15-18)

**`src/app/(authenticated)/admin/capacity/allocations/page.tsx`** — Refactored for `DemandContract[]`, fetch from new endpoint
**`src/components/admin/capacity/allocation-grid.tsx`** — Full rewrite: collapsible rows (expandedIds Set), projection flags (StatusBadge), inline lines sub-table
**`src/components/admin/capacity/allocation-editor.tsx`** — Full rewrite: contract fields + inline lines editor + live projection indicator. Uses direct import from `@/lib/capacity/allocation-engine` (D-047 barrel trap)
**`src/app/(authenticated)/admin/capacity/page.tsx`** — Hub card: "Demand Allocations" → "Demand Contracts"

### Step 7: Capacity UI + Test Fixups (files 19, 21-22)

**`src/components/capacity/shift-drilldown-drawer.tsx`** — `DemandAllocation` → `DemandContract`, `allocations` prop → `contracts`
**`src/app/(authenticated)/capacity/page.tsx`** — Prop passthrough: `allocations` → `contracts` (additional file not in original plan)
**`src/__tests__/capacity/lens-config.test.ts`** — `allocations` → `contracts` in test data (additional file not in original plan)
**`src/__tests__/capacity/billing-engine.test.ts`** and **`time-bookings-engine.test.ts`** — Verified clean, no changes needed

### Step 8: Verification Gates — ALL PASS

- `npx vitest run` — **437 tests passing** (was 412, +25 net: 60 new allocation tests - 35 old)
- `npm run build` — **clean** (no type errors)
- `npm run lint` — **0 errors**

</work_completed>

---

<work_remaining>

## 1. Documentation Updates (8 docs-wiki files)

All files in `docs-wiki/capacity/` need `allocations` → `contracts` updates:

| File | What to Update |
|------|---------------|
| `docs-wiki/capacity/api-reference.mdx` | Rewrite "Demand Allocations" section → "Demand Contracts". Update endpoint URLs (`/demand-allocations` → `/demand-contracts`). Update request/response examples with new contract+lines schema. Add projection fields to response examples. |
| `docs-wiki/capacity/admin-guide.mdx` | Rewrite allocation section for contracts+lines model. Describe collapsible rows, inline line editing, projection flags (SHORTFALL/OK/EXCESS). |
| `docs-wiki/capacity/lenses.mdx` | Update "Allocated" lens references from "allocation" terminology to "contract" terminology. |
| `docs-wiki/capacity/examples.mdx` | Update example walkthrough — old flat allocation examples → contract+lines examples. |
| `docs-wiki/capacity/concepts.mdx` | Update glossary terms and lens table. Replace "Demand Allocation" with "Demand Contract" + "Allocation Line". |
| `docs-wiki/capacity/faq.mdx` | Update admin references from allocations to contracts. |
| `docs-wiki/capacity/index.mdx` | Update admin config description. |
| `docs-wiki/capacity/getting-started.mdx` | Update link text/anchor for allocations → contracts. |

Additionally:
| File | What to Update |
|------|---------------|
| `docs-wiki/api/endpoints.mdx` | Update endpoint URLs in the capacity section. |
| `docs-wiki/architecture/modules.mdx` | Update module descriptions if allocations are referenced. |

## 2. Project Doc Updates

| File | What to Update |
|------|---------------|
| `.claude/DECISIONS.md` | Add D-048: "Demand Contracts redesign — parent/child model replaces flat allocations" |
| `.claude/ROADMAP.md` | Update P2-6 section to note the redesign. Mark demand contracts work complete. |
| `.claude/OPEN_ITEMS.md` | Add/close any relevant items. |
| `memory/MEMORY.md` | Update migration counter to M015, test count to 437, note demand contracts redesign. |

## 3. Commit

All changes need to be committed. Suggested message:
```
feat(capacity): redesign demand allocations as contract groups with line items

- Replace flat demand_allocations with parent/child demand_contracts + demand_allocation_lines
- Add sanity check projection (SHORTFALL/OK/EXCESS) with period scaling
- Collapsible admin grid with inline line editing + live projection indicator
- M015 migration, 60 engine tests, transactional CRUD
```

## 4. Manual Verification (Optional)

- Admin hub card visible at `/admin/capacity` with "Demand Contracts" title
- Admin CRUD page: create contract with lines, expand/collapse, edit, delete
- Projection flags display correctly (amber SHORTFALL, green OK, blue EXCESS)
- `/capacity` page Allocated lens renders correctly
- Empty state displays correctly
- Forecast model generation still works

</work_remaining>

---

<attempted_approaches>

## Errors Encountered and Fixed During Implementation

1. **`applyAllocations` test failure — "sets allocatedDemandMH when floor exceeds normal"**
   - Error: `expected 30 to be 10` — line had `shiftId: null` which matched ALL 3 shifts (DAY, SWING, NIGHT), each getting 10 MH
   - Fix: Changed `makeLine({ allocatedMh: 10 })` to `makeLine({ shiftId: 1, allocatedMh: 10 })` to scope to DAY shift only
   - Same fix applied to 4 other `applyAllocations` tests with identical issue

2. **`lens-config.test.ts` failures — 2 tests**
   - Error: Tests used `allocations: [...]` property which no longer exists on `CapacityOverviewResponse` (renamed to `contracts`)
   - Fix: Global replace `allocations` → `contracts` in test data

3. **Capacity page prop passthrough** (not in original plan)
   - `src/app/(authenticated)/capacity/page.tsx` passed `allocations` to `ShiftDrilldownDrawer`
   - Fix: Changed to `contracts` prop name

## Approaches That Worked Well

- **Parallel exploration**: Used multiple explore agents simultaneously to read all 22 files before starting implementation
- **Bottom-up implementation**: Types → Schema → Engine → Tests → API → UI order prevented cascading type errors
- **Transactional CRUD**: Contract + lines created/updated atomically via Drizzle transactions
- **Direct imports for client components**: Used `@/lib/capacity/allocation-engine` instead of barrel `@/lib/capacity` (D-047 barrel trap)

</attempted_approaches>

---

<critical_context>

## Key Architecture Decisions

1. **M015 drops `demand_allocations` cleanly** — This is safe because we're on `feat/capacity-mvp` (pre-release). No production data to migrate.

2. **`MatchedAllocation` intermediate type** — `findMatchingAllocations()` returns `{ mode, allocatedMh }[]` instead of full contract objects. This keeps `computeAllocatedMH()` simple and decoupled from contract structure.

3. **Projection scaling factors**: WEEKLY×1, MONTHLY×4.348, ANNUAL×52.143, TOTAL×(contract_weeks). For TOTAL with no `effective_to`, uses 52-week lookahead.

4. **EXCESS threshold**: >20% over contracted (projected > contracted × 1.20)

5. **Client barrel import trap (D-047)**: `allocation-editor.tsx` imports `computeContractProjection` and `getProjectionStatus` directly from `@/lib/capacity/allocation-engine`, NOT from the barrel `@/lib/capacity` which re-exports server-only modules (better-sqlite3, node-cron).

6. **Editor uses temp keys for lines**: `DemandAllocationLine` objects in the editor get `_tempKey` properties (via `crypto.randomUUID()`) for React list keys, since new lines don't have IDs yet.

7. **`contracted_mh` and `period_type` validation**: Both must be set or both null. Engine and API both enforce this.

## File Paths Reference

| Purpose | Path |
|---------|------|
| Types | `src/types/index.ts` |
| Schema | `src/lib/db/schema.ts` |
| Migration | `src/lib/db/schema-init.ts` |
| Engine | `src/lib/capacity/allocation-engine.ts` |
| Data | `src/lib/capacity/allocation-data.ts` |
| Barrel | `src/lib/capacity/index.ts` |
| API (list/create) | `src/app/api/admin/capacity/demand-contracts/route.ts` |
| API (get/update/delete) | `src/app/api/admin/capacity/demand-contracts/[id]/route.ts` |
| Overview API | `src/app/api/capacity/overview/route.ts` |
| Forecast generate | `src/app/api/admin/capacity/forecast-models/[id]/generate/route.ts` |
| Lens config | `src/lib/capacity/lens-config.ts` |
| Zustand hook | `src/lib/hooks/use-capacity-v2.ts` |
| Admin page | `src/app/(authenticated)/admin/capacity/allocations/page.tsx` |
| Grid | `src/components/admin/capacity/allocation-grid.tsx` |
| Editor | `src/components/admin/capacity/allocation-editor.tsx` |
| Hub | `src/app/(authenticated)/admin/capacity/page.tsx` |
| Capacity page | `src/app/(authenticated)/capacity/page.tsx` |
| Drilldown drawer | `src/components/capacity/shift-drilldown-drawer.tsx` |
| Engine tests | `src/__tests__/capacity/allocation-engine.test.ts` |
| Lens tests | `src/__tests__/capacity/lens-config.test.ts` |
| Docs wiki | `docs-wiki/capacity/*.mdx` |

## Troubleshooting

If tests fail after picking up this work:
1. Run `npx vitest run` — should be 437 tests passing
2. If `allocation-engine.test.ts` fails: check that `makeLine()` helper defaults match the `DemandAllocationLine` interface
3. If `lens-config.test.ts` fails: ensure test data uses `contracts` not `allocations` property
4. If build fails with type errors: check that `DemandAllocation` is fully removed from `src/types/index.ts` and all imports updated
5. If runtime FK errors: ensure M015 migration ran (check `_migrations` table for `M015_demand_contracts`)

If the admin UI has issues:
1. The editor imports `computeContractProjection`/`getProjectionStatus` from `@/lib/capacity/allocation-engine` (direct, NOT barrel)
2. Lines in the editor use `_tempKey` for React keys — these are stripped before API calls
3. Grid expand/collapse uses `expandedIds: Set<number>` state

</critical_context>

---

<current_state>

## Verification Status
- **Tests:** 437/437 pass (`npx vitest run`)
- **Build:** Clean (`npm run build`)
- **Lint:** 0 errors (`npm run lint`)

## Git Status
- **Branch:** `feat/demand-contracts` (off `feat/capacity-mvp`)
- **All code changes are uncommitted** — needs `git add` + `git commit`
- **Old demand-allocations route files have been deleted** (git tracks deletions)

## Deliverable Status

| Deliverable | Status |
|-------------|--------|
| Types + Schema + M015 Migration | **COMPLETE** |
| Engine rewrite (6 functions) | **COMPLETE** |
| Data layer rewrite (transactional CRUD) | **COMPLETE** |
| Engine tests (60 tests) | **COMPLETE** |
| API routes (new endpoints, old deleted) | **COMPLETE** |
| Downstream consumers (overview, forecast, lens, hook) | **COMPLETE** |
| Admin UI (grid + editor rewrite) | **COMPLETE** |
| Capacity UI (drilldown drawer) | **COMPLETE** |
| Test fixups (lens-config, billing, time-bookings) | **COMPLETE** |
| Verification gates (vitest, build, lint) | **COMPLETE** |
| **Documentation updates** | **NOT STARTED** |
| **Project doc updates** (DECISIONS, ROADMAP, etc.) | **NOT STARTED** |
| **Git commit** | **NOT DONE** |
| **Manual UI verification** | **NOT DONE** |

## Open Questions
- None blocking. All code decisions were made per the plan.

</current_state>
