# REQ: Admin Section

> Route: `/admin` — accessible only to users with `admin` or `superadmin` role.
> Server-enforced via middleware + API role checks.

## Navigation

Admin section uses its own sub-navigation (tabs or sidebar):

| Tab | Route | Description |
|-----|-------|-------------|
| Customer Colors | `/admin/customers` | Color management |
| Aircraft Types | `/admin/aircraft-types` | Type normalization rules (D-015) |
| Data Import | `/admin/import` | File upload + paste-JSON (D-016) |
| User Management | `/admin/users` | Create, edit, enable/disable, delete users (D-021) |
| System Settings | `/admin/settings` | App-wide configuration |
| Analytics | `/admin/analytics` | System usage analytics (D-019) |
| Audit Log | `/admin/audit` | Change history (vNext stub) |

## Customer Colors (`/admin/customers`)

### Purpose
Centrally manage customer color coding used throughout the entire UI.

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ Customer Colors                          [Reset Defaults] │
├──────────────────────────────────────────────────────────┤
│ ┌──────┐ CargoJet Airways  #22c55e [color] ✓ [✎][🗑]     │
│ │██████│                                                  │
│ └──────┘                                                  │
│ ┌──────┐ Aerologic         #8b5cf6 [color] ✓ [✎][🗑]     │
│ │██████│                                                  │
│ └──────┘                                                  │
│ ... (all 6 customers)                                     │
├──────────────────────────────────────────────────────────┤
│ [+ Add Customer]                         [Save Changes]   │
└──────────────────────────────────────────────────────────┘
```

### Customer Entity

```typescript
interface Customer {
  id: string;                  // UUID, stable key
  name: string;                // "CargoJet Airways"
  displayName: string;         // "CargoJet" (short form for charts/legends)
  color: string;               // Hex, e.g. "#22c55e"
  colorText: string;           // Hex for text on top of color, e.g. "#ffffff"
  isActive: boolean;           // Soft-delete capability
  sortOrder: number;           // Display ordering
  createdAt: Date;
  updatedAt: Date;
}
```

### Behavior
- **Color picker**: shadcn/ui Popover with a color grid + hex text input
- **Contrast auto-calc**: When color changes, automatically compute `colorText` (white or black) using WCAG relative luminance formula
- **Validation**: Must be valid 6-digit hex (with `#`). Reject duplicates.
- **Save**: `PUT /api/admin/customers` — persists to SQLite `customers` table
- **Reset Defaults**: Restores the 6 original customer colors from seed data
- **Add Customer**: Only if new customer appears in imported data. Name must match `Customer` field in work packages.
- **Propagation**: After save, invalidate client-side customer cache → all views re-render with new colors

### Default Customers (Seed Data)

| Name | Display Name | Color | Text Color |
|------|-------------|-------|------------|
| CargoJet Airways | CargoJet | #22c55e | #ffffff |
| Aerologic | Aerologic | #8b5cf6 | #ffffff |
| Kalitta Air | Kalitta Air | #f97316 | #ffffff |
| DHL Air UK | DHL Air UK | #ef4444 | #ffffff |
| Kalitta Charters II | Kalitta Chrt II | #06b6d4 | #ffffff |
| 21 Air | 21 Air | #ec4899 | #ffffff |

### Contrast Calculation

```typescript
function getContrastText(hexColor: string): "#ffffff" | "#000000" {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}
```

### API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/admin/customers` | List all customers with colors |
| `PUT` | `/api/admin/customers` | Bulk update customer colors |
| `POST` | `/api/admin/customers` | Add new customer |
| `PATCH` | `/api/admin/customers/:id` | Update single customer (name, displayName, color) |
| `DELETE` | `/api/admin/customers/:id` | Soft-delete (set isActive=false) |

### Client-Side Integration

Replace the hardcoded `CUSTOMER_COLORS` constant with a Zustand store:

```typescript
// src/lib/hooks/use-customers.ts
interface CustomerStore {
  customers: Customer[];
  colorMap: Record<string, { bg: string; text: string; label: string }>;
  fetchCustomers: () => Promise<void>;
  getColor: (customerName: string) => string;
}
```

All components that reference customer colors use `useCustomers().getColor(name)` instead of the constant.

---

