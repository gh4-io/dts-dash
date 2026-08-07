---
name: prod-db-snapshot
description: Pull a snapshot of the dts-dash production database from the NAS and restore it into the local dev database. Use when the user asks to refresh dev data from production, pull a prod backup, restore prod data locally, or work against real data instead of seed data.
---

# Production DB Snapshot → Dev

Dev work on this project runs against a **copy of production data**, not seed data —
seed data is thin and hides real edge cases (see the working-preferences memory).
This skill pulls that copy and installs it.

It is deliberately **outside the application**: no `npm run db:*` script, no entry
in `package.json`. It is local developer tooling, not something the app ships.

## Usage

```bash
.claude/skills/prod-db-snapshot/prod-db.sh pull      # snapshot prod → data/prod-snapshots/<ts>/
.claude/skills/prod-db-snapshot/prod-db.sh restore   # newest snapshot → data/dashboard.db
.claude/skills/prod-db-snapshot/prod-db.sh list      # what has been pulled
```

`restore` accepts an explicit snapshot path or directory as its argument.

## What it does

**pull** — runs `sqlite3 .backup` on the production host and streams the result
back. That is a consistent copy including WAL content, taken without stopping the
`dtsd-prod` container. Copying `dashboard.db` alone would silently lose whatever
is still in `dashboard.db-wal`. The snapshot is verified (`integrity_check` plus
row counts) before it is kept; a bad transfer is discarded rather than stored.

**restore** — verifies the snapshot, refuses to run while a dev server holds the
DB open on :3000, backs up the current `data/dashboard.db` to
`data/backups/pre-restore-<ts>/`, removes stale `-wal`/`-shm` files belonging to
the old DB, copies the snapshot in, then runs `npm run db:migrate`.

**Production is on an older schema** (`0.2.0-rc1`, pre-OI-080) than this branch,
so the migrate step is required, not optional.

## Connection

Overridable by env var; defaults target the UGreen NAS:

| Var | Default |
|-----|---------|
| `PROD_SSH_HOST` | `guru@192.168.0.92` |
| `PROD_SSH_KEY` | `~/.ssh/nas/dts-nas-key` |
| `PROD_DB_PATH` | `/volume2/docker/dts-dash/data/dashboard.db` |

**SSH key setup (one time).** The key lives on the Windows drive, which is a 9p
mount that reports mode 0777 for every file. OpenSSH rejects it and falls back to
password auth. `chmod` on the mount does not stick, so copy the key into the WSL
home:

```bash
mkdir -p ~/.ssh/nas
cp /mnt/c/Users/Jason/.ssh/eddsa_tweedledum_ssh ~/.ssh/nas/dts-nas-key
chmod 600 ~/.ssh/nas/dts-nas-key
```

## After restoring

- Snapshots under `data/prod-snapshots/` are **gitignored** — production data
  must never reach a commit.
- The local accounts are now the **production** accounts. The dev superadmin
  (`admin` / `admin123`) no longer exists until you run `npm run db:reset-password`.
- Restoring seed data for import testing? Run `npm run db:seed`, then
  `prod-db.sh restore` when finished to get real data back.
