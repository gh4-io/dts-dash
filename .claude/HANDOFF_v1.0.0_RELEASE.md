# Handoff — cutting the v1.0.0 release (Phase 6)

> Written 2026-08-08. All feature and schema work for v1.0.0 is **complete, committed and pushed**.
> What remains is release mechanics only. This document is self-contained: it assumes no knowledge
> of the session that produced the work.

## Where things stand

- `origin/dev` is the source of truth and is current. `master` is still at `v0.2.0` (`3936094`).
- `dev` is ~255 commits ahead of `master`.
- `npm run validate` exits 0 — **911 tests / 41 files**.
- `package.json` still says `0.3.0`. That is correct and intentional; see §2.
- `origin` carries only `dev` and `master`.
- The local dev database has already been upgraded and is stamped `schemaVersion = 1.0.0`.

**Production runs `0.2.0-rc1`** and predates everything here.

## What v1.0.0 contains (needed for the Migration Guide)

Six breaking changes, all merged:

| Item | What broke |
|---|---|
| OI-086 | `work_packages.title` removed; contents moved to `workpackage_no`. `WorkPackage.title` and `SerializedWorkPackage.title` are gone |
| OI-099 | Six messaging tables replaced by `messages` / `labels` / `message_labels`. **`/feedback/[id]` links break** — post ids were remapped (4/5/6 → 49/50/51) because four independent AUTOINCREMENT sequences collided. Old ids survive on `messages.legacy_id` |
| OI-109 | `headcount` removed from the staffing-matrix API response. Use `rosterHeadcount` / `effectiveHeadcount` |
| OI-125 | `mh_override_history.work_package_id` FK removed (it aborted the `cleanup-canceled` cron) |
| OI-111 | `staffing_shifts.group_id` added; overlap detection keys on lineage, not name |
| OI-126 | Partial UNIQUE indexes on `capacity_assumptions` and `staffing_configs` |

**`npm run db:upgrade-v1` is mandatory.** Deploying without it produces a working app that silently shows blank work-package identifiers and empty comment/notification/feedback lists — no error, no log line. This already happened once during development.

---

## The work

### 1. Branch strategy — read `.claude/SPECS/REQ_Versioning.md` first

That spec documents *two* patterns and you need the second one:

- **Hotfix**: branch from `master`, cherry-pick. Do NOT use this — `dev` is 255 commits ahead.
- **Large release**: branch `release/v1.0.0` **from `dev`**.

Both invariants still hold: the version is bumped **on the release branch, never on `dev`**, and `master` is reached only through a reviewed PR.

### 2. Version bump

`npm version major --no-git-tag-version` **on `release/v1.0.0` only**.

⚠️ The `version` npm hook runs `node scripts/db/sync-version.mjs && git add -A`. It will sweep the entire working tree. Make sure the tree is clean first, and inspect `git diff` before it commits.

`dev` keeps its current `package.json` version; it realigns by merging `master` back after the release.

### 3. CHANGELOG surgery — three separate problems

1. **Delete the 3-line note under `## [Unreleased]`** (currently lines 10–12), which reads *"…fold these into `[0.3.0]`, or split them into `[0.3.1]`, when the release boundary is decided."* `sync-version.mjs` renames the heading only — **it will publish that note verbatim inside the released `[1.0.0]` section.**
2. **Merge `[Unreleased]` and `[0.3.0]` into a single `[1.0.0]`.** v0.3.0 was never released; no tag for it has ever existed.
3. **Fix the compare links.** They reference `v0.3.0`, a tag that does not exist, so they are dead. `[1.0.0]` should compare from `v0.2.0`.

### 4. Stale version labels — 9 to change, 5 to LEAVE

`grep -rn "v0\.3\.0" src/` returns 14 hits. **Do not blanket-replace.**

**Change these 9** — they are module titles that now misstate the version:
```
src/lib/capacity/capacity-core.ts:2      src/lib/capacity/index.ts:2
src/lib/capacity/demand-engine.ts:2      src/lib/db/schema-init.ts:452
src/lib/capacity/capacity-data.ts:2      src/lib/db/schema.ts:467
src/lib/capacity/staffing-data.ts:2      src/types/index.ts:194
src/lib/capacity/staffing-engine.ts:2
```

