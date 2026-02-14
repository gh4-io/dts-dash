# M0: Next 10 Concrete Steps

**Start here** after reviewing M0_READINESS.md. Each step is independent or has explicit dependencies.

---

## Step 1: Prepare Font Awesome Assets
**Time**: ~5 min
**Files**: `public/vendor/fontawesome/`

```bash
# Navigate to project root
cd /mnt/c/Users/Jason/Documents/Work/dashboard

# Create Font Awesome directory structure
mkdir -p public/vendor/fontawesome

# Copy Font Awesome assets from the downloaded directory
cp Font.Awesome.Pro.v6.5.1-Aetherx/css/ public/vendor/fontawesome/
cp Font.Awesome.Pro.v6.5.1-Aetherx/webfonts/ public/vendor/fontawesome/

# Verify
ls -la public/vendor/fontawesome/
# Expected: css/ and webfonts/ directories present
```

**Acceptance**: FA CSS and webfonts directories exist and are readable.

---

## Step 2: Create Data Directory + Copy Sample Data
**Time**: ~2 min
**Files**: `data/input.json`

```bash
# Create data directory
mkdir -p data

# Copy sample work packages
cp .claude/assets/input.json data/

# Verify
ls -la data/
# Expected: input.json exists, >10KB
```

**Acceptance**: `data/input.json` present and contains 86 work package records.

---

## Step 3: Initialize Next.js 15 Project
**Time**: ~8–10 min
**Dependencies**: None
**Files**: Root-level config, src/, package.json

```bash
# Run create-next-app with exact flags
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git \
  --no-git-check

# Confirm prompts (if any):
# - ESLint: Yes
# - Tailwind: Yes
# - App Router: Yes
```

**Acceptance**:
- `src/`, `public/`, `next.config.js`, `tsconfig.json` created
- `package.json` includes React, Next, Tailwind, ESLint
- No errors during creation

---

## Step 4: Install Core Dependencies
**Time**: ~15–20 min
**Depends on**: Step 3
**Files**: `package.json`, `node_modules/`

```bash
# Core UI + State
npm install zustand next-themes recharts @tanstack/react-table

# Apache ECharts (Flight Board Gantt)
npm install echarts echarts-for-react

# Auth + Database
npm install next-auth@beta drizzle-orm better-sqlite3 bcrypt

# Dev dependencies
npm install -D drizzle-kit @types/better-sqlite3 @types/bcrypt

# Optional but recommended: shadcn/ui CLI (will use later)
npx shadcn-ui@latest init --defaults
```

**Acceptance**:
- All packages appear in `package.json` dependencies/devDependencies
- `npm list` shows no major conflicts
- No build errors (may warn about peer dependencies, OK)

---

## Step 5: Configure Next.js for better-sqlite3 + ECharts
**Time**: ~5 min
**Depends on**: Step 3
**Files**: `next.config.js`

Replace the content of `next.config.js` with:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['echarts', 'zrender'],
  serverComponentsExternalPackages: ['better-sqlite3'],
};

module.exports = nextConfig;
```

**Acceptance**: File saved, no syntax errors.

---

## Step 6: Create TypeScript Interfaces
**Time**: ~15 min
**Depends on**: Step 3
**Files**: `src/types/index.ts` (and split as needed)

Create `src/types/index.ts` with all TypeScript interfaces from [REQ_DataModel.md](SPECS/REQ_DataModel.md).

**Key types to include**:
- `User`, `Session`, `Customer`, `WorkPackage`
- `UserPreferences`, `MHOverride`, `AircraftTypeMapping`
- `FilterState`, `KPI`, `HourlySnapshot`, `CapacitySnapshot`
- `AnalyticsEvent`, `ImportLog`

**Acceptance**:
- File compiles (no TS errors)
- All interfaces documented with JSDoc comments
- Path alias `@/types` works in TypeScript

---

## Step 7: Create Tailwind v4 + Theme CSS
**Time**: ~20 min
**Depends on**: Step 3, Step 5
**Files**: `src/styles/globals.css`

Create `src/styles/globals.css` with:
1. `@import "tailwindcss"` (Tailwind v4 syntax)
2. Base theme tokens (Neutral dark) for `:root` and `.dark`
3. Theme preset overrides (`.theme-ocean`, `.theme-purple`, etc.) for all 11 Fumadocs presets
4. CSS custom properties for accent, background, foreground, etc. (ref: [REQ_Themes.md](SPECS/REQ_Themes.md))

**Acceptance**:
- File is valid CSS (no parse errors)
- Can import in root layout without breaking Tailwind
- Tailwind utilities (`bg-background`, `text-foreground`) work

---

## Step 8: Create Database Schema (Drizzle ORM)
**Time**: ~25 min
**Depends on**: Step 4, Step 6
**Files**: `src/lib/db/schema.ts`, `src/lib/db/client.ts`

### 8a: Create `src/lib/db/client.ts`
```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const db = new Database(process.env.DATABASE_URL || 'data/dashboard.db');
export const drizzleDb = drizzle(db);
```

### 8b: Create `src/lib/db/schema.ts`
Define 9 tables using Drizzle:
1. `users` — User accounts, roles, passwords
2. `sessions` — Auth.js sessions
3. `customers` — Customer names, colors, displayName, sortOrder
4. `user_preferences` — Theme, color mode, accent, timezone, page size
5. `mh_overrides` — Work package ID → manual MH override
6. `aircraft_type_mappings` — Raw type → canonical type mapping
7. `import_log` — Data import history
8. `analytics_events` — Usage event tracking
9. `config` — System configuration (schema version, data import timestamp)

**Acceptance**:
- Schema file compiles without TS errors
- All tables have primary keys and timestamps
- Foreign key relationships are defined

---

## Step 9: Create Auth.js Configuration
**Time**: ~20 min
**Depends on**: Step 4, Step 8
**Files**: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth].ts`

