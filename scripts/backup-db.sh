#!/usr/bin/env bash
#
# Database backup script — WAL-safe SQLite backup
# Usage: ./scripts/backup-db.sh [retention_days]
# Cron:  0 2 * * * /path/to/scripts/backup-db.sh 7
#

set -euo pipefail

DB_PATH="${DATABASE_PATH:-./data/dashboard.db}"
BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
RETENTION_DAYS="${1:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dashboard_${TIMESTAMP}.db"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check source DB exists
if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at $DB_PATH"
  exit 1
fi

# WAL-safe backup using sqlite3 .backup command
echo "Backing up $DB_PATH -> $BACKUP_FILE"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Verify backup integrity
echo "Verifying backup integrity..."
RESULT=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)
if [ "$RESULT" != "ok" ]; then
  echo "ERROR: Backup integrity check failed: $RESULT"
  rm -f "$BACKUP_FILE"
  exit 1
fi

FILESIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)
echo "Backup complete: $BACKUP_FILE (${FILESIZE} bytes)"

# Prune old backups
echo "Pruning backups older than ${RETENTION_DAYS} days..."
PRUNED=$(find "$BACKUP_DIR" -name "dashboard_*.db" -mtime "+${RETENTION_DAYS}" -delete -print | wc -l)
echo "Pruned ${PRUNED} old backup(s)."
