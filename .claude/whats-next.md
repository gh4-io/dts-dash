<original_task>
Continue the mobile-first UX deployment for the CVG Line Maintenance Operations Dashboard. This session was a continuation from a prior conversation that implemented Phases A–D of the mobile deployment. The work in this session focused on polish, bug fixes, and PWA improvements across several user-reported issues.
</original_task>

<work_completed>
## Commits made this session (4 total, all on `dev` branch)

### 1. `818fff9` — fix(mobile): polish phone UX — card redesign, layout reorder, tab bar fixes
**Files changed (6):**

- **`src/components/flight-board/flight-board-list-cards.tsx`** — Complete rewrite to compact 3-line card design:
  - Line 1: Registration (bold) + operator color dot + operator name (truncated) + status badge
  - Line 2: Arrival → Departure UTC (ground time) + WP indicator (✓/—, green/gray)
  - Line 3: Secondary info hint (inferredType · flightId · effectiveMH + source label)
  - Replaced old 4-row layout that had customer first, registration buried, no WP indicator
  - Added `formatTime()` (HH:mm UTC) and `formatGroundTime()` (Xh Xm) helpers
  - Changed card container from rounded-lg with bg-card to border-b flat list style with hover:bg-accent/10

- **`src/app/(authenticated)/flight-board/page.tsx`** — Two changes:
  - List/table toggle: replaced CSS breakpoints (`md:hidden` / `hidden md:flex`) with `device.type === "phone"` ternary
  - Expanded mode default: changed from `localStorage.getItem("flightBoardExpanded") === "true"` to `expandedRaw !== null ? expandedRaw === "true" : device.type === "phone"` — phone defaults to expanded, desktop/tablet defaults to collapsed

- **`src/app/(authenticated)/dashboard/page.tsx`** — Phone-specific layout reorder:
  - Added `device.type === "phone"` branch that renders: chart first → KPI cards → donut → operator table
  - Tablet/desktop grid unchanged (3-col desktop, 2-col tablet)
  - Phone layout is flat `flex flex-col` with components rendered individually (no column grouping)

- **`src/components/layout/bottom-tab-bar.tsx`** — Two fixes:
  - Removed Capacity from navItems (was `{ href: "/capacity", ... }`) per D-062 spec
  - Changed icon from `fa-ellipsis-vertical` to `fa-bars`, added `text-[10px]` on Menu label span to match other nav item text size

- **`src/components/layout/header.tsx`** — Added early return `if (device.type === "phone") return null;` at line 60, eliminating the 56px whitespace bar on phone. Removed now-redundant `device.type !== "phone"` conditional guards around theme toggle and user menu (TypeScript narrowing made them dead code after the early return).

- **`src/lib/hooks/use-device-type.ts`** — Fixed infinite re-render loop:
  - Changed `useEffect` dependency from `[device]` to `[]` (empty)
  - Replaced reactive store access with `useDeviceTypeStore.getState()` inside effect
  - Added guard: only call `setDevice()` when values actually changed
  - Added explicit type annotation for `detectionMethod` variable

### 2. `93e1d0d` — feat(pwa): redesign app icons and add iOS install prompt
**Files created (6):**
- `public/icons/apple-touch-icon.svg` — 180x180 SVG (wrench+plane, later deleted)
- `public/icons/icon-192.svg` — 192x192 SVG (later deleted)
- `public/icons/icon-512.svg` — 512x512 SVG (later deleted)
- `public/icons/icon-maskable-192.svg` — 192x192 SVG with safe zone padding (later deleted)
- `public/icons/icon-maskable-512.svg` — 512x512 SVG with safe zone padding (later deleted)
- **`src/components/shared/ios-install-prompt.tsx`** — iOS Safari "Add to Home Screen" banner:
  - Detection: `isIosSafari()` checks UA for iPad/iPhone/iPod + excludes CriOS/FxiOS/EdgiOS
  - Standalone check: `navigator.standalone` (Safari-specific) + `display-mode: standalone` media query
  - Dismissal persisted to localStorage key `"ios-install-dismissed"`
  - Auto-dismiss after 30 seconds
  - Positioned `bottom-[calc(70px+env(safe-area-inset-bottom))]` (above bottom tab bar)
  - Slide-in animation via Tailwind `animate-in slide-in-from-bottom`
  - Shows share icon + "Install this app: tap **Share** then **Add to Home Screen**"
  - Fixed lint error: moved `dismiss` function declaration above `useEffect` (was `function dismiss()` after effect, changed to `const dismiss = () => {...}` before effect, and inlined the auto-dismiss logic to avoid referencing `dismiss` in effect)

**Files modified (6):**
- `src/app/(authenticated)/layout.tsx` — Added `import { IosInstallPrompt }` and `<IosInstallPrompt />` component
- 5 PNG icon files replaced with wrench+plane SVG-to-PNG conversions (via sharp)

