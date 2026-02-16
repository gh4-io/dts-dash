# Backup Procedures

> CVG Line Maintenance Dashboard v0.1.0

## What to Back Up

| Item | Location | Priority |
|------|----------|----------|
| SQLite database | `data/dashboard.db` | **Critical** |
| Environment file | `.env.local` | **Critical** |
| Imported data | `data/input.json` | Important |
| Seed data | `data/seed/` | Low (tracked in git) |

The database contains all users, sessions, customers, aircraft data, import history, analytics events, and app configuration.

---

## Backup Script

The provided backup script creates WAL-safe SQLite backups with integrity verification.

### Location

```
scripts/backup-db.sh
```

### Usage

```bash
# Default: 7-day retention
./scripts/backup-db.sh

# Custom retention (30 days)
./scripts/backup-db.sh 30
```

### What it does

1. Uses `sqlite3 .backup` for a WAL-safe snapshot (no downtime)
2. Verifies the backup with `PRAGMA integrity_check`
3. Deletes backups older than the retention period
4. Creates timestamped files in `data/backups/`

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./data/dashboard.db` | Source database path |
| `BACKUP_DIR` | `./data/backups` | Backup output directory |

---

## Automated Backups (cron)

Add to crontab (`crontab -e`):

```bash
# Daily at 2:00 AM, 7-day retention
0 2 * * * cd /opt/cvg-dashboard && ./scripts/backup-db.sh 7 >> /var/log/cvg-backup.log 2>&1
```

For Docker deployments, run from the host:

```bash
# Backup the mounted volume database
0 2 * * * cd /opt/cvg-dashboard && sqlite3 ./data/dashboard.db ".backup './data/backups/dashboard_$(date +\%Y\%m\%d_\%H\%M\%S).db'"
```

---

## Restore Procedure

### 1. Stop the application

```bash
# Docker
docker compose down

# PM2
pm2 stop cvg-dashboard

# systemd
sudo systemctl stop cvg-dashboard
```

### 2. Verify backup integrity

```bash
sqlite3 data/backups/dashboard_20260216_020000.db "PRAGMA integrity_check;"
# Expected output: ok
```

### 3. Replace the database

```bash
# Remove WAL files (they belong to the old DB)
rm -f data/dashboard.db-wal data/dashboard.db-shm

# Restore from backup
cp data/backups/dashboard_20260216_020000.db data/dashboard.db
```

### 4. Restart the application

```bash
# Docker
docker compose up -d

# PM2
pm2 restart cvg-dashboard

# systemd
sudo systemctl start cvg-dashboard
```

### 5. Verify

```bash
curl http://localhost:3000/api/health
```

---

## Manual Backup

If the backup script is not available:

```bash
# WAL-safe backup (preferred)
sqlite3 data/dashboard.db ".backup 'data/backups/manual_$(date +%Y%m%d).db'"

# Simple file copy (only safe if application is stopped)
cp data/dashboard.db data/backups/manual_$(date +%Y%m%d).db
```

Always use `sqlite3 .backup` when the application is running. A plain `cp` while the app is running may produce a corrupt backup if there are active writes.

---

## Offsite Backup

For critical deployments, copy backups to a remote location:

```bash
# rsync to remote server
rsync -az data/backups/ user@backup-server:/backups/cvg-dashboard/

# S3/MinIO
aws s3 sync data/backups/ s3://your-bucket/cvg-dashboard-backups/
```
