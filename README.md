# Line Maintenance Operations Dashboard

A **local-first** web application for airline line maintenance operations planning and capacity management. Built with Next.js, TypeScript, and modern web technologies.

## Overview

This dashboard provides three core operational views for line maintenance planning:

1. **Flight Board** — Visual timeline (Gantt chart) showing aircraft ground windows and maintenance schedules
2. **Statistics Dashboard** — KPI cards, charts, and operational analytics
3. **Capacity Modeling** — Demand forecasting vs. available capacity for staffing decisions

The application ingests work package data, computes derived metrics (utilization, capacity, demand), and renders interactive visualizations—all running locally with no cloud dependencies.

## Key Features

- **Local-First Architecture** — Runs entirely on your infrastructure, no external services required
- **Role-Based Access Control** — User, admin, and superadmin roles with granular permissions
- **Real-Time Filtering** — Global filter bar with 7 fields (date range, station, timezone, operator, aircraft, type)
- **Interactive Visualizations** — Apache ECharts Gantt timeline, Recharts analytics, TanStack tables
- **Theme Support** — 11 color presets with light/dark modes
- **Data Import** — JSON file upload, paste-import UI, and API endpoint for automation
- **Admin Console** — Customer management, user administration, analytics, audit logs
- **Responsive Design** — Desktop and mobile-optimized layouts

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15+ (App Router) | TypeScript, SSR, API routes |
| UI Components | shadcn/ui + Radix UI | Accessible, composable components |
| Styling | Tailwind CSS v4 | Utility-first CSS framework |
| Theme | next-themes | Dark default, light available |
| Charts | Recharts + Apache ECharts | Bar, line, donut, Gantt timeline |
| Icons | Font Awesome 6 + Lucide | Self-hosted Font Awesome |
| Tables | TanStack Table | Sortable, filterable data tables |
| State | Zustand | Client-side state management |
| Auth | Auth.js (NextAuth v5) | Credentials provider, DB sessions |
| Database | SQLite (better-sqlite3) | Local database at `data/dashboard.db` |
| ORM | Drizzle ORM | Type-safe schema and migrations |

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dts-dash

# Install dependencies
npm install

# Initialize the database
npm run db:reset
```

### Development

```bash
# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Build for Production

```bash
# Build the application
npm run build

# Start the production server
npm start
```

### Database Management

The project includes CLI tools for database lifecycle management:

```bash
npm run db:reset          # Reset and seed database
npm run db:seed           # Seed database with sample data
npm run db:backup         # Create timestamped backup
npm run db:restore        # Restore from backup
npm run db:export         # Export to JSON
npm run db:list-backups   # List available backups
npm run db:create-admin   # Create admin user
npm run db:nuke           # Delete database (destructive)
npm run db:verify         # Verify database integrity
```

See `scripts/db/` for individual scripts.

## Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── login/                # Authentication
│   ├── account/              # User account settings
│   ├── admin/                # Admin console
│   ├── api/                  # API route handlers
│   ├── flight-board/         # Flight board page
│   ├── dashboard/            # Statistics dashboard
│   └── capacity/             # Capacity modeling page
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── layout/               # Header, sidebar, navigation
│   ├── shared/               # FilterBar, DateTimePicker, etc.
│   ├── flight-board/         # Gantt chart components
│   ├── dashboard/            # KPI cards and charts
│   └── admin/                # Admin console components
├── lib/
│   ├── auth.ts               # Auth.js configuration
│   ├── db/                   # Database schema and queries
│   ├── data/                 # Data transformation logic
│   ├── hooks/                # Zustand stores
│   └── utils/                # Utility functions
├── types/                    # TypeScript type definitions
└── middleware.ts             # Route protection

data/
├── dashboard.db              # SQLite database
├── seed/                     # Seed data (tracked in git)
├── backups/                  # Database backups (gitignored)
└── exports/                  # Data exports (gitignored)

.claude/                      # Project documentation
├── SPECS/                    # Feature specifications
├── UI/                       # UI design patterns
├── DEV/                      # Development standards
└── SKILLS/                   # Workflow documentation
```

## Key Domain Concepts

- **Effective MH** — Manual override > work package MH > default (3.0)
- **Shift Capacity** — Day (8 heads), Swing (6 heads), Night (4 heads)
- **Real Capacity** — Headcount × 6.5 MH per person
- **Utilization** — Total demand MH / real capacity × 100%
- **Work Package** — Maintenance task with ground time, labor hours, and customer assignment

## Authentication

Default credentials for development:

- **Superadmin:** `admin` / `admin123`
- **Admin:** `manager` / `manager123`
- **User:** `viewer` / `viewer123`

Change these in production via the Admin console or `npm run db:create-admin`.

## Configuration

Key settings are stored in the database and configurable via the Admin UI:

- **Customer Colors** — Visual coding for maintenance customers
- **Aircraft Type Mapping** — Normalization rules for aircraft model names
- **User Preferences** — Timezone, theme, pagination per user
- **System Settings** — Allowed hostnames, session duration

## Documentation

Full project documentation is available in `.claude/`:

- [CLAUDE.md](.claude/../CLAUDE.md) — Project overview and session workflow
- [SPECS/](.claude/SPECS/) — Feature specifications
- [ROADMAP.md](.claude/ROADMAP.md) — Development milestones
- [DEV_STANDARDS.md](.claude/DEV/DEV_STANDARDS.md) — Coding conventions
- [TEST_PLAN.md](.claude/DEV/TEST_PLAN.md) — Testing checklist

## Development Workflow

1. Read `CLAUDE.md` and check `.claude/OPEN_ITEMS.md` for current issues
2. Review relevant specs in `.claude/SPECS/` before implementing features
3. Follow conventions in `.claude/DEV/DEV_STANDARDS.md`
4. Verify changes: `npm run lint && npm run build && npm run dev`
5. Update documentation in `.claude/OPEN_ITEMS.md` after changes

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

For questions or issues, contact your project administrator.
