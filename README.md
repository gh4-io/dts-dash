# DTS Dashboard

A **local-first** web application for airline line maintenance operations planning and capacity management. Built with Next.js, TypeScript, and modern web technologies.

## Overview

DTS Dashboard (DTSD) provides three core operational views for line maintenance planning:

1. **Flight Board** — Visual timeline (Gantt chart) showing aircraft ground windows and maintenance schedules
2. **Statistics Dashboard** — KPI cards, charts, and operational analytics
3. **Capacity Modeling** — Demand forecasting vs. available capacity for staffing decisions

The application ingests work package data, computes derived metrics (utilization, capacity, demand), and renders interactive visualizations — all running locally with no cloud dependencies.

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

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| Theme | next-themes (dark default) |
| Charts | Recharts + Apache ECharts |
| Icons | Font Awesome 6 + Lucide |
| Tables | TanStack Table |
| State | Zustand |
| Auth | Auth.js (NextAuth v5) |
| Database | SQLite (better-sqlite3) |
| ORM | Drizzle ORM |

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Git

### Quick Start

```bash
git clone <repository-url>
cd dts-dash
npm install
npm run config:init
npm run build
npm start
```

On first launch, the application automatically initializes the database. The first registered user becomes the superadmin.

### Docker Deployment

```bash
docker build -t dtsd .
docker run -p 3000:3000 -v ./data:/app/data --env-file .env dtsd
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment instructions including Docker Compose, PM2, reverse proxy, and environment configuration.

### Database Management

```bash
npm run db:status          # Show database status
npm run db:seed            # Seed database with sample data
npm run db:backup          # Create timestamped backup
npm run db:export          # Export to JSON
npm run db:import          # Import from JSON
npm run db:superuser       # Create superuser
npm run db:reset           # Reset database
npm run db:reset-password  # Reset a user's password
npm run db:migrate         # Run schema migrations
```

## Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── login/                # Authentication
│   ├── register/             # Self-registration
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

data/                         # SQLite database (auto-created)
docs/                         # Operational documentation
scripts/db/                   # Database CLI tools
docker/                       # Docker Compose examples and env templates
```

## Configuration

### Environment Variables

See [docker/.env.example](docker/.env.example) for the complete environment variable reference.

Key variables:
- `AUTH_SECRET` — Session signing secret (required, 32+ chars)
- `BASE_URL` — Application base URL (default: `http://localhost:3000`)
- `DATABASE_PATH` — SQLite database path (default: `data/dashboard.db`)

### System Configuration

Server-side settings are managed via `server.config.yml`. Run `npm run config:init` to generate the default configuration file.

Admin-configurable settings (via the web UI):
- **Customer Colors** — Visual coding for maintenance customers
- **Aircraft Type Mapping** — Normalization rules for aircraft model names
- **User Preferences** — Timezone, theme, pagination per user
- **Invite Codes** — Self-registration access control

## Documentation

- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — Deployment guide (Docker, PM2, systemd, reverse proxy)
- [BACKUP.md](docs/BACKUP.md) — Backup procedures and restore steps
- [MONITORING.md](docs/MONITORING.md) — Health checks, log analysis, incident response

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.
