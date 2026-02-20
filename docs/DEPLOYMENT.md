# Deployment Guide

> CVG Line Maintenance Dashboard v0.1.0

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10
- SQLite3 CLI (for backups)
- Docker (if using container deployment)

---

## Configuration

The app uses a **two-layer configuration system**:

| Layer | File | What goes here |
|-------|------|---------------|
| **Environment variables** | `.env.local` / `.env.prod` | Secrets and deployment-specific values |
| **Application config** | `server.config.yml` | All non-secret settings (logging, themes, timeline, cron, passwords) |

### Environment Variables

The app reads **7 environment variables** total. For a pre-filled dev setup: `cp docker/.env.dev.example .env.local`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_SECRET` | **Yes** | — | JWT signing secret. 32+ chars. Generate: `npm run generate-secret` |
| `DATABASE_PATH` | No | `./data/dashboard.db` | Path to SQLite database file |
| `NODE_ENV` | No | Set by Next.js | `development` or `production` |
| `BASE_URL` | No | *(unset — derived from Host header)* | Override public base URL. Overrides `app.baseUrl` in config |
| `SENTRY_DSN` | No | *(disabled)* | Error tracking DSN |
| `INITIAL_ADMIN_EMAIL` | No | — | Dev only: auto-create first admin during seed |
| `INITIAL_ADMIN_PASSWORD` | No | — | Dev only: password for auto-created admin |

> See `docker/.env.example` for the full reference with documentation.
> Application settings (logging level, seed endpoint, themes, etc.) are in `server.config.yml`, not env vars.

---

## Option A: Docker (Recommended)

### 1. Clone and configure

```bash
git clone <repo-url> cvg-dashboard
cd cvg-dashboard
cp docker/.env.prod.example .env.prod
npm run generate-secret
# Paste the output as AUTH_SECRET in .env.prod
cp server.config.dev.yml server.config.yml
# Edit server.config.yml: set logging.level: info, features.enableSeedEndpoint: false
```

### 2. Build and start

```bash
docker compose -f docker/docker-compose.prod.yml build
docker compose -f docker/docker-compose.prod.yml up -d
```

This will:
- Build a multi-stage Docker image (Node 20 Alpine) from the root `Dockerfile`
- Mount `./data` as a persistent volume for SQLite
- Mount `./server.config.yml` as read-only config
- Start on port 3000 with auto-restart and health checks

### 3. First-run setup

**No manual `db:seed` is required.** The bootstrap layer (`src/lib/db/bootstrap.ts`, called from `instrumentation.ts`) automatically creates all tables, runs idempotent migrations, and seeds the system user on every startup.

Navigate to `http://localhost:3000/register` to create the first superadmin.

### 4. Seed reference data (recommended)

After first run, populate the aircraft type mappings, manufacturers, models, and engine types:

```bash
docker exec -it dtsd-prod tsx scripts/db/seed-reference.ts
```

Or locally: `npm run db:seed-reference`. This is idempotent — safe to re-run.

### 5. Verify

```bash
docker inspect --format='{{.State.Health.Status}}' dtsd-prod
curl http://localhost:3000/api/health
# Expected: {"status":"healthy","version":"0.1.0","uptime":"...","checks":{...}}
```

### Upgrade procedure (Docker)

```bash
git pull origin master
docker compose -f docker/docker-compose.prod.yml down
docker compose -f docker/docker-compose.prod.yml up -d --build
```

The SQLite database persists in the `./data` volume mount.

See [docker/README.md](docker/README.md) for the full Docker guide, including compose examples, volumes, DB scripts in container, and troubleshooting.

---

## Option B: Bare Metal with PM2

### 1. Clone and install

```bash
git clone <repo-url> cvg-dashboard
cd cvg-dashboard
npm ci
```

### 2. Configure environment

```bash
cp docker/.env.prod.example .env.prod
npm run generate-secret
# Paste the output as AUTH_SECRET in .env.prod
cp server.config.dev.yml server.config.yml
# Edit server.config.yml: set logging.level: info, features.enableSeedEndpoint: false
```

### 3. Build

```bash
npm run build
```

### 4. Start with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

