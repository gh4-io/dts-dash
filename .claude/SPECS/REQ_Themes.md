# REQ: Theme System

> **What changed and why (2026-02-13):** Created from photo-driven UI reconciliation pass. Expands D-018 (4 presets) to include ALL 11 Fumadocs theme presets per user request. Each theme supports both light and dark color modes. Implementation uses CSS custom properties + next-themes.

---

## Theme Presets

All 11 Fumadocs presets, each with **light** and **dark** variants (22 theme modes total). Our original 4 names map to the closest Fumadocs equivalents.

| # | Theme Name | Fumadocs Equiv | Description | Our Original Name |
|---|-----------|----------------|-------------|-------------------|
| 1 | **Neutral** | Neutral | Default. Zinc/gray tones, steel-blue accent. Fumadocs-inspired. | Classic |
| 2 | **Ocean** | Ocean | Cool blue tones, ocean-blue accent. | Ocean |
| 3 | **Purple** | Purple | Soft purple/lavender tones. | Lavender |
| 4 | **Black** | Black | Deep true-black surfaces, minimal color. | Midnight |
| 5 | **Vitepress** | Vitepress | Vitepress documentation style. Green accent. | — (new) |
| 6 | **Dusk** | Dusk | Warm twilight tones. Sunset accent. | — (new) |
| 7 | **Catppuccin** | Catppuccin | Popular pastel theme. Muted warm tones. | — (new) |
| 8 | **Solar** | Solar | Warm gold/amber accent. Solarized-inspired. | — (new) |
| 9 | **Emerald** | Emerald | Green accent, forest tones. | — (new) |
| 10 | **Ruby** | Ruby | Red/crimson accent. Bold and warm. | — (new) |
| 11 | **Aspen** | Aspen | Earth tones, natural warmth. | — (new) |

**Default**: Neutral (dark mode) — matches the CVG Line Maintenance dashboard reference.

---

## Color Modes

Three modes via `next-themes`:

| Mode | Behavior |
|------|----------|
| **Dark** | Dark surfaces, light text. Default. |
| **Light** | Light surfaces, dark text. |
| **System** | Follows OS `prefers-color-scheme`. |

Every theme preset defines both a light and dark palette. Selecting "Dark" + "Ocean" gives you Ocean-dark. Selecting "Light" + "Ocean" gives you Ocean-light.

---

## CSS Custom Properties

Following the Fumadocs/shadcn pattern, themes are defined via CSS custom properties on `:root` (light) and `.dark` (dark). Each theme preset overrides these variables.

### Token Map

| Token | Purpose | Example (Neutral Dark) |
|-------|---------|----------------------|
| `--background` | Page background | `0 0% 3.9%` |
| `--foreground` | Default text | `0 0% 98%` |
| `--card` | Card surfaces | `0 0% 6%` |
| `--card-foreground` | Card text | `0 0% 98%` |
| `--popover` | Popover/dropdown bg | `0 0% 6%` |
| `--popover-foreground` | Popover text | `0 0% 98%` |
| `--primary` | Primary buttons, links | `210 40% 52%` |
| `--primary-foreground` | Text on primary | `0 0% 98%` |
| `--secondary` | Secondary buttons | `0 0% 14.9%` |
| `--secondary-foreground` | Text on secondary | `0 0% 98%` |
| `--muted` | Muted backgrounds | `0 0% 14.9%` |
| `--muted-foreground` | Muted text | `0 0% 63.9%` |
| `--accent` | Accent highlights | `210 40% 52%` |
| `--accent-foreground` | Text on accent | `0 0% 98%` |
| `--destructive` | Error/danger | `0 62.8% 30.6%` |
| `--destructive-foreground` | Text on destructive | `0 0% 98%` |
| `--border` | Borders | `0 0% 14.9%` |
| `--input` | Input borders | `0 0% 14.9%` |
| `--ring` | Focus rings | `210 40% 52%` |
| `--radius` | Border radius | `0.5rem` |
| `--chart-1` through `--chart-5` | Chart palette | Preset-specific |

