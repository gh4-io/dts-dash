# Monitoring Runbook

> CVG Line Maintenance Dashboard v0.1.0

## Health Check

### Endpoint

```
GET /api/health
```

No authentication required. Returns:

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": "3600s",
  "checks": {
    "database": { "status": "ok" },
    "dataFile": { "status": "ok" }
  }
}
```

| Status Code | Meaning |
|-------------|---------|
| 200 | All checks pass |
| 503 | Database unreachable |

### Monitoring integration

```bash
# Simple cron check
*/5 * * * * curl -sf http://localhost:3000/api/health > /dev/null || echo "Dashboard unhealthy" | mail -s "Alert" ops@example.com

# Docker healthcheck (built into docker-compose.yml)
# Runs every 30s, 3 retries before marking unhealthy
```

---

## Logs

### Log format

| Environment | Format | Output |
|-------------|--------|--------|
| Development | Pretty-printed (pino-pretty) | stdout |
| Production | JSON (structured) | stdout/stderr |

### Log levels

All server-side logging uses pino with child loggers named by module:

```json
{"level":30,"time":1708099200000,"pid":1,"hostname":"cvg","msg":"Seeding complete.","module":"seed"}
{"level":50,"time":1708099200000,"pid":1,"hostname":"cvg","msg":"POST error","module":"api/admin/users","err":{...}}
```

| Level | Name | When |
|-------|------|------|
| 10 | trace | Verbose debug (not used in production) |
| 20 | debug | Debug detail |
| 30 | info | Normal operations (startup, seeding, imports) |
| 40 | warn | Non-critical issues (missing optional config) |
| 50 | error | Errors requiring attention |
| 60 | fatal | Application cannot continue |

### Viewing logs

```bash
# Docker
docker compose logs -f dashboard
docker compose logs --since 1h dashboard

# PM2
pm2 logs cvg-dashboard
pm2 logs cvg-dashboard --lines 100

# systemd
journalctl -u cvg-dashboard -f
journalctl -u cvg-dashboard --since "1 hour ago"
```

### Filtering JSON logs

```bash
# Errors only
docker compose logs dashboard 2>&1 | grep '"level":50'

# Specific module
docker compose logs dashboard 2>&1 | grep '"module":"api/ingest"'

# With jq (recommended)
docker compose logs dashboard 2>&1 | jq 'select(.level >= 50)'
```

---

## Alert Conditions

### Critical (immediate response)

| Condition | Detection | Action |
|-----------|-----------|--------|
| Health check returns 503 | `/api/health` monitoring | Check database file exists and is readable. Restart application. |
| Application not responding | No response on port 3000 | Check container/process status. Review logs. Restart. |
| Database corruption | `PRAGMA integrity_check` fails | Stop application. Restore from backup. |
| Disk full | Log write failures, DB errors | Free disk space. Prune old backups/logs. |

### Warning (investigate within hours)

| Condition | Detection | Action |
|-----------|-----------|--------|
| Health check missing data file | `dataFile.status: "warning"` | Import work package data via Admin UI |
| High error rate in logs | `level >= 50` frequency | Review error logs, check for patterns |
| Login rate limiting triggered | Rate limit log entries | Normal if occasional. Investigate if persistent (possible brute force). |
| Backup script failures | Cron log errors | Check disk space, database path, sqlite3 availability |
| Cron job failure | Admin > Cron Jobs shows red status | Check last run message, review `cron:*` logs |

---

## Scheduled Task Health

### Checking Status

1. **Admin UI**: Navigate to **Admin > Cron Jobs** — table shows status dot (green/red/gray), last run time, and error messages.
2. **Logs**: Cron tasks log under child loggers `cron`, `cron:cleanup-canceled`, etc. Filter for `cron` prefix.

### Log Output

```
[cron] Cron scheduler started {"jobCount":1}
[cron:cleanup-canceled] Cron job executing
[cron:cleanup-canceled] Deleted 3 canceled WP(s), 0 override(s)
```

### What to Monitor

| Check | Healthy | Unhealthy |
|-------|---------|-----------|
| Last run time | Within expected schedule interval | Significantly overdue |
| Last run status | `success` | `error` (check message) |
| Run count | Incrementing | Stuck at 0 |

### Troubleshooting

- **Job not running**: Check `features.cronEnabled` in `server.config.yml` (must be `true`). Verify job is not suspended (Admin UI shows gray dot).
- **Job errors**: Check last run message in Admin UI or `cron:*` log entries.
- **Missed schedules**: Application restart resets the scheduler. All active jobs re-register on startup.

---

## Common Failure Scenarios

### 1. Database locked / WAL corruption

**Symptoms**: API returns 500 errors, logs show "database is locked"

**Cause**: Typically from improper shutdown or file copy while running

**Resolution**:
```bash
# Stop the application first
docker compose down

# Check integrity
sqlite3 data/dashboard.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
cp data/backups/dashboard_LATEST.db data/dashboard.db
rm -f data/dashboard.db-wal data/dashboard.db-shm

# Restart
docker compose up -d
```

### 2. Application won't start

**Symptoms**: Container exits immediately, PM2 shows "errored" status

**Common causes**:
- Missing `AUTH_SECRET` in production
- Database file path doesn't exist or not writable
- Port 3000 already in use

**Resolution**:
```bash
# Check logs for the specific error
docker compose logs dashboard | tail -20

# Verify environment
docker compose config  # Shows resolved env vars
```

### 3. Users can't log in

**Symptoms**: Login returns "Invalid credentials" for all users

**Possible causes**:
- No users in database (fresh install)
- All users deactivated
- Auth secret changed (invalidates all JWTs)

**Resolution**:
```bash
# Check if users exist
sqlite3 data/dashboard.db "SELECT email, is_active FROM users;"

# If no users, visit /setup to create initial admin
# If auth secret changed, users must log in again (expected)
```

### 4. Data not showing in dashboard

**Symptoms**: Dashboard is empty, no work packages displayed

**Cause**: No data imported yet

**Resolution**:
1. Check health endpoint: `curl localhost:3000/api/health`
2. If `dataFile.status: "warning"`, import data via Admin > Import
3. Check import history: Admin > Import > History

### 5. High memory usage

**Symptoms**: Application consuming >512MB, PM2 restarting

**Cause**: Large dataset, memory leak, or unoptimized queries

**Resolution**:
```bash
# Check PM2 memory
pm2 monit

# If persistent, increase PM2 limit
# Edit ecosystem.config.js: max_memory_restart: "1G"
pm2 restart cvg-dashboard
```

---

## Maintenance Tasks

| Task | Frequency | Command |
|------|-----------|---------|
| Database backup | Daily (automated) | `./scripts/backup-db.sh` |
| Log rotation | Weekly | Docker handles this; PM2: `pm2 flush` |
| Prune old backups | Automatic (in backup script) | Configured via retention days |
| Check disk usage | Weekly | `du -sh data/ logs/` |
| Verify backup integrity | Monthly | `sqlite3 data/backups/latest.db "PRAGMA integrity_check;"` |
| Update dependencies | As needed | `npm audit`, `npm update` |
