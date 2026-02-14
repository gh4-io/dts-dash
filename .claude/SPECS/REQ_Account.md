# REQ: Account Page

> Route: `/account` — accessible to all authenticated users.

## Purpose
View and edit personal profile, preferences, and security settings.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ My Account                                                │
├──────────────────────────────────────────────────────────┤
│ TABS: [Profile] [Preferences] [Security]                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  (Tab content here)                                       │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Tab 1: Profile

### Fields (v1)
| Field | Type | Editable | Notes |
|-------|------|----------|-------|
| Display Name | Text | Yes | 2-50 characters |
| Email | Text | Read-only | Shown with lock icon. Change requires admin. |
| Role | Badge | Read-only | "Admin", "User", etc. |
| Member Since | Text | Read-only | `createdAt` formatted |

### Save
- `PUT /api/account/profile` with `{ displayName }`
- Toast: "Profile updated" on success

---

## Tab 2: Preferences

All preferences are per-user, stored in `user_preferences` table.

### Appearance
| Setting | Control | Options | Default |
|---------|---------|---------|---------|
| Color Mode | Select | Light, Dark, System | System |
| Theme Preset | Select | Classic, Ocean, Lavender, Midnight | Classic |
| Accent Color | Color picker | Any hex (overrides preset accent) | null (uses preset) |
| Compact Mode | Switch | On/Off | Off |

#### Theme Presets (D-018)

Named presets define a coordinated palette applied via CSS custom properties. Each preset works in both Light and Dark color modes.

| Preset | Description | Primary Accent | Surface Tone |
|--------|-------------|---------------|-------------|
| **Classic** | Neutral dark (current default — Fumadocs-inspired) | `--accent: 210 40% 52%` (steel blue) | Zinc/neutral grays |
| **Ocean** | Cool blue tones | `--accent: 200 80% 50%` (ocean blue) | Slate with blue tint |
| **Lavender** | Soft purple tones | `--accent: 270 60% 60%` (lavender) | Slate with purple tint |
| **Midnight** | Deep dark with amber highlights | `--accent: 38 90% 55%` (amber) | Near-black with warm edges |

Implementation: each preset maps to a CSS class (`.theme-classic`, `.theme-ocean`, etc.) on `<html>` that overrides Tailwind CSS custom properties. The accent color picker, if set, overrides only `--accent`.

### Notifications (vNext — stubs with "Coming Soon" badges)
| Setting | Control | Default | Status |
|---------|---------|---------|--------|
| Email — Transactional | Switch | On | vNext stub |
| Email — System Alerts | Switch | On | vNext stub |
| Push Notifications | Switch | Off | vNext stub |
| SMS Notifications | Switch | Off | vNext stub |

### Data Display
| Setting | Control | Options | Default |
|---------|---------|---------|---------|
| Default Timezone | Select | UTC, America/New_York, etc. | UTC |
| Default Date Range | Select | 1d, 3d, 1w | 3d |
| Table Page Size | Select | 10, 25, 30, 50, 100 | 30 |

### Persistence
- `PUT /api/account/preferences`
- Preferences loaded on login, cached in Zustand
- Theme preference overrides the global theme toggle

---

## Tab 3: Security

### v1 (Implement)
| Feature | Description |
|---------|-------------|
| Change Password | Current password + new password + confirm. Minimum 8 chars. |

### vNext (Stubs — UI present, marked "Coming Soon")
| Feature | Description | Status |
|---------|-------------|--------|
| Passkeys (WebAuthn) | Register/remove hardware keys | Stub: "Passkeys — Coming Soon" card |
| Two-Factor (TOTP) | Setup authenticator app, backup codes | Stub: "2FA — Coming Soon" card |
| Active Sessions | List all sessions with IP, device, last active | Stub: "Sessions — Coming Soon" card |

### Change Password Flow
1. User enters current password + new password + confirmation
2. Client validates: new !== current, length >= 8, confirmation matches
3. `PUT /api/account/password` with `{ currentPassword, newPassword }`
4. Server verifies current password hash, updates hash, invalidates other sessions
5. Toast: "Password changed. Other sessions have been signed out."

---

## User Preferences Data Model

```typescript
interface UserPreferences {
  userId: string;
  colorMode: "light" | "dark" | "system";
  themePreset: "classic" | "ocean" | "lavender" | "midnight";  // D-018
  accentColor: string | null;       // Hex override or null = use preset
  compactMode: boolean;
  defaultTimezone: string;           // IANA timezone
  defaultDateRange: "1d" | "3d" | "1w";
  tablePageSize: number;             // Default 30 (D-017), options: 10/25/30/50/100
  // vNext notification preferences (UI stubs now, functional later)
  emailTransactional: boolean;
  emailSystemAlerts: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
}
```

---

## User Menu (Global Header)

The user dropdown appears in the main header, right side:

```
┌─────────────────────────────────────────────────────────┐
│ [≡ Nav]  CVG Operations Dashboard      [🔔] [👤 Admin ▾] │
│                                              ┌──────────┤
│                                              │ Account   │
│                                              │ Admin  *  │ ← only if admin role
│                                              │ ─────────│
│                                              │ Logout    │
│                                              └──────────┘
└─────────────────────────────────────────────────────────┘
```

### Dropdown Items
| Item | Icon | Route/Action | Visibility |
|------|------|-------------|------------|
| Account | `fa-solid fa-user` | Navigate to `/account` | All users |
| Admin | `fa-solid fa-shield-halved` | Navigate to `/admin` | Admin/Superadmin only |
| Divider | — | — | Always |
| Logout | `fa-solid fa-right-from-bracket` | POST `/api/auth/signout` | All users |

### Display
- Shows user's display name or email
- Avatar circle (initials-based if no avatar)
- Role badge next to name for admin users

---

## Files

| File | Purpose |
|------|---------|
| `src/app/account/page.tsx` | Account page with tabs |
| `src/app/account/layout.tsx` | Account layout |
| `src/components/account/profile-form.tsx` | Profile editing |
| `src/components/account/preferences-form.tsx` | Preferences panel |
| `src/components/account/security-panel.tsx` | Password change + vNext stubs |
| `src/components/account/change-password-form.tsx` | Password change form |
| `src/components/layout/user-menu.tsx` | Header dropdown menu |
| `src/app/api/account/profile/route.ts` | Profile update API |
| `src/app/api/account/preferences/route.ts` | Preferences API |
| `src/app/api/account/password/route.ts` | Password change API |
| `src/lib/hooks/use-preferences.ts` | Zustand store for user prefs |
