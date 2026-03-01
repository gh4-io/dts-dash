# Mobile Quick Wins — Easy Implementations for Successful Deployment

> **Goal**: High-impact, low-effort mobile UX improvements
> **Effort**: Most < 1 hour; total ~4–6 hours for all
> **Version impact**: PATCH (quality improvements, no feature changes)

---

## 1. Viewport Meta Tags & Safe Areas (15 min)

**File**: `src/app/layout.tsx` (root layout's `generateMetadata()`)

**Current** (likely incomplete):
```tsx
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

**Add**:
```tsx
export const metadata: Metadata = {
  // ... existing
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,           // Allow pinch-zoom (accessibility)
    userScalable: true,        // Allow user zoom
    viewportFit: 'cover',      // Extend to notch (iPhone X+)
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a1a' },
  ],
  formatDetection: {
    telephone: true,           // Allow tel: links
    email: true,               // Allow mailto: links
    address: false,            // Don't auto-linkify addresses
  },
};

// In root layout JSX:
<html className="safe-area" suppressHydrationWarning>
```

**CSS** (in `globals.css`):
```css
@supports (padding: max(0px)) {
  html {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }

  /* For iPhone notch at top */
  header, .fixed-top {
    padding-top: env(safe-area-inset-top);
  }

  /* For home indicator at bottom */
  .fixed-bottom, nav[role="navigation"] {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

**Impact**: Fixes display on notched phones (iPhone X, Dynamic Island, etc.). Respects system safe areas.

---

## 2. Enforce 44px+ Touch Targets Globally (20 min)

**File**: `src/components/ui/button.tsx` (shadcn/ui button override)

**Current**:
```tsx
<button className="h-9 px-3"> {/* ~36px height */}
```

**Add**:
```tsx
// Mobile-safe baseline: 44px minimum
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        buttonVariants({ size }),
        'min-h-11 md:min-h-9', // 44px on mobile, 36px on desktop
        'min-w-11 md:min-w-9',  // Width too
      )}
      {...props}
    />
  )
);
```

**Also update**:
- Icons in buttons/menus: `w-5 h-5 md:w-4 md:h-4`
- Links: `min-h-11 md:min-h-auto`
- Form inputs: Already 40px+, confirm they're 44px on mobile
- Checkboxes/radio: Increase click area with pseudo-elements

```tsx
// For small interactive elements (checkboxes, radio)
<input
  className="sr-only peer"  // Hide native input
  {...props}
/>
<div className="w-5 h-5 md:w-4 md:h-4 peer-checked:bg-accent" /> {/* Click area */}
```

**Testing**: Use DevTools device emulation, measure tap target with cursor hover

**Impact**: Reduces accidental misclicks; improves UX on touchscreen.

---

## 3. Prevent Cumulative Layout Shift (CLS) (20 min)

**Issue**: When content loads (skeleton → data), layout jumps. Especially bad on mobile where scrolling is disrupted.

**File**: `src/components/shared/loading-skeleton.tsx`

**Ensure all skeletons have fixed heights**:
```tsx
// KPI Card skeleton
<div className="h-24 bg-muted rounded-lg animate-pulse" />

// Chart skeleton
<div className="h-80 bg-muted rounded-lg animate-pulse" />

// Table skeleton
<div className="space-y-2">
  {Array.from({ length: 5 }).map(i => (
    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
  ))}
</div>
```

**Also**:
- Set explicit `height` on image containers (before image loads)
- Use `aspect-ratio` for responsive containers

```tsx
<div className="aspect-video bg-muted rounded-lg overflow-hidden">
  <img src="..." alt="..." className="w-full h-full object-cover" />
</div>
```

**Test**: Open DevTools → Lighthouse → Performance. Look for CLS score (should be <0.1).

**Impact**: Smoother data loading; no jarring layout shifts.

---

## 4. Optimize Font Sizes for Mobile (15 min)

**File**: `src/app/globals.css` (or Tailwind config)

**Rule**: Minimum 16px for inputs (prevents auto-zoom on iOS), readable body text on 375px screens.

**Add to `globals.css`**:
```css
/* Mobile-first font sizing */
html {
  font-size: clamp(14px, 2vw, 16px); /* Responsive base size */
}

body {
  @apply text-base; /* 16px base on mobile */
}

/* Ensure inputs are 16px (prevent iOS zoom) */
input,
textarea,
select,
button {
  font-size: 16px; /* No zoom on iOS */
}

/* Smaller text on desktop, readable on mobile */
@media (min-width: 768px) {
  body {
    @apply text-sm; /* 14px on tablet/desktop */
  }
}

/* Headings scale with viewport */
h1 { @apply text-2xl md:text-4xl; }
h2 { @apply text-xl md:text-3xl; }
h3 { @apply text-lg md:text-2xl; }
```

**Impact**: Readable on all screens; no auto-zoom on iOS input focus.

---

## 5. Mobile Keyboard Handling (20 min)

**Issue**: Mobile keyboard appears/disappears, layout shifts. FilterBar or input can be hidden.

**File**: `src/components/shared/filter-bar.tsx` (or wherever forms are)

**Solution 1: Sticky behavior**
```tsx
<div className="sticky top-0 z-40 bg-background/95 backdrop-blur">
  {/* FilterBar stays visible even with keyboard open */}
</div>
```

**Solution 2: Scroll into view on focus**
```tsx
<input
  onFocus={(e) => {
    // Scroll input into view after keyboard appears
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }}
/>
```

**Solution 3: Dismiss keyboard on submit**
```tsx
<form onSubmit={(e) => {
  e.preventDefault();
  // Blur to dismiss keyboard
  document.activeElement?.blur();
  applyFilters();
}}>
```

**Testing**: Use DevTools mobile emulation, enable "Emulate CSS media feature prefers-reduced-motion"

**Impact**: Keyboard doesn't hide critical UI; smoother form interactions.

---

## 6. Reduce Motion for Accessibility (10 min)

**File**: `src/app/globals.css`

**Add**:
```css
/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Also in component CSS**:
```tsx
// Example: Chart animation
const chartOption = {
  animation: prefersReducedMotion ? false : 'auto',
};

// Helper hook
const usePrefersReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    mq.addEventListener('change', (e) => setPrefersReduced(e.matches));
  }, []);
  return prefersReduced;
};
```

**Impact**: Accessible to users with vestibular disorders; improves mobile perception of speed.

---

## 7. Form Input Optimization (15 min)

**File**: Filter inputs, login form, etc.

**Ensure**:
```tsx
// Date input
<input
  type="date"
  inputMode="date"
  min="2026-01-01"
  max="2026-12-31"
  className="text-base" // 16px