### 9a: Create `src/lib/auth.ts`
Configure Auth.js with:
- Credentials provider (email + password)
- Database session adapter (SQLite, Drizzle)
- bcrypt password hashing
- Session callback to include user role

Reference: [REQ_Auth.md](SPECS/REQ_Auth.md)

### 9b: Create `src/app/api/auth/[...nextauth].ts`
Export the Auth.js handler (route group for `/api/auth/signin`, `/api/auth/callback`, etc.).

**Acceptance**:
- Files compile without errors
- No TypeScript type mismatches
- Auth.js provider correctly configured

---

## Step 10: Create Root Layout + Base Pages
**Time**: ~30 min
**Depends on**: Step 7, Step 9
**Files**: `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/middleware.ts`, base pages

### 10a: Create `src/app/layout.tsx`
- Import globals.css
- Set up `next-themes` ThemeProvider
- Add `suppressHydrationWarning` on `<html>`
- Include Auth.js SessionProvider

### 10b: Create `src/app/login/page.tsx`
Simple login form with email/password fields. POST to `/api/auth/signin`.

### 10c: Create `src/middleware.ts`
Route protection:
- Redirect unauthenticated users to `/login`
- Reject `/admin/*` for non-admin roles

### 10d: Create placeholder pages
- `src/app/page.tsx` (redirect to dashboard if authenticated, else login)
- `src/app/flight-board/page.tsx` ("Coming Soon" placeholder)
- `src/app/dashboard/page.tsx` ("Coming Soon" placeholder)
- `src/app/capacity/page.tsx` ("Coming Soon" placeholder)
- `src/app/settings/page.tsx` ("Coming Soon" placeholder)
- `src/app/account/page.tsx` ("Coming Soon" placeholder)
- `src/app/admin/page.tsx` ("Coming Soon" placeholder, admin-only)

**Acceptance**:
- Root layout compiles
- Pages render without console errors
- Login page submits form

---

## Verification Gates (After Step 10)

Run these commands in order:

```bash
# 1. Lint check
npm run lint
# Expected: Clean (or only warnings about unused vars, OK)

# 2. Build check
npm run build
# Expected: Successful build, output in .next/

# 3. Start dev server
npm run dev
# Expected: Server running at http://localhost:3000

# 4. Manual browser test
# Navigate to http://localhost:3000
# Expected: Redirects to /login
# Enter any email, password
# Expected: Can log in (will create test user on first auth)
# Expected: Redirected to dashboard placeholder
# Expected: Sidebar + header render
# Expected: Theme toggle works
```

---

## Summary

| Step | Task | Time | Files | Status |
|------|------|------|-------|--------|
| 1 | FA Assets | 5 min | `public/vendor/` | ⬜ |
| 2 | Data Directory | 2 min | `data/input.json` | ⬜ |
| 3 | Next.js Init | 8–10 min | Root config | ⬜ |
| 4 | Dependencies | 15–20 min | `package.json` | ⬜ |
| 5 | next.config.js | 5 min | 1 file | ⬜ |
| 6 | TypeScript Types | 15 min | `src/types/` | ⬜ |
| 7 | Tailwind + CSS | 20 min | `src/styles/globals.css` | ⬜ |
| 8 | Database Schema | 25 min | `src/lib/db/` | ⬜ |
| 9 | Auth.js Config | 20 min | `src/lib/auth.ts` + API | ⬜ |
| 10 | Layouts + Pages | 30 min | `src/app/`, `src/middleware.ts` | ⬜ |
| | **Verification** | ~20 min | (npm commands) | ⬜ |
| | **TOTAL M0** | **~3 hours** | **~50 new files** | ⬜ |

---

## If Blocked

1. **better-sqlite3 build fails**: Ensure Python 3.x is in PATH. Try `npm rebuild`.
2. **Tailwind not working**: Verify `@import "tailwindcss"` syntax (v4, not v3). Check `tsconfig.json` content paths.
3. **Auth.js errors**: Ensure `.env.local` has `NEXTAUTH_URL=http://localhost:3000` and `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`).
4. **ECharts SSR error**: Use `dynamic(() => import(...), { ssr: false })` for ECharts components (deferred to M2).
5. **Hydration mismatch**: Add `suppressHydrationWarning` on `<html>`, use `skipHydration` in Zustand stores.

**If still stuck**: Review [OPEN_ITEMS.md](OPEN_ITEMS.md) to see if it's a known issue, or create a new OI entry.

---

## Next: M1 Data Layer

Once M0 passes verification, proceed to [ROADMAP.md](ROADMAP.md) M1 for:
- Work package reader + transformer
- API routes (data endpoints)
- Aircraft type normalization
- Event tracking infrastructure

See [PLAN.md](PLAN.md) M1 section for detailed task breakdown.
