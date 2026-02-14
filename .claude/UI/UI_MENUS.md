# UI: Menu Patterns

> **What changed and why (2026-02-13):** Created from photo-driven UI reconciliation pass. Documents dropdown menu behaviors derived from CargoJet reference screenshots and existing specs.

---

## User Menu (Header Dropdown)

Located in the global header, right side. See [REQ_Account.md](../SPECS/REQ_Account.md) for full spec.

```
┌──────────────────────────────────────────────────────────────┐
│  [≡]  CVG Operations Dashboard                 [◐] [👤 Admin ▾] │
│                                                    ┌────────────┤
│                                                    │ 👤 Account  │
│                                                    │ 🛡 Admin  * │ ← admin/superadmin only
│                                                    │ ─────────── │
│                                                    │ ⇥ Logout    │
│                                                    └────────────┘
└──────────────────────────────────────────────────────────────┘
```

### Items

| Item | Icon | Route/Action | Visibility | Keyboard |
|------|------|-------------|------------|----------|
| Account | `fa-solid fa-user` | Navigate `/account` | All users | — |
| Admin | `fa-solid fa-shield-halved` | Navigate `/admin` | Admin/Superadmin | — |
| Divider | — | — | Always | — |
| Logout | `fa-solid fa-right-from-bracket` | `POST /api/auth/signout` | All users | — |

### Display
- Trigger: User's display name (or email if no display name) + avatar circle (initials-based)
- Role badge: "Admin" or "Super" badge next to name for elevated users
- Dropdown: shadcn/ui `DropdownMenu` component
- Animation: Fade in, 150ms

---

## Sidebar Navigation

Left sidebar, always visible on desktop, collapsible on tablet, sheet on mobile.

### Desktop (xl, expanded ~240px)

```
┌────────────────────────┐
│ ✈ CVG Dashboard        │
│                        │
│ 📊 Flight Board        │ ← active: accent bg
│ 📈 Dashboard           │
│ 📉 Capacity            │
│ ⚙ Settings             │
│                        │
│                        │
│                        │
│ v1.0.0                 │
└────────────────────────┘
```

### Tablet (md, collapsed ~64px)
- Icons only, tooltip on hover for labels
- Active item: accent-colored icon

### Mobile (sm, sheet overlay)
- Hamburger trigger in header
- Full-height sheet from left
- Same items as desktop expanded view
- Close on route navigation or X button

### Navigation Items

| Label | Icon | Route | Badge |
|-------|------|-------|-------|
| Flight Board | `fa-solid fa-plane-departure` | `/flight-board` | — |
| Dashboard | `fa-solid fa-chart-line` | `/dashboard` | — |
| Capacity | `fa-solid fa-gauge-high` | `/capacity` | — |
| Settings | `fa-solid fa-gear` | `/settings` | — |

---

## Admin Sub-Navigation

Appears within `/admin/*` routes. Replaces or sits below the main sidebar items.

### Layout
- Horizontal tabs (desktop) or vertical list (mobile)
- Active tab: underline accent + bold text

### Tabs

| Label | Route | Icon | Visibility |
|-------|-------|------|------------|
| Customers | `/admin/customers` | `fa-solid fa-palette` | Admin+ |
| Aircraft Types | `/admin/aircraft-types` | `fa-solid fa-plane-circle-check` | Admin+ |
| Data Import | `/admin/import` | `fa-solid fa-file-import` | Admin+ |
| Users | `/admin/users` | `fa-solid fa-users` | Admin+ |
| Settings | `/admin/settings` | `fa-solid fa-sliders` | Admin+ |
| Analytics | `/admin/analytics` | `fa-solid fa-chart-bar` | Admin+ |
| Audit Log | `/admin/audit` | `fa-solid fa-clock-rotate-left` | Admin+ |

---

## Actions Menu Pattern (Reference)

Derived from CargoJet APEX screenshots (images 6, 7). This is a **reference pattern** for admin data tables, NOT for the main application pages.

### When to Use
- Admin tables (user management, import history) that need bulk or context actions
- NOT used on Flight Board, Dashboard, or Capacity pages

### Pattern

```
┌─────────────────────────┐
│ Actions ▾               │
├─────────────────────────┤
│ 📥 Export CSV            │
│ 🔄 Refresh               │
│ ─────────────────────── │
│ 📊 Rows Per Page    ▸   │ ← submenu
│ ─────────────────────── │
│ ❓ Help                  │
└─────────────────────────┘
```

### Behavior
- Trigger: "Actions" button (shadcn/ui `DropdownMenu`)
- Submenu: Opens to the right on hover/click (e.g., Rows Per Page → 10/25/30/50/100)
- Dividers: Group related items
- Keyboard: Arrow keys navigate, Enter selects, Escape closes

---

## Dropdown General Patterns

### Styling
- Background: `--popover` token (dark surface)
- Border: 1px `--border` token
- Shadow: `shadow-md`
- Border radius: `--radius`
- Item hover: `--accent` background with `--accent-foreground` text
- Active item: Checkmark icon on left

### Animation
- Open: Fade + slide down, 150ms ease-out
- Close: Fade, 100ms ease-in

### Accessibility
- `role="menu"` on container, `role="menuitem"` on items
- Arrow key navigation
- Focus trap within open menu
- Escape to close

---

## References

- CargoJet Actions menu: `.claude/assets/img/Screenshot 2026-02-13 16402*.png`
- [REQ_Account.md](../SPECS/REQ_Account.md) — User menu spec
- [REQ_Admin.md](../SPECS/REQ_Admin.md) — Admin navigation
- [UI_REFERENCE_MAP.md](UI_REFERENCE_MAP.md) — images 6, 7, 11
