# Docker & Environment Configuration

Authoritative reference for containerized deployment and environment setup.

The project uses a **single root `Dockerfile`** with two build targets:
- **`prod`** (default) — Minimal Next.js standalone image
- **`dev`** — Hot-reload dev server with source bind-mounted

---

## Configuration Model

The app uses a **two-layer configuration system**:

| Layer | File | What goes here | Examples |
|-------|------|---------------|----------|
| **Environment variables** | `.env.local` / `.env.prod` | Secrets and deployment-specific values | `AUTH_SECRET`, `DATABASE_PATH` |
| **Application config** | `server.config.yml` | All non-secret settings | Logging, themes, timeline, passwords, cron |

**Rule of thumb:** If it's a secret or changes per deployment target, it's an env var. Everything else goes in `server.config.yml`.

---

## Environment Variables

The app reads **7 environment variables** total:

### Required

| Variable | Description | Generate |
|----------|-------------|----------|
| `AUTH_SECRET` | Auth.js JWT signing secret (32+ chars) | `npm run generate-secret` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./data/dashboard.db` | SQLite file path. Docker: `/app/data/dashboard.db` |
| `NODE_ENV` | Set by Next.js | `development` / `production` / `test` |
| `BASE_URL` | *(unset — derived from Host header)* | Override public base URL (reverse proxy scenarios). Overrides `app.baseUrl` in config |
| `SENTRY_DSN` | *(disabled)* | Sentry error tracking DSN |

### Development Only

| Variable | Description |
|----------|-------------|
| `INITIAL_ADMIN_EMAIL` | Auto-create first admin during `db:seed` |
| `INITIAL_ADMIN_PASSWORD` | Password for the auto-created admin |

> **Never set `INITIAL_ADMIN_*` in production.** Use `/register` for the first superadmin.

---

## How `.env` Files Work

### Local Development (`npm run dev`)

Next.js **auto-loads `.env.local`** from the project root. No configuration needed — create the file, start the server, and the values are available as `process.env.*`.

```
.env.local (project root)  -->  Next.js reads at startup  -->  process.env.AUTH_SECRET
```

### Docker (`docker compose up`)

The compose `env_file` directive reads the file from the **host filesystem** and injects key-value pairs as environment variables into the container. The file itself is NOT mounted — only its values are passed as env vars.

```
.env.prod (host)  -->  compose env_file  -->  container env vars  -->  process.env.AUTH_SECRET
```

**Security:** `.dockerignore` excludes all `.env*` files from the Docker build context. Secrets are never baked into image layers.

### Bare Metal / PM2 / systemd

Source the file manually, or use the service manager's env loading:

```bash
# PM2
pm2 start ecosystem.config.js  # reads from .env.prod

# systemd
EnvironmentFile=/opt/cvg-dashboard/.env.prod
```

---

## Environment File Templates

| File | Purpose | Usage |
|------|---------|-------|
| `docker/.env.example` | Complete reference with all vars documented | Read for understanding |
| `docker/.env.dev.example` | Pre-filled dev values, copy-paste ready | `cp docker/.env.dev.example .env.local` |
| `docker/.env.prod.example` | Production template with placeholders | `cp docker/.env.prod.example .env.prod` |

---

## Quick Start — Development

```bash
# 1. Create env file (pre-filled with dev defaults)
cp docker/.env.dev.example .env.local

# 2. Create config file
cp server.config.dev.yml server.config.yml

# 3. Start dev server
npm run dev

# App: http://localhost:3000
# The database auto-bootstraps on first start (no manual seed required).
# Navigate to /register to create the first superadmin.
```

### With Docker:

```bash
docker compose -f docker/docker-compose.dev.yml up

# Source changes in src/ trigger hot reload automatically
```

---

## Quick Start — Production

### Docker Compose

```bash
# 1. Create env file
cp docker/.env.prod.example .env.prod
# Edit .env.prod — replace <generate-with-npm-run-generate-secret>:
npm run generate-secret

# 2. Create config file (edit for production settings)
cp server.config.dev.yml server.config.yml
# Set: logging.level: info, features.enableSeedEndpoint: false

# 3. Build + start
docker compose -f docker/docker-compose.prod.yml build
docker compose -f docker/docker-compose.prod.yml up -d

# 4. Verify
docker compose -f docker/docker-compose.prod.yml ps
docker inspect --format='{{.State.Health.Status}}' dtsd-prod
```

### Standalone Docker

```bash
docker build -t dtsd .
docker run -d \
  -p 3000:3000 \
  --env-file .env.prod \
  -v ./data:/app/data \
  -v ./server.config.yml:/app/server.config.yml:ro \
  dtsd
```

### Bare Metal

```bash
cp docker/.env.prod.example .env.prod
# Edit .env.prod: set AUTH_SECRET, DATABASE_PATH=./data/dashboard.db
cp server.config.dev.yml server.config.yml

npm run build
npm start
```

---

## Build Targets

```bash
# Production (default target)
docker build -t dtsd .