### Customer Colors
Customer colors are **NOT** theme tokens. They are stored in SQLite (D-010) and used via `useCustomers()`. They remain consistent across all themes.

---

## Implementation Approach

### CSS Structure
```
src/app/globals.css
  @import "tailwindcss";

  /* Base theme tokens (Neutral) */
  :root { --background: ...; --foreground: ...; ... }
  .dark { --background: ...; --foreground: ...; ... }

  /* Theme overrides — each preset class overrides the tokens */
  .theme-ocean:root, .theme-ocean { ... }
  .theme-ocean.dark { ... }
  .theme-purple:root, .theme-purple { ... }
  .theme-purple.dark { ... }
  /* ... repeat for all 11 presets */
```

### HTML Application
```html
<html class="dark theme-neutral" style="color-scheme: dark">
```

Two classes control the theme:
1. **Color mode class**: `dark` or `` (light) — managed by `next-themes`
2. **Preset class**: `theme-neutral`, `theme-ocean`, etc. — managed by our preference system

### next-themes Configuration
```typescript
<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  enableSystem
  disableTransitionOnChange
>
```

Color mode is handled by `next-themes`. Theme preset is handled separately by reading the user's preference and applying the class.

### Accent Color Override
- Users can optionally set a custom accent color (hex) that overrides only `--accent` and `--ring` from the selected preset.
- Stored as `accentColor` in `user_preferences` table.
- Applied via inline `style` attribute on `<html>`: `style="--accent: H S% L%; --ring: H S% L%"`.
- Setting to `null` reverts to the preset's default accent.

---

## Preference Storage & Precedence

| Source | Priority | Where |
|--------|----------|-------|
| User preference (DB) | Highest | `user_preferences.themePreset`, `user_preferences.colorMode` |
| System default | Fallback | Neutral preset, dark mode |

### Load Sequence
1. Page loads → `next-themes` reads `localStorage` for color mode (instant, no FOUC)
2. Auth session loads → fetch user preferences from API
3. Apply theme preset class + accent override if set
4. If no user preference exists → use Neutral dark (system default)

### Persistence
- `PUT /api/account/preferences` saves theme preset + color mode + accent color
- Zustand `usePreferences()` store caches preferences client-side
- Theme toggle in header updates both Zustand store and API

---

## Theme Toggle UI

### Header Toggle (Quick)
- Location: Header, right side, before user menu
- Controls: Color mode only (light/dark/system cycle)
- Icon: `fa-solid fa-sun` (light) / `fa-solid fa-moon` (dark) / `fa-solid fa-circle-half-stroke` (system)
- Does NOT change the theme preset — only the color mode

### Preferences Page (Full)
- Location: `/account` → Preferences tab → Appearance section
- Controls: Theme preset dropdown (11 options) + Color mode select (Light/Dark/System) + Accent color picker
- Live preview: changes apply immediately for visual feedback
- Save button persists to database

---

## FOUC Prevention

- `suppressHydrationWarning` on `<html>` element
- `next-themes` injects a blocking `<script>` that reads `localStorage` and sets the `class` attribute before first paint
- Theme preset class loaded from `localStorage` cache (synced with server preference)

---

## Supersedes

- D-018 (4 presets) → expanded to 11 presets (D-022)
- REQ_UI_Interactions.md theme section → this document is now authoritative for theming

---

## Files

| File | Purpose |
|------|---------|
| `src/app/globals.css` | All theme token definitions (11 presets x 2 modes) |
| `src/components/layout/theme-toggle.tsx` | Header color mode toggle |
| `src/components/account/appearance-settings.tsx` | Full theme + color mode + accent picker |
| `src/lib/hooks/use-preferences.ts` | Zustand store (includes theme preference) |

---

## References

- Fumadocs themes: https://fumadocs.dev/docs/ui/theme
- Neutral theme reference image: `.claude/assets/img/neutral.webp`
- [UI_REFERENCE_MAP.md](../UI/UI_REFERENCE_MAP.md) — image #2
- [REQ_Account.md](REQ_Account.md) — Preferences tab