### 3. `38982a2` — fix(pwa): replace generated icons with B777 design, remove SVGs
**Files deleted (5):** All SVG icon files removed (apple-touch-icon.svg, icon-192.svg, icon-512.svg, icon-maskable-192.svg, icon-maskable-512.svg)
**Files modified (5):** All PNG icons replaced with user-provided B777 top-view design:
- Source image: `.claude/assets/icon--top-view-of-b777-with-calendar-parts--this-i.png` (1024x1024)
- Conversion via sharp: `resize(N, N, { fit: 'cover' }).png()`
- Maskable variants: content resized to 80%, extended with white background padding
- Sizes: 192, 512, maskable-192, maskable-512, apple-touch-icon (180)

## Failed attempt: dark icon version
- User provided a light B777 icon and asked for a dark version
- Attempted programmatic pixel manipulation via sharp raw buffer:
  - Pass 1: swapped white pixels → dark navy (#0f172a), brightened dark blue elements
  - Pass 2: refined thresholds for aircraft body, outlines, grays
- Result was poor quality — artifacts at anti-aliased edges, muddy colors, loss of detail
- User rejected: "very poor render" — pixel-level color swapping is wrong tool for this
- Recommended using a design tool (Figma/Illustrator) for proper layer-based inversion
- Dark version file exists at `.claude/assets/icon-dark-512.png` but is NOT used anywhere
</work_completed>

<work_remaining>
## No immediate blockers — mobile deployment is functionally complete

### Testing & Validation (Phase E)
1. **Mobile device testing** — Test on actual iOS and Android devices (not just Chrome DevTools emulation):
   - Verify bottom tab bar renders correctly on iPhone (with notch safe area)
   - Verify iOS install prompt appears in Safari, dismisses correctly, persists dismissal
   - Verify PWA icon displays correctly when added to home screen
   - Test flight board list cards at various widths (375px iPhone SE → 667px landscape)
   - Test dashboard chart-on-top layout on phone

2. **Lighthouse audit** — Run Lighthouse mobile audit to check:
   - PWA score (manifest, icons, service worker — note: no service worker yet)
   - Performance (CLS from device detection hydration, LCP)
   - Accessibility (touch targets, contrast ratios)

3. **Edge cases to verify**:
   - iPad detection: should classify as "tablet" (touch + 768-1280px)
   - iPad in landscape: should classify as "tablet" or "desktop" depending on width
   - Desktop browser resized narrow: should remain "desktop" (no touch = desktop fallback)
   - Flight board expanded mode persistence: toggle on phone, reload, should stay expanded
   - Flight board view mode persistence: switch to gantt on phone, reload, should remember

### Documentation updates needed
- `.claude/ROADMAP.md` — Update Phase 4 status with PWA and icon work
- `.claude/OPEN_ITEMS.md` — Close any related mobile OIs, add new ones for testing
- `memory/MEMORY.md` — Update with PWA work, icon replacement, iOS install prompt

### Future considerations (not blocking)
- **Service Worker** — No SW yet; adding one would enable offline caching and improve PWA score
- **Dark icon version** — Needs to be created in a design tool, not programmatically
- **Android install prompt** — `beforeinstallprompt` event could trigger a native-feeling prompt on Chrome Android (currently only iOS Safari is handled)
- **Push to origin** — Branch is 34 commits ahead of `origin/dev`

### Print chart fix (from prior session, still pending)
The `whats-next.md` from the prior session documented a broken Dashboard print chart (Recharts bars/line render blank). The fix hypothesis: add `isAnimationActive={false}` to Bar/Line in the print render path. This was never attempted. See prior session's detailed notes in git history.
</work_remaining>

<attempted_approaches>
## Dark icon generation (FAILED)
- **Approach**: sharp raw pixel buffer manipulation — iterate all pixels, classify by luminance/color, swap white→navy, brighten dark blues
- **Why it failed**: Anti-aliased edges between colors created artifacts. Gradient areas got misclassified. The algorithm can't understand "layers" — it only sees individual pixels. Semi-transparent edges get wrong colors. Result looked muddy and unprofessional.
- **Lesson**: Programmatic pixel swapping is not suitable for design-quality icon variants. Use a vector design tool where you can properly adjust fills/strokes by layer.
- **Artifacts to clean up**: `.claude/assets/icon-dark-512.png` exists but is unused

## iOS install prompt lint error
- Agent created `dismiss()` as a `function` declaration after the `useEffect` that referenced it
- ESLint `react-hooks/immutability` rule flagged: "Cannot access variable before it is declared"
- Fix: moved to `const dismiss = () => {...}` before the effect, and inlined `saveDismissed(); setVisible(false);` in the auto-dismiss timeout to avoid the stale closure issue

## Bottom tab bar Menu text size mismatch
- The `<button>` element has browser default font styling that overrides parent's `text-[10px]`
- The `<Link>` elements (rendered as `<a>`) don't have this issue
- Fix: added explicit `className="text-[10px]"` on the Menu label `<span>`

## Install prompt agent timeout
- The background agent creating the iOS install prompt got stuck running `npm run build` (WSL2 can be slow)
- Had to stop the agent manually and verify/finish the work directly
- The agent had already created the component and integrated it into layout.tsx before getting stuck
</attempted_approaches>

<critical_context>
## Device detection architecture (D-061, from prior session)
- Primary: `navigator.maxTouchPoints > 0` + viewport width
- Classification: phone (touch + <768), tablet (touch + 768-1280), desktop (≥1280 or no touch)
- **Critical**: no touch + <768 = DESKTOP (not phone) — prevents false mobile detection on resized desktop browsers
- Zustand store with `useDeviceTypeStore.getState()` pattern to avoid infinite re-render loops
- `useEffect` with empty deps `[]` — runs once, resize/orientation listeners handle updates

## Mobile navigation decisions (D-062, from prior session)
- Phone: bottom tab bar (Dashboard, Flights, Feedback, Menu) — NO Capacity
- Phone: header returns null entirely (reclaims 56px)
- Phone: sidebar returns null
- Phone: Menu sheet (Radix Sheet from bottom) has user menu + view mode
- Tablet: hamburger menu in header, collapsible sidebar
- Desktop: full sidebar

## Flight board list card design
- 3-line compact card matching `.claude/FLIGHT_BOARD_LIST_DESIGN.md` spec
- Critical fields: registration (bold), arrival→departure times, WP indicator (✓/—)
- Non-critical in line 3: inferredType, flightId, effectiveMH with source label
- Cards use `<button>` wrapper for full clickability
- IntersectionObserver lazy loading (30-item batches)

## PWA manifest (`public/site.webmanifest`)
- `display: "standalone"`, `start_url: "/dashboard"`, `background_color: "#09090b"`
- Icons reference PNG files only (SVGs were removed)
- `apple-mobile-web-app-capable: true` in layout.tsx metadata

## Git state
- Branch: `dev`, 34 commits ahead of `origin/dev`
- Working tree clean except 2 untracked files in `.claude/assets/` (source icon + failed dark version)
- No uncommitted changes in src/

## Key file paths
- `src/lib/hooks/use-device-type.ts` — Device detection hook
- `src/components/layout/bottom-tab-bar.tsx` — Phone bottom nav
- `src/components/layout/mobile-menu-sheet.tsx` — Phone menu sheet
- `src/components/shared/ios-install-prompt.tsx` — iOS install banner
- `src/components/flight-board/flight-board-list-cards.tsx` — Mobile card list
- `src/app/(authenticated)/flight-board/page.tsx` — Flight board page
- `src/app/(authenticated)/dashboard/page.tsx` — Dashboard page
- `public/site.webmanifest` — PWA manifest
- `public/icons/` — 5 PNG icon files (B777 design)
- `.claude/FLIGHT_BOARD_LIST_DESIGN.md` — Card design spec
- `.claude/MOBILE_REQUIREMENTS_SUMMARY.md` — Mobile requirements quick reference
</critical_context>

<current_state>
## Deliverable status

| Feature | Status |
|---------|--------|
| Device detection hook (use-device-type) | Complete ✅ |
| Bottom tab bar (phone only) | Complete ✅ |
| Mobile menu sheet | Complete ✅ (prior session) |
| Header hidden on phone | Complete ✅ |
| Sidebar hidden on phone | Complete ✅ (prior session) |
| Flight board list card redesign (3-line) | Complete ✅ |
| Flight board expanded default on phone | Complete ✅ |
| Flight board device-type toggle (cards/table) | Complete ✅ |
| Dashboard chart-on-top for phone | Complete ✅ |
| Legend hidden on phone | Complete ✅ (prior session) |
| Bottom tab bar icon/text fix | Complete ✅ |
| PWA icons (B777 light design) | Complete ✅ |
| iOS Safari install prompt | Complete ✅ |
| Dark icon version | Not done ❌ (needs design tool) |
| Mobile testing on real devices | Not started |
| Push to origin | Not done (34 commits ahead) |

## Git log (this session's commits)
```
38982a2 fix(pwa): replace generated icons with B777 design, remove SVGs
93e1d0d feat(pwa): redesign app icons and add iOS install prompt
818fff9 fix(mobile): polish phone UX — card redesign, layout reorder, tab bar fixes
```

## Working tree
- Clean (no staged or unstaged changes)
- 2 untracked files in `.claude/assets/` (icon source images, not shipped)

## Build / Lint
- `npm run build` — passes ✅
- `npm run lint` — clean ✅

## Open questions
- Should we push the 34 commits to origin?
- Dark icon version — user may want to revisit with a design tool
- Dashboard print chart (Recharts blank bars) still unresolved from prior session
</current_state>
