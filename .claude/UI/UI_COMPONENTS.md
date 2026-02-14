# UI Components Inventory

## shadcn/ui Components (installed via `npx shadcn@latest add`)

| Component | Used In | Notes |
|-----------|---------|-------|
| `button` | Everywhere | Primary, secondary, ghost, destructive variants |
| `card` | Dashboard KPIs, settings sections | Dark card with `bg-card` |
| `badge` | Station "CVG" lock, status badges | Secondary variant for locked state |
| `select` | Timezone dropdown, settings | Single-select with options |
| `table` | Capacity detail, settings shifts | Via TanStack Table wrapper |
| `tabs` | Dashboard views (if needed) | |
| `tooltip` | Icon hints, non-chart hover cards | ECharts has its own tooltip for Gantt |
| `dropdown-menu` | Sidebar actions, overflow menus | |
| `sheet` | Mobile navigation, mobile filters | Slide-in panel |
| `dialog` | Confirmations, data import | Modal overlay |
| `switch` | WP MH include/exclude toggle | |
| `slider` | Default MH, capacity per person | Range 0.5–10.0 |
| `chart` | All Recharts charts (wrapper) | Area, bar, line, pie/donut |
| `popover` | DateTime picker, multi-select | Container for floating panels |
| `command` | Searchable multi-select options | With search input |
| `calendar` | Date portion of datetime picker | |

## Custom Components

| Component | File | Purpose |
|-----------|------|---------|
| `FilterBar` | `src/components/shared/filter-bar.tsx` | Global filter bar |
| `DateTimePicker` | `src/components/shared/datetime-picker.tsx` | Date + time input |
| `MultiSelect` | `src/components/shared/multi-select.tsx` | Searchable multi-check |
| `FaIcon` | `src/components/shared/fa-icon.tsx` | Font Awesome helper |
| `CustomerBadge` | `src/components/shared/customer-badge.tsx` | Colored dot + name |
| `LoadingSkeleton` | `src/components/shared/loading-skeleton.tsx` | Skeleton cards/charts |
| `EmptyState` | `src/components/shared/empty-state.tsx` | No-data display |
| `Sidebar` | `src/components/layout/sidebar.tsx` | Navigation sidebar |
| `Header` | `src/components/layout/header.tsx` | Top bar |
| `MobileNav` | `src/components/layout/mobile-nav.tsx` | Sheet-based nav |
| `ThemeToggle` | `src/components/layout/theme-toggle.tsx` | Dark/light switch |

## Flight Board Components
See [REQ_FlightBoard.md](../SPECS/REQ_FlightBoard.md) → Components section.

## Dashboard Components
See [REQ_OtherPages.md](../SPECS/REQ_OtherPages.md) → Dashboard section.

## Auth & Account Components

| Component | File | Purpose |
|-----------|------|---------|
| `UserMenu` | `src/components/layout/user-menu.tsx` | Header dropdown (Account/Admin/Logout) |
| `LoginForm` | `src/app/login/page.tsx` | Email + password login |
| `ProfileForm` | `src/components/account/profile-form.tsx` | Display name editing |
| `PreferencesForm` | `src/components/account/preferences-form.tsx` | Theme, timezone, display prefs |
| `SecurityPanel` | `src/components/account/security-panel.tsx` | Password change + vNext stubs |
| `ChangePasswordForm` | `src/components/account/change-password-form.tsx` | Current + new password |

## Admin Components

| Component | File | Purpose |
|-----------|------|---------|
| `CustomerColorEditor` | `src/components/admin/customer-color-editor.tsx` | Color picker + hex input per customer |
| `AircraftTypeEditor` | `src/components/admin/aircraft-type-editor.tsx` | Mapping rule table + test input (D-015) |
| `DataImport` | `src/components/admin/data-import.tsx` | File upload, paste JSON, preview, commit (D-016) |
| `UserTable` | `src/components/admin/user-table.tsx` | User list with actions |
| `UserForm` | `src/components/admin/user-form.tsx` | Create/edit user dialog |
