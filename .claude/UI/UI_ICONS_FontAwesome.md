# UI: Font Awesome Icons

## Setup (Self-Hosted)

Font Awesome 6 Free is self-hosted — no CDN, no npm FA packages.

### File Location

```
public/vendor/fontawesome/
├── css/
│   ├── all.min.css          ← include this in layout
│   ├── fontawesome.min.css
│   ├── solid.min.css
│   ├── regular.min.css
│   └── brands.min.css
└── webfonts/
    ├── fa-solid-900.woff2
    ├── fa-solid-900.ttf
    ├── fa-regular-400.woff2
    ├── fa-regular-400.ttf
    └── ...
```

### Integration in Next.js

In `src/app/layout.tsx`:
```tsx
import "@/styles/globals.css";
// Font Awesome loaded via <link> in <head> or imported in globals.css

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/vendor/fontawesome/css/all.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### FaIcon Helper Component

File: `src/components/shared/fa-icon.tsx`

```tsx
interface FaIconProps {
  icon: string;        // e.g. "fa-solid fa-plane"
  className?: string;  // additional Tailwind classes
  size?: "xs" | "sm" | "lg" | "xl" | "2xl";
}

function FaIcon({ icon, className, size }: FaIconProps) {
  const sizeClass = size ? `fa-${size}` : "";
  return <i className={`${icon} ${sizeClass} ${className ?? ""}`} aria-hidden="true" />;
}
```

## Icon Map by Feature

### FilterBar
| Element | Icon | Class |
|---------|------|-------|
| Start Date | Calendar | `fa-solid fa-calendar` |
| End Date | Calendar Check | `fa-solid fa-calendar-check` |
| Station | Location | `fa-solid fa-location-dot` |
| Timezone | Clock | `fa-solid fa-clock` |
| Operator | Building | `fa-solid fa-building` |
| Aircraft | Plane | `fa-solid fa-plane` |
| Type | Plane Check | `fa-solid fa-plane-circle-check` |
| Reset Filters | Rotate Left | `fa-solid fa-rotate-left` |
| Mobile Filter Trigger | Filter | `fa-solid fa-filter` |

### Sidebar Navigation
| Page | Icon | Class |
|------|------|-------|
| Dashboard | Gauge | `fa-solid fa-gauge-high` |
| Flight Board | Plane Departure | `fa-solid fa-plane-departure` |
| Capacity | Chart Bar | `fa-solid fa-chart-bar` |
| Settings | Gear | `fa-solid fa-gear` |

### Dashboard KPI Cards
| KPI | Icon | Class |
|-----|------|-------|
| Total Aircraft | Plane | `fa-solid fa-plane` |
| Avg Ground Time | Clock | `fa-solid fa-clock` |
| Active WPs | Wrench | `fa-solid fa-wrench` |
| Utilization | Gauge | `fa-solid fa-gauge` |

### Empty / Error States
| State | Icon | Class |
|-------|------|-------|
| No matching aircraft | Plane Slash | `fa-solid fa-plane-slash` |
| Error | Triangle Excl. | `fa-solid fa-triangle-exclamation` |
| Loading (if needed) | Spinner | `fa-solid fa-spinner fa-spin` |

### Flight Board
| Element | Icon | Class |
|---------|------|-------|
| Zoom In | Magnify Plus | `fa-solid fa-magnifying-glass-plus` |
| Zoom Out | Magnify Minus | `fa-solid fa-magnifying-glass-minus` |
| Zoom Reset | Expand | `fa-solid fa-expand` |

### Settings Page
| Section | Icon | Class |
|---------|------|-------|
| Demand | Calculator | `fa-solid fa-calculator` |
| Capacity | Users | `fa-solid fa-users` |
| Shifts | Clock Rotate | `fa-solid fa-clock-rotate-left` |
| Display | Palette | `fa-solid fa-palette` |
| Data | Database | `fa-solid fa-database` |
| Import | File Import | `fa-solid fa-file-import` |

### User Menu (Header Dropdown)
| Item | Icon | Class |
|------|------|-------|
| Account | User | `fa-solid fa-user` |
| Admin | Shield | `fa-solid fa-shield-halved` |
| Logout | Sign Out | `fa-solid fa-right-from-bracket` |

### Account Page
| Section | Icon | Class |
|---------|------|-------|
| Profile | User Circle | `fa-solid fa-circle-user` |
| Preferences | Sliders | `fa-solid fa-sliders` |
| Security | Lock | `fa-solid fa-lock` |
| Password | Key | `fa-solid fa-key` |
| Passkeys (vNext) | Fingerprint | `fa-solid fa-fingerprint` |
| 2FA (vNext) | Shield Check | `fa-solid fa-shield-check` |
| Sessions (vNext) | Desktop | `fa-solid fa-desktop` |

### Admin Pages
| Page/Element | Icon | Class |
|-------------|------|-------|
| Customer Colors | Palette | `fa-solid fa-palette` |
| Aircraft Types | Plane Circle Check | `fa-solid fa-plane-circle-check` |
| Data Import | File Import | `fa-solid fa-file-import` |
| User Management | Users Gear | `fa-solid fa-users-gear` |
| System Settings | Gears | `fa-solid fa-gears` |
| Audit Log | Clipboard List | `fa-solid fa-clipboard-list` |
| Add User | User Plus | `fa-solid fa-user-plus` |
| Edit User | User Pen | `fa-solid fa-user-pen` |
| Deactivate User | User Slash | `fa-solid fa-user-slash` |
| Color Picker | Droplet | `fa-solid fa-droplet` |
| Reset Defaults | Rotate | `fa-solid fa-rotate` |

### Login Page
| Element | Icon | Class |
|---------|------|-------|
| Email Field | Envelope | `fa-solid fa-envelope` |
| Password Field | Lock | `fa-solid fa-lock` |
| Login Button | Right To Bracket | `fa-solid fa-right-to-bracket` |

## Supplementary: Lucide Icons

Lucide is included with shadcn/ui. Use for component-level icons where shadcn/ui already expects Lucide (e.g., `ChevronDown` in Select, `Check` in Checkbox).

Do NOT mix FA and Lucide for the same element. Prefer FA for all custom icons; Lucide only where shadcn/ui components require it internally.

## Build Considerations

- **Risk R6**: Font webfont paths may break in production. Test with `npm run build && npm start` early.
- CSS `url()` paths in `all.min.css` reference `../webfonts/` — ensure this relative path resolves from the CSS location.
- If paths break, edit the CSS `@font-face` declarations to use `/vendor/fontawesome/webfonts/` absolute paths.
