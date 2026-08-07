#!/usr/bin/env bash
# prod-db.sh — pull a production database snapshot and restore it into dev.
#
# Development tooling only. Deliberately lives under .claude/skills/ rather than
# scripts/db/ so it is not part of the shipped application.
#
#   ./prod-db.sh pull              take a snapshot from prod, store it locally
#   ./prod-db.sh restore [PATH]    restore a snapshot into data/dashboard.db
#   ./prod-db.sh list              list local snapshots
#
# restore with no PATH uses the newest snapshot.
#
# Connection settings (env overrides; defaults target the UGreen NAS):
#   PROD_SSH_HOST   guru@192.168.0.92
#   PROD_SSH_KEY    ~/.ssh/nas/dts-nas-key
#   PROD_DB_PATH    /volume2/docker/dts-dash/data/dashboard.db

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SNAP_ROOT="$REPO_ROOT/data/prod-snapshots"
DEV_DB="$REPO_ROOT/data/dashboard.db"

PROD_SSH_HOST="${PROD_SSH_HOST:-guru@192.168.0.92}"
PROD_SSH_KEY="${PROD_SSH_KEY:-$HOME/.ssh/nas/dts-nas-key}"
PROD_DB_PATH="${PROD_DB_PATH:-/volume2/docker/dts-dash/data/dashboard.db}"

RED=$'\e[31m'; GRN=$'\e[32m'; YEL=$'\e[33m'; BLU=$'\e[34m'; RST=$'\e[0m'
say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓ %s%s\n' "$GRN" "$*" "$RST"; }
warn() { printf '%s⚠ %s%s\n' "$YEL" "$*" "$RST"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$RST" >&2; exit 1; }

check_key() {
  [ -f "$PROD_SSH_KEY" ] || die "SSH key not found: $PROD_SSH_KEY
The key on the Windows drive is always mode 0777 under the 9p mount and OpenSSH
will refuse it. Copy it into the WSL home once:
  mkdir -p ~/.ssh/nas
  cp /mnt/c/Users/Jason/.ssh/eddsa_tweedledum_ssh ~/.ssh/nas/dts-nas-key
  chmod 600 ~/.ssh/nas/dts-nas-key"

  local mode
  mode="$(stat -c '%a' "$PROD_SSH_KEY")"
  case "$mode" in
    600|400) ;;
    *) die "SSH key $PROD_SSH_KEY is mode $mode — OpenSSH requires 0600.
  chmod 600 $PROD_SSH_KEY" ;;
  esac
}

# Verify a file is a healthy SQLite DB and print a one-line summary.
verify_db() {
  local db="$1"
  node -e '
    const D = require("better-sqlite3");
    const db = new D(process.argv[1], { readonly: true });
    const integrity = db.pragma("integrity_check")[0].integrity_check;
    if (integrity !== "ok") { console.error("integrity_check: " + integrity); process.exit(1); }
    const n = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
    console.log(`integrity ok — ${n("work_packages")} work packages, ${n("users")} users, ${n("staffing_shifts")} shifts`);
  ' "$db"
}

cmd_pull() {
  check_key
  local ts out_dir out
  ts="$(date -u +%Y-%m-%dT%H-%M-%S)"
  out_dir="$SNAP_ROOT/$ts"
  out="$out_dir/dashboard.db"
  mkdir -p "$out_dir"

  say "${BLU}Host:${RST}   $PROD_SSH_HOST"
  say "${BLU}Remote:${RST} $PROD_DB_PATH"
  say ""
  say "Taking remote snapshot…"

  # sqlite3 .backup gives a consistent copy including WAL content, without
  # stopping the container. Snapshot, stream, and delete in ONE ssh session —
  # the NAS clears /tmp between sessions.
  if ! ssh -i "$PROD_SSH_KEY" "$PROD_SSH_HOST" '
        set -e
        T=$(mktemp /tmp/dtsd-snap.XXXXXX.db)
        trap "rm -f \"$T\"" EXIT
        sqlite3 '"$PROD_DB_PATH"' ".backup $T" >&2
        cat "$T"
      ' > "$out"; then
    rm -rf "$out_dir"
    die "Snapshot failed — nothing written."
  fi

  [ -s "$out" ] || { rm -rf "$out_dir"; die "Snapshot is empty — nothing transferred."; }

  ok "Pulled $(du -h "$out" | cut -f1) → data/prod-snapshots/$ts/dashboard.db"
  if ! verify_db "$out"; then
    rm -rf "$out_dir"
    die "Snapshot failed verification and was discarded."
  fi

  say ""
  say "${BLU}Restore into dev:${RST}"
  say "  .claude/skills/prod-db-snapshot/prod-db.sh restore"
}

cmd_list() {
  [ -d "$SNAP_ROOT" ] || { warn "No snapshots yet."; return; }
  local found=0
  for d in "$SNAP_ROOT"/*/; do
    [ -f "$d/dashboard.db" ] || continue
    found=1
    printf '  %-24s %s\n' "$(basename "$d")" "$(du -h "$d/dashboard.db" | cut -f1)"
  done
  [ "$found" = 1 ] || warn "No snapshots yet."
}

latest_snapshot() {
  ls -1d "$SNAP_ROOT"/*/ 2>/dev/null | sort | tail -1 | sed 's:/*$::'
}

cmd_restore() {
  local src="${1:-}"
  if [ -z "$src" ]; then
    local d; d="$(latest_snapshot)"
    [ -n "$d" ] || die "No snapshots found. Run: prod-db.sh pull"
    src="$d/dashboard.db"
  fi
  [ -d "$src" ] && src="$src/dashboard.db"
  [ -f "$src" ] || die "Snapshot not found: $src"

  say "${BLU}Source:${RST} $src"
  verify_db "$src" || die "Refusing to restore a snapshot that fails verification."
  say ""

  # A running dev server holds the DB open; restoring under it corrupts state.
  if command -v fuser >/dev/null && fuser 3000/tcp >/dev/null 2>&1; then
    warn "Something is listening on :3000 (dev server?). Stop it first:"
    say "  fuser -k 3000/tcp"
    die "Aborted — dev server appears to be running."
  fi

  # Back up whatever is there now, so the restore is reversible.
  if [ -f "$DEV_DB" ]; then
    local bts bdir
    bts="$(date -u +%Y-%m-%dT%H-%M-%S)"
    bdir="$REPO_ROOT/data/backups/pre-restore-$bts"
    mkdir -p "$bdir"
    cp "$DEV_DB" "$bdir/dashboard.db"
    ok "Existing dev DB backed up → data/backups/pre-restore-$bts/dashboard.db"
  fi

  # Stale -wal/-shm belong to the OLD database and must not survive the swap.
  rm -f "$DEV_DB" "$DEV_DB-wal" "$DEV_DB-shm"
  cp "$src" "$DEV_DB"
  chmod 644 "$DEV_DB" 2>/dev/null || true
  ok "Restored → data/dashboard.db"

  say ""
  say "Prod runs an older schema — applying migrations…"
  ( cd "$REPO_ROOT" && npm run db:migrate )

  say ""
  verify_db "$DEV_DB"
  ok "Dev database ready."
  say ""
  warn "Prod user accounts are now the local accounts. If you need the dev"
  warn "superadmin back:  npm run db:reset-password"
}

case "${1:-}" in
  pull)    shift; cmd_pull "$@" ;;
  restore) shift; cmd_restore "$@" ;;
  list)    shift; cmd_list "$@" ;;
  *) die "Usage: prod-db.sh {pull|restore [PATH]|list}" ;;
esac