## User Management (`/admin/users`)

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ Users                                     [+ Create User] │
├──────────────────────────────────────────────────────────┤
│ Name          │ Email           │ Role    │ Status │ Actions│
│ Admin         │ admin@cvg.local │ Super   │ Active │ [Edit] │
│ CVG User      │ user@cvg.local  │ User    │ Active │ [Edit] │
│ ...           │                 │         │        │        │
└──────────────────────────────────────────────────────────┘
```

### Features (v1) — D-021: Comprehensive User Management
- List all users with name, email, role, status, last active
- Create new user (email, display name, role, temporary password)
- Edit user (display name, role, active status)
- Assign roles: `user`, `admin`, `superadmin` — including creation of additional super users
- Reset user password (generates temporary password, force change on next login)
- Enable / disable user (toggle active status, revokes sessions on disable)
- Soft-delete user (preserves audit trail, revokes all sessions)
- Session revocation per user (admin can force sign-out)

### Features (vNext — stubs)
- Bulk import users from CSV
- Per-user feature flags / auth requirement overrides
- Login history / detailed activity log
- Password policy configuration (min length, complexity, expiry)
- Account lockout after failed attempts

---

## Aircraft Type Mapping (`/admin/aircraft-types`)

> **Standalone spec**: See [REQ_AircraftTypes.md](REQ_AircraftTypes.md) for full data model, seed data, normalization service, and integration points. This section provides the admin UI layout and API summary.

### Purpose
Admin-editable normalization rules for aircraft types. Maps raw/non-standard type strings from inbound data to canonical types (D-015).

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ Aircraft Type Mapping                    [+ Add Rule]      │
├──────────────────────────────────────────────────────────┤
│ Pattern       │ Canonical │ Description        │ Actions   │
│ 747*          │ B747      │ All 747 variants   │ [Edit][×] │
│ 747-4R7F      │ B747      │ Freighter variant  │ [Edit][×] │
│ 767*          │ B767      │ All 767 variants   │ [Edit][×] │
│ 757*          │ B757      │ All 757 variants   │ [Edit][×] │
│ 777*          │ B777      │ All 777 variants   │ [Edit][×] │
│ 737*          │ B737      │ All 737 variants   │ [Edit][×] │
│ ...                                                        │
├──────────────────────────────────────────────────────────┤
│ Test: [input field] → Result: B747 (pattern, 95%)          │
│                                          [Reset Defaults]  │
└──────────────────────────────────────────────────────────┘
```

### Behavior
- **Pattern**: Glob-style or regex. Matched case-insensitively against raw aircraft type field
- **Priority**: Higher rows match first. Specific patterns (e.g., `747-4R7F`) should be above broad patterns (`747*`)
- **Test input**: Real-time test field — type a raw string, see which rule matches and the canonical result
- **Seed data**: Pre-populated with default rules covering known variants from sample data
- **Reset Defaults**: Restores seed mapping rules
- **Canonical types**: `B777`, `B767`, `B747`, `B757`, `B737` (dropdown select). `Unknown` assigned when no rule matches.

### API Routes
| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/admin/aircraft-types` | List all mapping rules |
| `PUT` | `/api/admin/aircraft-types` | Bulk update rules |
| `POST` | `/api/admin/aircraft-types` | Add new rule |
| `DELETE` | `/api/admin/aircraft-types/:id` | Remove rule |
| `POST` | `/api/admin/aircraft-types/test` | Test a raw string against rules |

---

## Data Import (`/admin/import`)

> **Standalone spec**: See [REQ_DataImport.md](REQ_DataImport.md) for full validation flow, data model, vNext Power Automate details, and file list. This section provides the admin UI layout and API summary.

### Purpose
Admin-only data ingestion page. MVP supports file upload and paste-JSON (D-016).

### Layout
```
┌──────────────────────────────────────────────────────────┐
│ Data Import                                                │
├──────────────────────────────────────────────────────────┤
│ TABS: [File Upload] [Paste JSON]                           │
├──────────────────────────────────────────────────────────┤
│ [File Upload tab]:                                         │
│   Drag & drop or click to select JSON file                 │
│   Accepted: .json (OData format)                           │
│                                                            │
│ [Paste JSON tab]:                                          │
│   ┌──────────────────────────────────────────────┐        │
│   │ (textarea — paste JSON here)                  │        │
│   └──────────────────────────────────────────────┘        │
│   [Validate & Preview]                                     │
├──────────────────────────────────────────────────────────┤
│ PREVIEW (after validation):                                │
│   ✓ 86 records parsed                                      │
│   ✓ 6 customers, 57 aircraft                               │
│   ✓ Date range: Feb 7–23, 2026                             │
│   ⚠ 66 records missing TotalMH (will use default 3.0)     │
│   ⚠ 3 unknown aircraft types (will map to "Unknown")       │
│                                                [Import]    │
├──────────────────────────────────────────────────────────┤
│ IMPORT HISTORY:                                            │
│   2026-02-13 14:30 — 86 records, admin@cvg.local           │
│   ...                                                      │
└──────────────────────────────────────────────────────────┘
```

### Validation Flow
1. Parse JSON — verify OData structure (`{ "odata.metadata": ..., "value": [...] }`) or bare array
2. Validate each record against `SharePointWorkPackage` schema
3. Report: record count, customer count, aircraft count, date range, missing fields, type mapping coverage
4. User reviews preview → clicks "Import" to commit
5. Imported data written to `data/input.json` (overwrites)
6. Import logged to `import_log` table with stats + user + timestamp

### API Routes
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/admin/import/validate` | Parse + validate without importing |
| `POST` | `/api/admin/import/commit` | Write validated data to `data/input.json` + log |
| `GET` | `/api/admin/import/history` | Import history |

