# Project Context

## What
A **local-first** Next.js web application for CVG (Cincinnati/Northern Kentucky Airport) line maintenance operations.

## Who
- **Users**: Line maintenance supervisors and planners at CVG
- **Operator**: Kalitta Air (and subcontracted customers)
- **Environment**: Desktop (primary) + mobile (secondary); used on hangar floor and office

## Three Core Views
1. **Flight Board** (`/flight-board`) — Gantt-style timeline of aircraft on-ground windows
2. **Statistics Dashboard** (`/dashboard`) — KPI cards, charts, operational analytics
3. **Capacity Modeling** (`/capacity`) — Demand vs. capacity analysis for staffing

Plus a **Settings** page (`/settings`) for configuration.

## Data Flow
```
SharePoint OData API → JSON export → data/input.json → Transform → API routes → Client
```
No live connection to SharePoint for v0. Data is imported as a static JSON file.

## Customers Served at CVG
| Customer | Aircraft Count | Color |
|----------|---------------|-------|
| CargoJet Airways | 24 | #22c55e (green) |
| Aerologic | 18 | #8b5cf6 (purple) |
| Kalitta Air | 16 | #f97316 (orange) |
| DHL Air UK | 16 | #ef4444 (red) |
| Kalitta Charters II | 8 | #06b6d4 (cyan) |
| 21 Air | 4 | #ec4899 (pink) |

## Tech Stack
See `/CLAUDE.md` → "Confirmed Tech Stack" for the full table. Key choices:
- Next.js 15+ (App Router, TypeScript)
- shadcn/ui + Tailwind CSS v4 (neutral dark theme)
- Recharts (dashboard charts), Apache ECharts (flight board Gantt)
- Font Awesome (self-hosted) + Lucide (supplementary)
- Zustand (state), file-based JSON (data)

## Reference Material
- Design screenshots: `.claude/assets/img/`
- Sample data: `.claude/assets/input.json` (86 records, 318KB)
- CargoJet HAR captures: `.claude/*.har`
- Implementation plan: `/plan/FINAL-PLAN.md` (1625 lines)