**Leave these** — they are deliberate historical prose describing what changed *from* v0.3.0, and rewriting them would destroy the explanation:
`src/app/api/feedback/[id]/route.ts` (2), `src/app/api/notifications/route.ts`, `src/lib/messages/repository.ts` (3), and both `src/__tests__/db/*.test.ts`.

### 5. Other content fixes

- **`scripts/db/sync-version.mjs`** covers `docs/{DEPLOYMENT,MONITORING,BACKUP}.md` + CHANGELOG only. Add `build.json` and `README.md` so they stop drifting each release.
- **`docker/docker-compose.prod.yml:31`** pins `image: dtsd:latest`, so **production cannot roll back by tag** — even though `docker:build:tag` already produces a versioned image nothing consumes. Use `dtsd:${VERSION}`.
- **`CLAUDE.md`** — the CURRENT STATE block still describes a mid-flight v0.3.0 and an "unfinished" pill-marker redesign. That redesign was **cancelled, not deferred**: the AOG diamond is the intended design now. Rewrite the block for 1.0.0.

### 6. Migration Guide — mandatory

`REQ_Versioning.md` requires MAJOR release notes to include a Migration Guide covering what broke, how to update data, and step-by-step upgrade instructions. Build it from the table at the top of this document. It must state that `db:upgrade-v1` is not optional.

### 7. Docker gate (before tagging)

Per `CLAUDE.md`: prod image builds, dev target builds, compose starts and stays healthy, `wget -qO- http://localhost:3000/api/health` responds, `docker exec <c> tsx scripts/db/status.ts` works, and `docker exec <c> ls node_modules/vitest` **fails** (no dev deps in prod).

### 8. Production rehearsal — do NOT skip

Against a **fresh production snapshot**, not the dev copy:

1. `.claude/SKILLS/prod-db-snapshot/` pulls the snapshot.
2. `npm run db:backup`.
3. `npm run db:upgrade-v1` — it takes its own backup first and prints the rollback command.
4. Verify: `workpackage_no` populated; `messages` reconciles against the legacy tables; `13SMD` has no overlapping versions; `foreign_key_check` and `integrity_check` clean.
5. Re-run — must report "already at the v1.0.0 schema — nothing to do".
6. Restore the backup to prove rollback works.

⚠️ `npm run db:export` is **not** a backup — its table list omits several tables. Use `npm run db:backup`.

### 9. Release execution

```bash
git checkout dev && git pull
git checkout -b release/v1.0.0
npm version major --no-git-tag-version     # inspect git diff before it commits
npm run validate; echo $?                   # MUST print 0
git push origin release/v1.0.0
gh pr create --base master --title "release: v1.0.0"
# after merge:
git checkout master && git pull
git tag -a v1.0.0 -m "v1.0.0: ..."
git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0" --notes-file RELEASE_NOTES.md
git checkout dev && git merge master
```

**Tag/branch policy** (see `REQ_Versioning.md`): a **release** tag points at `master`; **pre-release/RC** tags legitimately point at release-branch commits. Retain a release branch only while a tag points into it; otherwise prune it once `v1.0.0` is tagged.

---

## Traps that will cost you time

1. **`npm run validate` exit code.** `next build` compiles first and type-checks second, so it prints `✓ Compiled successfully` and *then* fails. Piping to `head`/`tail` discards the exit code and makes a red build look green. Always `npm run validate; echo $?` or redirect to a file. This masked a broken gate here for ~4 months.
2. **vitest does not type-check.** All 911 tests can pass while `tsc --noEmit` fails.
3. **Turbopack file watching does not fire on `/mnt/d`** (9p mount). Restart the dev server after every change or you will verify a stale build. `fuser -k 3000/tcp`.
4. **Backticks inside the SQL template literal** in `schema-init.ts` terminate the string. Comments there must not use them.
5. **`schema-init` binds its SQLite handle at module load** from `DATABASE_PATH`, and Node caches modules — importing it twice with different paths silently writes to the wrong database.
6. Dev login is `admin` / `admin123`.

## Open, deliberately not done

`OI-119`'s follow-up `OI-122`; `OI-123` (drop the six legacy messaging tables in v1.1.0); and three accepted schema risks with zero-schema mitigations — `capacity_shifts.code` as a string key, `work_packages.customer` as a name rather than an id, and no idempotency key on `time_bookings`/`billing_entries`. None block the release.

**Also outstanding**: `v0.2.0-rc1` exists only locally and is the tag production currently runs. Consider `git push origin v0.2.0-rc1` so the deployed version is identifiable from the remote.
