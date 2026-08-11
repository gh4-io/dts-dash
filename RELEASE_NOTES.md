# v1.0.0 — Unified Messaging, Capacity Corrections & the First Major

**Release date:** 2026-08-09 | **~266 commits since v0.2.0** | **MAJOR release** — contains backwards-incompatible changes

> **⚠️ `npm run db:upgrade-v1` is mandatory.** v1.0.0 moves data between columns and tables. The app
> checks the schema at startup and **refuses to serve** a database that has not been upgraded, rather
> than returning blank identifiers and empty lists. Stop the app, run the upgrade, then start it.
>
> Full instructions: **[Migration Guide](CHANGELOG.md#migration-guide--upgrading-to-v100)**.

## Why 1.0.0

v0.3.0 was bumped in `package.json` on 2026-03-04 but never tagged or released. Rather than untangle
it, its work is folded into this release. A MAJOR is also the only window the project's versioning
rules (D-028) allow for the breaking changes that had been parked waiting for one.

## Highlights

- **Unified messaging** — six overlapping tables (`flight_comments`, `notifications`, `feedback_posts`,
  `feedback_comments`, `feedback_labels`, `feedback_post_labels`) become one `messages` table plus
  `labels` / `message_labels`. The API contract types are unchanged, so no client code needs updating.
- **Work package identifiers fixed at the source** — inbound SharePoint `Title` carries the work
  package *number*, but since v0.1.1 it was written to a column called `title` while `workpackage_no`
  sat NULL on every row. The two are now one column.
- **Capacity has one engine** — the legacy `headcount × 6.5` model and its editable-but-inert Admin
  settings are gone. Productive MH derives from the paid → available → productive chain.
- **Effective dating works end to end** — shift and rotation-pattern versions carry lineage
  (`group_id`) rather than being matched by name, so renaming a shift no longer splits its history or
  hides an overlap.
- **Upgrades from any released schema** — v0.1.0, v0.1.1, v0.2.0 and v0.2.0-rc1 were each verified to
  reach a schema identical to a fresh v1.0.0 install, idempotently, with a full backup taken first.
- **Import history retention** — a nightly prune with a configurable window. The production log had
  no retention at all and had reached 12,159 rows, 19% of the database.

## Breaking changes

| Item | What changed | Action |
|---|---|---|
| OI-086 | `work_packages.title` removed; contents now in `workpackage_no` | Read `workpackageNo` |
| OI-099 | Six messaging tables unified; post ids renumbered | None — old links redirect |
| OI-109 | `headcount` removed from the staffing-matrix response | Use `rosterHeadcount` / `effectiveHeadcount` |
| OI-125 | `mh_override_history.work_package_id` FK removed | None |
| OI-111 | `staffing_shifts.group_id` added; overlap keys on lineage | None — backfilled |
| OI-126 | Partial UNIQUE indexes on `capacity_assumptions`, `staffing_configs` | None unless existing rows violate them |

Pre-v1.0.0 `/feedback/[id]` links keep working: they resolve through `messages.legacy_id` and
permanently redirect to the current URL. **The id remap is specific to your database** — do not rely
on a fixed mapping.

## Upgrading

```bash
docker compose -f docker/docker-compose.prod.yml down   # the database must not be open
npm run db:upgrade-v1 -- --dry-run                       # preview, writes nothing
npm run db:upgrade-v1                                    # backs up first, prints the rollback command
VERSION=1.0.0 docker compose -f docker/docker-compose.prod.yml up -d
```

Rollback: restore the backup written to `data/backups/pre-v1-<timestamp>/` and start the previous
image. Production images are now pinned by version, so `VERSION=0.2.0 docker compose up -d` is a real
rollback path — previously every build overwrote `dtsd:latest` and there was nothing to go back to.

⚠️ `npm run db:export` is **not** a backup — its table list omits several tables. Use `npm run db:backup`.

## Full detail

See [CHANGELOG.md](CHANGELOG.md#100---2026-08-09).
