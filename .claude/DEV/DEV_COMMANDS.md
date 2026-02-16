# Development Commands

## Project Setup

```bash
# Initialize Next.js 15 project
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# shadcn/ui init
npx shadcn@latest init

# shadcn/ui components (install as needed)
npx shadcn@latest add button card badge select table tabs tooltip dropdown-menu sheet dialog switch slider chart popover command calendar
```

## Dependencies

```bash
# Core UI + State
npm install zustand next-themes recharts @tanstack/react-table

# Apache ECharts (Flight Board Gantt)
npm install echarts echarts-for-react

# Auth + Database
npm install next-auth@beta drizzle-orm better-sqlite3 bcrypt
npm install -D drizzle-kit @types/better-sqlite3 @types/bcrypt @types/node
```

## Daily Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build — must pass |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint check — must be clean |

## Database Management

All `db:*` scripts are TypeScript, run via `npx tsx`, and share a common CLI UX via `scripts/db/_cli-utils.ts`. Seed data is loaded from JSON files in `data/seed/`.

| Command | Purpose | Destructive? |
|---------|---------|:------------:|
| `npm run db:seed` | Seed database from `data/seed/*.json` (idempotent) | No |
| `npm run db:migrate` | Run table creation + migrations (idempotent) | No |
| `npm run db:status` | Show table row counts, file sizes, last import | No |
| `npm run db:backup` | Snapshot `dashboard.db` + `input.json` to timestamped backup | No |
| `npm run db:export` | Export all tables as JSON to `data/exports/{timestamp}/` | No |
| `npm run db:reset-password` | Reset superadmin password (dev=`admin123`, prod/`--random`=random) | No |
| `npm run db:event-reset` | Clear `input.json` event data, preserve SQLite | Yes |
| `npm run db:analytics-clear` | Delete all analytics_events rows | Yes |
| `npm run db:reset` | Delete DB + re-seed from scratch (full factory reset) | Yes |

### Seed Data Architecture

Seed data lives in external JSON files (tracked in git):

```
data/seed/
  users.json                  # Default users (passwords hashed at seed time)
  customers.json              # Customer names, colors, sort order
  aircraft-type-mappings.json # Pattern → canonical type (24 mappings)
  aircraft-models.json        # Aircraft model codes + display names
  manufacturers.json          # Airframe manufacturers
  engine-types.json           # Engine type reference data
  app-config.json             # Default app configuration key-values
```

`src/lib/db/seed-data.ts` loads these via `fs.readFileSync` and exports typed constants. Edit the JSON files to change defaults — no TypeScript changes needed.

### Key Details

- **db:seed** — safe to run multiple times; skips tables that already have data
- **db:reset** — requires interactive confirmation; spawns fresh process after deleting DB
- **db:reset-password** — detects `NODE_ENV=production` or `--random` flag for random password; dev mode defaults to `admin123`
- **db:backup** — runs `PRAGMA wal_checkpoint(TRUNCATE)` first for consistent snapshot
- **db:export** — warns about password hashes in `users.json` export
- **db:event-reset** — see [REQ_DataReset.md](../SPECS/REQ_DataReset.md) for Admin UI reset button docs
- Destructive scripts require interactive `y/N` confirmation (or `--yes`/`-y` for CI)

## Verification Checklist

After any significant change:

1. `npm run build` — no errors
2. `npm run lint` — no warnings/errors
3. `npm run dev` — all pages render, no console errors
4. Manual check: filters work, data loads, charts render

## Font Awesome Setup

```bash
# Copy FA assets to public directory (user provides the download)
mkdir -p public/vendor/fontawesome
# Copy css/ and webfonts/ from FA download into public/vendor/fontawesome/
```

## Data Setup

```bash
# Copy sample data for development
cp .claude/assets/input.json data/input.json
```

## M0 Initialization Checklist (Project Bootstrap)

Before starting M0 implementation:

1. **Extract Font Awesome assets** (already downloaded to `Font.Awesome.Pro.v6.5.1-Aetherx/`)
   ```bash
   mkdir -p public/vendor/fontawesome
   cp Font.Awesome.Pro.v6.5.1-Aetherx/css/ public/vendor/fontawesome/
   cp Font.Awesome.Pro.v6.5.1-Aetherx/webfonts/ public/vendor/fontawesome/
   ```

2. **Create data directory**
   ```bash
   mkdir -p data
   cp .claude/assets/input.json data/
   ```

3. **Run create-next-app**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   ```

4. **Install all core dependencies** (see Dependencies section above)

5. **Configure `next.config.js`**
   ```javascript
   const nextConfig = {
     transpilePackages: ['echarts', 'zrender'],
     serverComponentsExternalPackages: ['better-sqlite3'],
   };
   module.exports = nextConfig;
   ```

6. **Initialize Drizzle** (M0 Task 0.5)
   ```bash
   npx drizzle-kit studio
   ```

7. **Run verification**
   ```bash
   npm run build && npm run lint && npm run dev
   ```

## Git Setup

```bash
# Initialize repo (if not already done)
git init

# Set user identity
git config user.name "Jason"
git config user.email "admin@gh4.io"

# Create and switch to dev branch
git checkout -b dev

# Initial commit (after all docs are in place)
git add -A
git commit -m "$(cat <<'EOF'
chore: Initial project setup with Project Steward skill

Scaffold, docs, skills, and scripts for CVG Line Maintenance Dashboard.

Docs: CLAUDE.md, .claude/README.md, .claude/SKILLS/PROJECT_STEWARD.md, .claude/SKILLS/AUTO_COMMIT_POLICY.md
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

## Project Steward Scripts

```bash
# Phase commit — guided commit with verification gates and doc-touch checks
chmod +x scripts/phase_commit.sh
./scripts/phase_commit.sh

# Feature intake — create new OI entry + optional stub spec
chmod +x scripts/feature_intake.sh
./scripts/feature_intake.sh
```

Both scripts are POSIX-compatible (bash). No external tooling beyond git + node/npm required.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Hydration mismatch | Add `suppressHydrationWarning` on `<html>`, use `skipHydration` in Zustand |
| FA icons not showing | Check path `/vendor/fontawesome/css/all.min.css` is accessible in browser |
| Tailwind classes not applying | Ensure `@import "tailwindcss"` syntax (v4), check content paths |
| Port 3000 in use | `npm run dev -- -p 3001` |
| ECharts SSR error | Use `dynamic(() => import(...), { ssr: false })` for ECharts component |
| ECharts transpile error | Add `transpilePackages: ['echarts', 'zrender']` to `next.config.js` |
| better-sqlite3 build fails | Ensure Node version matches your Python version; run `npm run build` to test |
