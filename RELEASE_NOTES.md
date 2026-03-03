# v0.2.0 — Universal Import Hub, Capacity Modeling & Mobile UX

**Release date:** 2026-03-02 | **~80 commits since v0.1.1** | **MINOR release** — all changes backwards-compatible

## Highlights

- **Universal Import Hub** — Single schema-driven Data Hub replacing 3 siloed import pipelines. 6-step wizard, 9 pluggable schemas, 3-pass auto-mapping engine, unified import history, export/templates, and contextual help panel.
- **Full Capacity Modeling Suite** — 7-lens analysis (Demand, Capacity, Utilization, Events, Worked Hours, Billed Hours, Concurrency), rolling 8-week forecast, scenario toggle, gap analysis, per-customer attribution, cross-lens comparison, monthly roll-up, contract MH pipeline, staffing-derived shift routing, rotation-based staffing, and demand contracts.
- **Mobile-First UX** — Collapsible sidebar, bottom tab bar, mobile touch targets, Flight Board list view with card stack, PWA manifest.
- **Flight Board Enhancements** — Sticky time axis headers, shift column, responsive view panel, list/Gantt toggle.
- **Print Support** — Optimized print layouts for Dashboard and Flight Board.

---

## Added

### Universal Import Hub
- Single schema-driven Data Hub replacing 3 siloed import pipelines (Customers, Aircraft Types, Data Import)
- 6-Step Import Wizard — Select Type > Load Data > Map Fields > Validate > Confirm > Results
- 9 Pluggable Import Schemas — work-packages, customers, aircraft, aircraft-type-mappings, aircraft-models, manufacturers, engine-types, users, app-config
- 3-Pass Auto-Mapping Engine — exact alias > case-insensitive > fuzzy normalized; manual select dropdowns per field
- Unified Import History — single audit log across all data types with type filtering and pagination
- Export & Templates — export existing data (JSON/CSV) and download example templates per schema type
- Contextual Help Panel — desktop right sidebar / mobile bottom sheet; step-specific guidance and field reference tables
- Schema Registry — `registerSchema()` API; new schemas auto-register by adding a file to `src/lib/import/schemas/`
- Admin Nav Consolidation — 9 items to 7 items; "Data Hub" replaces Customers + Aircraft Types + Data Import
- Backwards-compatible redirects for old admin URLs
- 13 new UI components and 4 new API routes

### Capacity Modeling
- Full Capacity Suite — 3-tier productivity model, demand distribution engine, utilization heatmap, shift drilldown drawer, headcount plans + exceptions, admin settings UI
- Rotation-Based Staffing — rotation pattern library (21-dot visual grid editor, presets), named staffing configurations, custom shift definitions, weekly staffing matrix with full productivity chain + coverage gap warnings
- Demand Contracts — hierarchical model with period types (WEEKLY, MONTHLY, ANNUAL, TOTAL, PER_EVENT), contract priority, sanity check projection
- 7-Lens Analysis UI with daily/weekly pattern aggregation toggle and cross-lens overlay comparison
- Rolling 8-Week Forecast, Scenario Toggle, Gap Analysis, Per-Customer Attribution, Monthly Roll-Up
- Contract MH Pipeline — 4-level MH resolution chain (manual > WP > contract PER_EVENT > default)
- Staffing-Derived Shift Routing — non-operating shifts derived from rotation data
- Flight Events, Worked Hours, Billed Hours, Rate Forecast, Concurrency Pressure engines
- Projection Overlay, By Customer Toggle, Compute Mode Badge, Today Reference Line, Warnings Bell

### Mobile-First UX (Phase 4)
- Collapsible Sidebar — expanded / icon-only / hidden modes with localStorage persistence
- Bottom Tab Bar — fixed bottom navigation for mobile
- Mobile Header Touch Targets — all interactive elements raised to 44px minimum
- Flight Board List View — mobile card stack with lazy pagination + TanStack sortable table for desktop
- PWA Manifest with standalone display and multiple icon sizes
- Responsive admin data grids and capacity charts

### Other Additions
- Flight Board: sticky time axis headers, shift column, responsive view panel, list/Gantt toggle
- Dashboard: NOW time indicator on combined daily chart
- Print support: optimized layouts for Dashboard and Flight Board
- Admin: application/runtime info panel, database backup cron job
- Auth: username field on registration form
- Config: YAML-primary config resolution, unified base URL, server-side facet extraction
- Docker: configurable UID/GID via PUID/PGID

## Changed
- Admin navigation: 9 items to 7 items (Data Hub consolidation)
- Import history moved to unified `unified_import_log`
- Demand model: MH now distributed across ground-time slots, not duplicated per day
- Capacity model defaults: Day = 5.20 MH/person, Night = 4.42 MH/person
- `/capacity` page layout redesigned — 2-column grid; summary chart; 3 pie charts replacing sunburst
- `operatingDays` field removed from `CapacityShift` — scheduling now derived from rotation data

## Removed
- `demand_allocations` API endpoint — use `demand_contracts` (see Migration Notes)
- Static `operating_days` column from `capacity_shifts`

## Fixed
- Import Hub: 6-bug fix pass post-launch + follow-up code review fix pass
- System user protection: cannot be deleted or demoted via Admin UI
- Self-service profile editing now permitted; user form fields correctly pre-populated
- Dashboard Aircraft & Turns card date range mismatch with global FilterBar
- Flight board chart colors reset to defaults on rapid customer color updates
- Capacity "below minimum" false warnings on non-operating shifts
- Flight board ECharts chart not updating on theme switch
- Flight board sticky header layout misalignment and time axis offset
- Hydration mismatches across multiple components
- Capacity zero-capacity bug and false coverage gap positives for overnight shifts
- Docker: prod image reduced from 1.77 GB to 355 MB (80% reduction)

## Security
- Role-based access control enforced on all import and capacity admin endpoints
- Confirmed records protected from overwrite by re-import
- Superadmin role blocked from bulk user creation via import
- Idempotency key support on import commits

## Migration Notes (v0.1.x -> v0.2.0)
- **`demand_allocations` endpoint removed** — migrate to `demand_contracts` API
- **Database auto-migrates** — `instrumentation.ts` applies all migrations on startup. No manual steps needed.
- **Old import URLs redirect** — `/admin/customers` and `/admin/aircraft-types` redirect to Data Hub equivalents automatically.