/>

// Time input
<input
  type="time"
  inputMode="time"
/>

// Number/decimal
<input
  type="number"
  inputMode="decimal"
  step="0.1"
/>

// Email
<input
  type="email"
  inputMode="email"
  autoComplete="email"
/>

// Operator/aircraft multi-select
<select
  multiple
  className="text-base"
/>

// General
<input
  className="text-base p-3" // 16px, good padding
  autoComplete="off" // Prevent unwanted autocomplete if needed
  spellCheck="false"
/>
```

**Impact**: Mobile keyboard shows correct type (number pad, email keyboard, etc.). Better accessibility + UX.

---

## 8. Loading States & Skeleton Consistency (20 min)

**File**: `src/components/shared/loading-skeleton.tsx` + all data-dependent components

**Create reusable skeletons**:
```tsx
// Skeleton for KPI card
export const KpiCardSkeleton = () => (
  <div className="p-4 bg-muted rounded-lg space-y-2">
    <div className="h-4 bg-muted-foreground/20 rounded w-1/3" />
    <div className="h-10 bg-muted-foreground/20 rounded" />
  </div>
);

// Skeleton for chart
export const ChartSkeleton = () => (
  <div className="h-80 bg-muted rounded-lg animate-pulse" />
);

// Skeleton for table row
export const TableRowSkeleton = () => (
  <tr>
    {Array.from({ length: 5 }).map(i => (
      <td key={i} className="p-2">
        <div className="h-6 bg-muted rounded" />
      </td>
    ))}
  </tr>
);
```

**Use consistently**:
```tsx
{isLoading ? (
  <>
    <KpiCardSkeleton />
    <KpiCardSkeleton />
    <ChartSkeleton />
  </>
) : (
  <Dashboard {...data} />
)}
```

**Impact**: Perceived performance improves; users see content structure immediately.

---

## 9. Smooth Scrolling & Focus Management (15 min)

**File**: `src/app/globals.css` + layout components

**CSS**:
```css
/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Focus visible for keyboard users */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Remove focus ring for mouse users (visible for keyboard) */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Component**:
```tsx
// After navigation
const navigate = useNavigate();
const handleNavClick = (href) => {
  navigate(href);
  // Reset scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
```

**Impact**: Natural scrolling feel; better keyboard accessibility.

---

## 10. Color Contrast Verification (10 min)

**Verify** all text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

**Quick check**:
1. Use Chrome DevTools → Lighthouse → Accessibility
2. Look for contrast warnings
3. Verify dark theme colors in `.claude/SPECS/REQ_Themes.md`

**Common issues on mobile**:
- Gray text on light background (insufficient contrast)
- Icons without sufficient color separation
- Chart labels on busy backgrounds

**Fix**: Update Tailwind config or theme CSS if needed

