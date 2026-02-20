# Phase 2 — Architecture (Post-Refactor)

**Date:** 2026-02-15

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React 19)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │Flight    │  │Dashboard │  │Capacity  │  │Admin    │ │
│  │Board     │  │(KPI,     │  │(Tables,  │  │(Users,  │ │
│  │(ECharts) │  │Recharts) │  │Charts)   │  │Config)  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐│
│  │         Zustand Stores (filters, customers, prefs)   ││
│  └────┬──────────────┬──────────────┬───────────────────┘│
│       │              │              │                     │
│  ┌────┴──────────────┴──────────────┴────┐               │
│  │    Data-Fetching Hooks (SWR-like)     │               │
│  │    useWorkPackages, useCapacity, etc.  │               │
│  └────┬──────────────────────────────────┘               │
└───────┼──────────────────────────────────────────────────┘
        │ HTTP (JSON)
┌───────┼──────────────────────────────────────────────────┐
│       │          Next.js Server (Node.js)                 │
│  ┌────┴────┐                                              │
│  │proxy.ts │ ← Auth.js JWT verification                   │
│  │(auth    │                                              │
│  │guard)   │                                              │
│  └────┬────┘                                              │
│       │                                                   │
│  ┌────┴─────────────────────────────────────────────┐    │
│  │              API Route Handlers                    │    │
│  │  /api/work-packages  /api/capacity  /api/config   │    │
│  │  /api/admin/*        /api/account/* /api/analytics │    │
│  └────┬───────────────────┬──────────────────────────┘    │
│       │                   │                               │
│  ┌────┴────┐         ┌────┴────┐                          │
│  │ Data    │         │ Drizzle │                          │
│  │ Layer   │         │ ORM     │                          │
│  │         │         │         │                          │
│  │reader.ts│         │schema.ts│                          │
│  │trans-   │         │client.ts│                          │
│  │former.ts│         │         │                          │
│  └────┬────┘         └────┬────┘                          │
│       │                   │                               │
│  ┌────┴────┐         ┌────┴────┐                          │
│  │  data/  │         │  data/  │                          │
│  │input.json│        │dashboard│                          │
│  │(WPs)    │         │.db      │                          │
│  └─────────┘         └─────────┘                          │
└───────────────────────────────────────────────────────────┘
```

## Module Boundaries

| Module | Responsibility | Depends On |
|--------|---------------|------------|
| `src/app/` | Page rendering, API route handlers | lib/, components/ |
| `src/components/ui/` | Primitive UI components (shadcn/ui) | Nothing |
| `src/components/shared/` | Cross-cutting components (FilterBar, DateTimePicker) | ui/, hooks/ |
| `src/components/flight-board/` | ECharts Gantt visualization | shared/, hooks/ |
| `src/components/dashboard/` | KPI cards, Recharts | shared/, hooks/ |
| `src/components/capacity/` | Config panel, utilization chart, table | shared/, hooks/ |
| `src/components/admin/` | Admin CRUD forms and editors | shared/, hooks/ |
| `src/components/account/` | User account management forms | shared/, hooks/ |
| `src/components/layout/` | Header, sidebar, mobile nav, theme | hooks/ |
| `src/lib/auth.ts` | Auth.js config, JWT, credentials provider | db/ |
| `src/lib/data/` | Read JSON, transform WPs, compute engines | db/, types/ |
| `src/lib/db/` | SQLite client, Drizzle schema, seeds | - |
| `src/lib/hooks/` | Zustand stores, data-fetching hooks | - |
| `src/lib/utils/` | Pure functions (date, format, contrast, etc.) | - |
| `src/types/` | TypeScript interfaces | - |

## Data Flow

```
input.json → reader.ts (cache) → transformer.ts (normalize, enrich)
    ↓                                    ↓
SharePointWorkPackage[]           WorkPackage[]
                                        ↓
                              API routes (filter, paginate)
                                        ↓
                              React hooks (store, display)
```

## Auth Flow

```
Login form → POST /api/auth/[...nextauth] → bcryptjs verify
    ↓
JWT issued (contains: id, email, role, displayName)
    ↓
proxy.ts intercepts all requests → validates JWT
    ↓
API routes: auth() → session.user.role check
```

## Key Design Decisions

- **Local-first**: No cloud dependencies. SQLite + JSON file.
- **JWT sessions**: Stateless auth with role in token.
- **Module-level caching**: reader.ts and transformer.ts cache in-process.
- **Zustand for client state**: No SSR state management needed.
- **ECharts for Gantt**: Canvas rendering for large datasets.
- **Recharts for analytics**: Declarative charts via shadcn/ui integration.