### 5. First-run setup

**No manual `db:seed` is required.** The bootstrap layer auto-creates the schema and system user on startup.

Navigate to `http://<host>:3000/register` to create the first superadmin.

### 6. Seed reference data (recommended)

```bash
npm run db:seed-reference
```

### Upgrade procedure (PM2)

```bash
git pull origin master
npm ci
npm run build
pm2 restart cvg-dashboard
```

---

## Option C: Bare Metal (systemd)

### 1. Build (same as PM2 steps 1-3)

### 2. Create systemd service

Create `/etc/systemd/system/cvg-dashboard.service`:

```ini
[Unit]
Description=CVG Line Maintenance Dashboard
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/cvg-dashboard
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=5

Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/cvg-dashboard/.env.prod

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cvg-dashboard
sudo systemctl start cvg-dashboard
```

---

## Reverse Proxy

The application listens on port 3000. Place a reverse proxy in front for HTTPS.

Auth.js uses `trustHost: true` to derive redirect URLs from the request's `Host` header. If your reverse proxy overwrites the `Host` header (common with Cloudflare Tunnel), set `app.baseUrl` in `server.config.yml`:

```yaml
app:
  baseUrl: "https://dashboard.example.com"
```

Or override via env var: `BASE_URL=https://dashboard.example.com` (takes precedence over the config file).

### Caddy (recommended — auto HTTPS)

```
dashboard.example.com {
    reverse_proxy localhost:3000
}
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.example.com;

    ssl_certificate /etc/ssl/certs/dashboard.pem;
    ssl_certificate_key /etc/ssl/private/dashboard.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Data Directory

```
data/
  dashboard.db       # SQLite database (auto-created on first run)
  dashboard.db-wal   # WAL file (normal — do not delete while running)
  dashboard.db-shm   # Shared memory file (normal)
  input.json         # Work package data (imported via UI or API)
  seed/              # Seed data JSON files
  backups/           # Database backups (created by backup script)
```

Ensure the data directory is:
- Writable by the application user
- Included in your backup strategy
- Mounted as a Docker volume (if using containers)

---

## Scheduled Tasks

The application includes an in-process cron scheduler (`node-cron`). **No external crontab or task scheduler is needed.**

### Built-in Tasks

| Task | Default Schedule | Description |
|------|-----------------|-------------|
| Cleanup Canceled WPs | Every 6 hours (`0 */6 * * *`) | Deletes canceled work packages past the grace period |

### Configuration

Schedules and options can be overridden in `server.config.yml`:

```yaml
cron:
  jobs:
    cleanup-canceled:
      schedule: "0 */12 * * *"   # override: every 12h
      options:
        graceHours: 12           # override: 12h grace period
```

Custom jobs can be added by pointing to a TypeScript module with an `execute()` export:

```yaml
cron:
  jobs:
    nightly-backup:
      name: "Nightly DB Backup"
      script: "scripts/cron/nightly-backup.ts"
      schedule: "0 3 * * *"
```

### Management

Use the **Admin > Cron Jobs** UI to view, edit, suspend/resume, and manually trigger jobs. The global kill switch `features.cronEnabled: false` in `server.config.yml` disables all scheduled tasks.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `AUTH_SECRET is not set` error | Missing env var | Run `npm run generate-secret`, set in `.env.local` or `.env.prod` |
| `AUTH_SECRET must be at least 32 characters` | Secret too short | Run `npm run generate-secret` |
| `SQLITE_CANTOPEN` | Data dir not writable | Check volume mount permissions: `chown 1001:1001 ./data` |
| Health check returns 503 | Database unreachable | Check `DATABASE_PATH`, file permissions, volume mount |
| Login page shows but can't log in | No users exist | Navigate to `/register` (first user becomes superadmin) |
| Port 3000 already in use | Another process | `lsof -i :3000` then `kill <PID>`, or use `PORT=3001` |
| Login/logout redirects to localhost | Reverse proxy overwrites `Host` header | Set `app.baseUrl` in `server.config.yml` or `BASE_URL` env var to your public URL |
| Config changes not applied | Config cached | Restart the container to reload `server.config.yml` |