**Impact**: Readable for all users (vision impaired, bright sunlight, older devices).

---

## 11. Network Resilience Badge (Optional, 20 min)

**File**: New component `src/components/shared/network-indicator.tsx`

**What**: Show indicator when user is offline or on slow network

```tsx
export const NetworkIndicator = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    // Detect slow network (optional)
    if ('connection' in navigator) {
      const conn = navigator.connection;
      setIsSlowNetwork(conn.effectiveType === '2g' || conn.effectiveType === '3g');
    }
  }, []);

  if (isOnline && !isSlowNetwork) return null;

  return (
    <div className="bg-amber-600 text-white px-3 py-1 text-xs flex items-center gap-2">
      <Icon className="fa-wifi-slash" />
      {!isOnline ? 'Offline' : 'Slow Network'}
    </div>
  );
};

// Add to layout
<NetworkIndicator />
```

**Impact**: Users know why things are slow; sets expectations.

---

## 12. PWA App Icon & Theme Colors (Already Done, Verify)

**Verify in `src/app/layout.tsx`**:
```tsx
export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent', // Dark on dark background
    title: 'CVG Dashboard',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
    other: {
      rel: 'mask-icon',
      url: '/icons/icon-512-maskable.png',
      color: '#0a0a1a',
    },
  },
  manifest: '/site.webmanifest',
};
```

**Check `public/site.webmanifest`**:
```json
{
  "name": "CVG Line Maintenance Dashboard",
  "short_name": "CVG Dashboard",
  "description": "Flight board, analytics, and capacity modeling",
  "scope": "/",
  "start_url": "/flight-board",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0a0a1a",
  "background_color": "#0a0a1a",
  "icons": [...]
}
```

**Status**: Already done in Phase 4 (D-055)

**Impact**: Users can add to home screen; branded icon + app experience.

---

## Summary Table: Quick Wins by Impact

| # | Feature | Effort | Impact | Priority |
|---|---------|--------|--------|----------|
| 1 | Safe area insets (notch) | 15 min | HIGH | 🔴 |
| 2 | 44px+ touch targets | 20 min | HIGH | 🔴 |
| 3 | Prevent layout shift (CLS) | 20 min | HIGH | 🔴 |
| 4 | Font sizing for mobile | 15 min | HIGH | 🔴 |
| 5 | Keyboard handling | 20 min | MEDIUM | 🟡 |
| 6 | Reduce motion (a11y) | 10 min | MEDIUM | 🟡 |
| 7 | Form input optimization | 15 min | MEDIUM | 🟡 |
| 8 | Loading skeleton consistency | 20 min | MEDIUM | 🟡 |
| 9 | Smooth scrolling + focus | 15 min | MEDIUM | 🟡 |
| 10 | Color contrast check | 10 min | MEDIUM | 🟡 |
| 11 | Network indicator | 20 min | LOW | 🟢 |
| 12 | PWA verification | 5 min | LOW | 🟢 |

**Total effort**: ~4–6 hours for all 12 items

---

## Recommended Order

1. **First 24 hours** (PRE-LAUNCH):
   - #1, #2, #3, #4 — Foundation (1.5 hours)
   - #10 — Verify contrast (10 min)
   - #12 — Verify PWA (5 min)
   - **Total: 2.25 hours** — fixes most mobile complaints

2. **Before release**:
   - #5, #7, #8 — Forms + loading (55 min)

3. **Post-launch (nice-to-have)**:
   - #6, #9, #11 — Polish (45 min)

---

## Testing & Verification

**Before mobile launch**, run through this checklist:

- [ ] DevTools: Lighthouse Performance score ≥85 (mobile)
- [ ] DevTools: Lighthouse Accessibility score ≥90
- [ ] Physical test: Real iPhone + Android phone (if possible)
- [ ] Font sizes readable at arm's length
- [ ] All buttons/links ≥44px tap targets
- [ ] No layout shift when data loads
- [ ] Theme color matches status bar (Android)
- [ ] Safe areas respected (iPhone notch)
- [ ] Keyboard doesn't hide critical UI
- [ ] Contrast ratio ≥4.5:1 (WCAG AA)
- [ ] Smooth scrolling feels natural
- [ ] Print button hidden (phone only)

---

## Files to Create/Modify

### New Files
- `src/components/shared/network-indicator.tsx` (optional)

### Modify
- `src/app/layout.tsx` — Viewport meta, theme color, PWA setup
- `src/app/globals.css` — Font sizing, safe areas, smooth scroll, reduce motion
- `src/components/ui/button.tsx` — 44px min height (mobile)
- `src/components/shared/loading-skeleton.tsx` — Consistent heights
- Form inputs across app — font-size: 16px, inputMode, autoComplete
- All data pages — sticky header, loading states

