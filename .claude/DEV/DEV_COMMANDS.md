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