### vNext: Power Automate Endpoint
A secure POST endpoint at `/api/ingest` for automated data pushes:
- Bearer token authentication (API key stored in env)
- Rate limited (1 req/min)
- Full audit trail
- Same validation as admin import
- Documented as vNext stub — no implementation in v1

---

## System Settings (`/admin/settings`)

### v1 Sections
| Section | Contents |
|---------|----------|
| Demand Model | Default MH, WP inclusion mode (mirrors /settings for admin override) |
| Capacity Model | Theoretical/Real capacity per person |
| Shift Config | Shift table (name, start, end, headcount) |
| Data | Import path, last import stats |

### vNext Sections (stubs)
| Section | Contents |
|---------|----------|
| Authentication | Session timeout, password policy, allowed providers |
| Email | SMTP config for notifications |
| Storage | Data directory, backup settings |

---

## Audit Log (`/admin/audit`) — vNext Stub

Page exists with "Coming Soon" empty state. Will track:
- Customer color changes
- User creation/modification/deactivation
- Config changes (with previous value)
- Data imports

### Data Model (vNext)

```typescript
interface AuditEntry {
  id: string;
  userId: string;
  action: string;            // "customer.color.update", "user.create", etc.
  targetType: string;        // "customer", "user", "config"
  targetId: string;
  previousValue: string;     // JSON
  newValue: string;          // JSON
  timestamp: Date;
}
```

---

## Files

| File | Purpose |
|------|---------|
| `src/app/admin/layout.tsx` | Admin layout with sub-navigation + role guard |
| `src/app/admin/page.tsx` | Redirect to `/admin/customers` |
| `src/app/admin/customers/page.tsx` | Customer color management |
| `src/app/admin/aircraft-types/page.tsx` | Aircraft type mapping editor |
| `src/app/admin/import/page.tsx` | Data import (file upload + paste JSON) |
| `src/app/admin/users/page.tsx` | User management |
| `src/app/admin/settings/page.tsx` | System settings |
| `src/app/admin/audit/page.tsx` | Audit log (vNext stub) |
| `src/components/admin/customer-color-editor.tsx` | Color picker + hex input per customer |
| `src/components/admin/aircraft-type-editor.tsx` | Mapping rule table + test input |
| `src/components/admin/data-import.tsx` | File upload, paste JSON, preview, commit |
| `src/components/admin/user-table.tsx` | Users list with actions |
| `src/components/admin/user-form.tsx` | Create/edit user dialog |
| `src/app/api/admin/customers/route.ts` | Customer CRUD API |
| `src/app/api/admin/aircraft-types/route.ts` | Mapping rule CRUD API |
| `src/app/api/admin/import/validate/route.ts` | Import validation API |
| `src/app/api/admin/import/commit/route.ts` | Import commit API |
| `src/app/api/admin/import/history/route.ts` | Import history API |
| `src/app/api/admin/users/route.ts` | User management API |
| `src/lib/utils/aircraft-type.ts` | Normalization service (D-015) |