# Development
docker build --target dev -t dtsd:dev .

# With OCI labels
docker build \
  --build-arg GIT_SHA=$(git rev-parse HEAD) \
  --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --build-arg VERSION=0.1.0 \
  -t dtsd:0.1.0 .
```

---

## Volumes

| Host path | Container path | Notes |
|-----------|---------------|-------|
| `./data/` | `/app/data` | SQLite database + input files (persistent) |
| `./server.config.yml` | `/app/server.config.yml` | Runtime config (read-only; fallback baked into image) |

---

## First Run

The app auto-bootstraps the database on startup (`instrumentation.ts` → `bootstrap.ts`):
- Creates all tables (23 tables, idempotent)
- Runs pending migrations
- Seeds system user and default config values

No manual `db:seed` required. Navigate to `/register` to create the first superadmin.

---

## DB Scripts in Container

```bash
# Check database status
docker exec -it dtsd-prod tsx scripts/db/status.ts

# Create a backup
docker exec -it dtsd-prod tsx scripts/db/backup.ts

# Reset database (interactive — requires -it)
docker exec -it dtsd-prod tsx scripts/db/reset.ts

# Seed reference data
docker exec -it dtsd-prod tsx scripts/db/seed-reference.ts
```

---

## Reverse Proxy

The prod compose binds to `127.0.0.1:3000` only. Place Nginx, Caddy, or Cloudflare Tunnel in front for HTTPS.

If the proxy rewrites the `Host` header, set `app.baseUrl` in `server.config.yml`:

```yaml
app:
  baseUrl: "https://your-domain.com"
```

Or override via env var: `BASE_URL=https://your-domain.com` in `.env.prod` (takes precedence over the config file).

---

## Health Check

The prod image includes a built-in `HEALTHCHECK` that polls `/api/health` every 30s. This endpoint verifies database connectivity and returns 503 if unhealthy.

```bash
docker inspect --format='{{.State.Health.Status}}' dtsd-prod
curl http://localhost:3000/api/health
```

---

## Security Best Practices

### Do

- Generate a **unique AUTH_SECRET** for each environment
- Use a **secret manager** in production (AWS Secrets, Azure Key Vault, HashiCorp Vault)
- Rotate secrets periodically
- Set `logging.level: info` and `features.enableSeedEndpoint: false` in production config
- Keep `.env.local` / `.env.prod` out of version control

### Don't

- Never commit `.env.local` or `.env.prod` to git
- Never use dev secrets in production
- Never hardcode secrets in code or Dockerfiles
- Never set `INITIAL_ADMIN_*` in production
- Never share secrets in Slack, email, or documentation

---

## Deployment Scenarios

### Kubernetes

```bash
# Create secret
kubectl create secret generic dashboard-secrets \
  --from-literal=AUTH_SECRET="<your-secret>"
```

```yaml
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-config
data:
  NODE_ENV: "production"
  DATABASE_PATH: "/app/data/dashboard.db"
```

```yaml
# Deployment
spec:
  containers:
  - name: dashboard
    image: dtsd:latest
    envFrom:
    - secretRef:
        name: dashboard-secrets
    - configMapRef:
        name: dashboard-config
    volumeMounts:
    - name: data
      mountPath: /app/data
```

### AWS ECS / Fargate

```bash
# Store secret in Secrets Manager
aws secretsmanager create-secret \
  --name dashboard-auth-secret \
  --secret-string "<your-secret>"
```

```json
{
  "containerDefinitions": [{
    "name": "dashboard",
    "image": "dtsd:latest",
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "DATABASE_PATH", "value": "/app/data/dashboard.db" }
    ],
    "secrets": [{
      "name": "AUTH_SECRET",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:dashboard-auth-secret"
    }]
  }]
}
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `AUTH_SECRET is not set` | Missing env var | Run `npm run generate-secret`, set in `.env.local` or `.env.prod` |
| `AUTH_SECRET must be at least 32 characters` | Secret too short | Generate a new one with `npm run generate-secret` |
| `SQLITE_CANTOPEN` | Data dir not writable | Check volume mount permissions: `chown 1001:1001 ./data` |
| Health check returns 503 | Database unreachable | Check `DATABASE_PATH`, file permissions, volume mount |
| Login page but can't log in | No users exist | Navigate to `/register` (first user becomes superadmin) |
| Database locked | Concurrent access | Stop all instances, delete `.db-shm` and `.db-wal` |
| Config changes not applied | Config cached | Restart the container to reload `server.config.yml` |
| Port 3000 in use | Another process | `lsof -i :3000` then `kill <PID>`, or use `PORT=3001` |

---

## Tips

```bash
# Rebuild after dependency changes
docker compose -f docker/docker-compose.dev.yml build --no-cache

# Open a shell inside the running container
docker exec -it dtsd-dev sh

# View image labels
docker inspect dtsd:latest --format='{{json .Config.Labels}}' | jq

# Check image size
docker images dtsd
```
