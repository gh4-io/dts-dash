# Environment Setup Guide

Complete guide for configuring environment variables in all deployment scenarios.

## 📁 Available Environment Files

| File | Purpose | Usage |
|------|---------|-------|
| `dev.env.local` | **Ready-to-use development config** | Copy to `.env.local` for instant dev setup |
| `.env.example` | **Template with documentation** | Reference for all available ENV vars |
| `prod.env.example` | **Production template** | Template for production deployments |

---

## 🚀 Quick Start (Development)

### Option 1: Use Ready-Made Dev Config (Fastest)

```bash
# 1. Copy the pre-configured dev environment
cp dev.env.local .env.local

# 2. Initialize database with seed data
npm run db:reset -- --seed

# 3. Start dev server
npm run dev

# 4. Login
# URL: http://localhost:3000/login
# User: admin@local
# Pass: admin123
```

**Done!** The `dev.env.local` file has everything pre-configured with safe dev defaults.

### Option 2: Manual Setup (Custom Configuration)

```bash
# 1. Copy example file
cp .env.example .env.local

# 2. Generate AUTH_SECRET
npm run generate-secret
# Copy the output

# 3. Edit .env.local and paste the secret
nano .env.local  # or your preferred editor

# 4. Set initial admin (optional)
INITIAL_ADMIN_EMAIL=admin@local
INITIAL_ADMIN_PASSWORD=admin123

# 5. Initialize database
npm run db:reset -- --seed

# 6. Start dev server
npm run dev
```

---

## 🔐 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_SECRET` | JWT signing secret (32+ chars) | `npm run generate-secret` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | SQLite database file path | `./data/dashboard.db` |
| `INITIAL_ADMIN_EMAIL` | First admin email (seed only) | *(none)* |
| `INITIAL_ADMIN_PASSWORD` | First admin password (seed only) | *(none)* |
| `NODE_ENV` | Environment mode | `development` |
| `ENABLE_SEED_ENDPOINT` | Enable `/api/seed` | `false` |
| `LOG_LEVEL` | Logging verbosity | `debug` (dev), `info` (prod) |
| `SENTRY_DSN` | Error tracking DSN | *(none)* |

---

## 🏭 Production Deployment

### 1. Bare Metal / VM

```bash
# 1. Copy production template
cp prod.env.example .env.production

# 2. Generate unique secret
npm run generate-secret

# 3. Edit .env.production
nano .env.production
# Set AUTH_SECRET, DATABASE_PATH, LOG_LEVEL

# 4. Build application
npm run build

# 5. Initialize database (first-run only)
npm run db:migrate
# Then visit /setup to create first admin

# 6. Start server
npm start
```

**Production ENV example:**
```bash
AUTH_SECRET=<generate-fresh-secret>
DATABASE_PATH=/var/lib/dashboard/dashboard.db
NODE_ENV=production
LOG_LEVEL=info
ENABLE_SEED_ENDPOINT=false
```

### 2. Docker / Docker Compose

**Create `.env.local` for docker-compose:**

```bash
# .env.local (for docker-compose.yml)
AUTH_SECRET=<generate-fresh-secret>
DATABASE_PATH=/app/data/dashboard.db
NODE_ENV=production
LOG_LEVEL=info
```

**Deploy:**

```bash
# 1. Generate secret
npm run generate-secret > secret.txt

# 2. Create .env.local with values above

# 3. Start container
docker compose up -d

# 4. Visit /setup to create first admin
# http://localhost:3000/setup

# 5. Check health
curl http://localhost:3000/api/health
```

**Docker volume structure:**
```
./data/          → /app/data/       (database + backups)
./logs/          → /app/logs/       (application logs)
.env.local       → env_file         (secrets)
```

### 3. Kubernetes

**Create Secret:**

```bash
# Generate secret
AUTH_SECRET=$(npm run generate-secret --silent)

# Create k8s secret
kubectl create secret generic dashboard-secrets \
  --from-literal=AUTH_SECRET="$AUTH_SECRET"
```

**ConfigMap:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  DATABASE_PATH: "/app/data/dashboard.db"
  ENABLE_SEED_ENDPOINT: "false"
```

**Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dashboard
spec:
  template:
    spec:
      containers:
      - name: dashboard
        image: cvg-dashboard:latest
        env:
        - name: AUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: dashboard-secrets
              key: AUTH_SECRET
        envFrom:
        - configMapRef:
            name: dashboard-config
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: dashboard-pvc
```

### 4. AWS ECS / Fargate

**Store secret in AWS Secrets Manager:**

```bash
# Generate and store secret
SECRET=$(npm run generate-secret --silent)
aws secretsmanager create-secret \
  --name dashboard-auth-secret \
  --secret-string "$SECRET"
```

