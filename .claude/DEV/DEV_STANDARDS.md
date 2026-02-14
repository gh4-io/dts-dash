# Development Standards

## Language & Framework

- TypeScript strict mode (`"strict": true` in tsconfig)
- Next.js 15+ App Router — all pages under `src/app/`
- React Server Components where possible; `"use client"` only when needed (interactivity, hooks, browser APIs)

## File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | kebab-case | `filter-bar.tsx`, `kpi-card.tsx` |
| Hooks | `use-` prefix, kebab-case | `use-filters.ts` |
| Utils | kebab-case | `date-helpers.ts` |
| Types | kebab-case | `work-package.ts` |
| API routes | `route.ts` inside folder | `app/api/work-packages/route.ts` |
| Pages | `page.tsx` inside folder | `app/flight-board/page.tsx` |
| Layouts | `layout.tsx` | `app/layout.tsx` |

## Component Patterns

### Exports
- Named exports for components (not default export)
- One primary component per file
- Sub-components can share a file if tightly coupled

### Props
- Use TypeScript interfaces, not `type` aliases for props
- Destructure props in function signature
- Prefix interface with component name: `FilterBarProps`, `KpiCardProps`

### File Structure (per component)
```tsx
// Imports
import { ... } from "...";

// Types
interface MyComponentProps { ... }

// Component
export function MyComponent({ prop1, prop2 }: MyComponentProps) {
  // hooks first
  // derived state
  // handlers
  // render
}
```

## Styling

- **Tailwind CSS v4** — use `@import "tailwindcss"` in globals.css
- **shadcn/ui `cn()` utility** for conditional classes
- No inline styles; no CSS modules
- Dark-first: design for dark theme, ensure light theme works
- Color tokens via CSS custom properties (see Appendix B in FINAL-PLAN.md)

## State Management

- **Zustand** for all client-side state
- Separate stores by concern (filters, config, workPackages, capacity)
- `skipHydration: true` to avoid SSR mismatch
- Fetch data via `useEffect` in client components

## Data Flow

```
User action → Zustand store update → URL sync → API fetch → Store update → UI re-render
```

- API routes are the only place that reads from the filesystem
- Client never reads files directly
- All data transformations happen server-side in API routes

## Error Handling

- Error boundaries per page (wrap each page in `error.tsx`)
- API routes return `{ error: string }` with appropriate HTTP status
- Console.error for all caught exceptions
- No external error reporting for v0

## Import Order

1. React / Next.js
2. Third-party libraries
3. Internal components (`@/components/`)
4. Internal hooks (`@/lib/hooks/`)
5. Internal utils (`@/lib/utils/`)
6. Types (`@/types/`)
7. Relative imports

## Git

- Small, focused commits
- Keep the app runnable after every commit
- No secrets in repo (no `.env` with real credentials)