**Task Definition:**

```json
{
  "containerDefinitions": [{
    "name": "dashboard",
    "image": "your-registry/cvg-dashboard:latest",
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "LOG_LEVEL", "value": "info" },
      { "name": "DATABASE_PATH", "value": "/app/data/dashboard.db" }
    ],
    "secrets": [{
      "name": "AUTH_SECRET",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:123456:secret:dashboard-auth-secret"
    }],
    "mountPoints": [{
      "sourceVolume": "data",
      "containerPath": "/app/data"
    }]
  }],
  "volumes": [{
    "name": "data",
    "efsVolumeConfiguration": {
      "fileSystemId": "fs-12345678"
    }
  }]
}
```

---

## 🔒 Security Best Practices

### ✅ DO

- **Generate unique secrets** for each environment
- **Use secret managers** (AWS Secrets, Azure Key Vault, HashiCorp Vault)
- **Rotate secrets** periodically (quarterly)
- **Set strong admin passwords** (change default after first login)
- **Disable seed endpoint** in production (`ENABLE_SEED_ENDPOINT=false`)
- **Use environment variables** for all config (never hardcode)
- **Limit log verbosity** in production (`LOG_LEVEL=info`)
- **Enable error tracking** (Sentry) in production

### ❌ DON'T

- **Never commit** `.env.local` or `.env.production` to git
- **Never use dev secrets** in production
- **Never hardcode** secrets in code or Dockerfiles
- **Never set** `INITIAL_ADMIN_*` in production ENV
- **Never enable** `ENABLE_SEED_ENDPOINT` in production without auth
- **Never use** `LOG_LEVEL=debug` in production (performance impact)
- **Never share** secrets in Slack, email, or docs

---

## 🧪 Testing Environment Configuration

### Verify ENV is loaded correctly:

```bash
# Start dev server
npm run dev

# In another terminal, test health endpoint
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-16T..."}
```

### Test database connection:

```bash
# Check database status
npm run db:status

# Expected output:
# ✓ Database file exists
# ✓ Tables: 14/14
# ✓ File size: XX KB
```

### Test authentication:

```bash
# Test login via API
curl -X POST http://localhost:3000/api/auth/signin/credentials \
  -H "Content-Type: application/json" \
  -d '{"login":"admin@local","password":"admin123"}'

# Should return: session cookie
```

---

## 🐛 Troubleshooting

### Issue: "AUTH_SECRET is not set"

**Cause:** Missing or empty `AUTH_SECRET` in `.env.local`

**Fix:**
```bash
# Generate secret
npm run generate-secret

# Add to .env.local
echo "AUTH_SECRET=<paste-output-here>" >> .env.local

# Restart server
npm run dev
```

### Issue: "AUTH_SECRET must be at least 32 characters"

**Cause:** Secret is too short

**Fix:**
```bash
# Generate new secret (48 chars)
npm run generate-secret

# Replace in .env.local
```

### Issue: Database file not found

**Cause:** `DATABASE_PATH` points to non-existent location

**Fix:**
```bash
# Use default path
# Remove DATABASE_PATH from .env.local (or set to ./data/dashboard.db)

# Recreate database
npm run db:reset -- --seed
```

### Issue: Cannot login after DB reset

**Cause:** Browser cookies still have old session

**Fix:**
```bash
# Option 1: Clear browser cookies
# Chrome: DevTools → Application → Cookies → Delete

# Option 2: Use incognito/private mode

# Option 3: Clear all sessions
npm run db:reset -- --seed
```

### Issue: Port 3000 already in use

**Cause:** Another process is using port 3000

**Fix:**
```bash
# Find process
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

---

## 📚 Additional Resources

- **Full ENV reference:** `.env.example`
- **Development setup:** `dev.env.local`
- **Production setup:** `prod.env.example`
- **Database tools:** `npm run db:status`, `npm run db:backup`
- **Deployment guides:** `DEPLOYMENT.md`
- **Backup strategy:** `BACKUP.md`

---

## 🔄 Updating Environment

### Adding new variables:

1. Add to `.env.example` with documentation
2. Add to `dev.env.local` with safe default
3. Add to `prod.env.example` with production example
4. Update this guide (`ENV_SETUP_GUIDE.md`)
5. Update code to read `process.env.NEW_VAR`

### Rotating secrets:

```bash
# 1. Generate new secret
npm run generate-secret

# 2. Update .env.local with new value

# 3. Restart server (triggers re-sign of all JWTs)
npm run dev

# 4. All users must re-login (sessions invalidated)
```

---

**Last updated:** 2026-02-16
**Project:** CVG Line Maintenance Operations Dashboard
**Version:** v0.1.0
