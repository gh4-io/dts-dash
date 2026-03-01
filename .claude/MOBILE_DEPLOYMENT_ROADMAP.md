# Mobile Deployment Roadmap

> **Goal**: Ship a production-ready mobile experience
> **Timeline**: 2–3 weeks (if executing in parallel with other work)
> **Version**: v0.3.0 (MINOR — new mobile features, backwards-compatible)

---

## Phase Overview

| Phase | Name | Effort | Duration | Key Deliverable |
|-------|------|--------|----------|-----------------|
| **Phase A** | Quick Wins | 4–6 hrs | 1–2 days | Safe areas, touch targets, layout shift, fonts, a11y |
| **Phase B** | Device Detection | 6–8 hrs | 2–3 days | Device type hook, responsive components |
| **Phase C** | Mobile Navigation | 3–4 hrs | 1–2 days | Bottom tab bar, mobile menu sheet |
| **Phase D** | Mobile Features | 3–4 hrs | 1–2 days | Flight board list, dashboard reorder, print hide |
| **Phase E** | Testing & Polish | 4–6 hrs | 2–3 days | Manual testing, DevTools audit, bug fixes |
| **TOTAL** | Mobile Ready | **20–28 hrs** | **~2–3 weeks** | Production-ready mobile app |

---

## Phase A: Quick Wins (1–2 days, ~6 hours)

**Goal**: Fix high-impact mobile UX issues with minimal code changes

### A1. Viewport & Safe Areas (15 min)
- [ ] Add safe-area-inset support for notched phones
- [ ] Set theme-color for status bar
- [ ] Enable tel: and mailto: auto-detection

**Files**: `src/app/layout.tsx`, `src/app/globals.css`

### A2. Touch Targets (20 min)
- [ ] Audit all interactive elements: min 44×44px
- [ ] Update button base size: `min-h-11 md:min-h-9`
- [ ] Update icons: `w-5 h-5 md:w-4 md:h-4`

**Files**: `src/components/ui/button.tsx`, icon usage across app

### A3. Layout Shift (CLS) (20 min)
- [ ] Add fixed heights to skeleton screens
- [ ] Use aspect-ratio for images
- [ ] Test Lighthouse CLS score

**Files**: `src/components/shared/loading-skeleton.tsx`, image components

### A4. Font Sizing (15 min)
- [ ] Set base font: `clamp(14px, 2vw, 16px)`
- [ ] Input font: 16px (no zoom on iOS)
- [ ] Test readability at 375px

**Files**: `src/app/globals.css`, form inputs

### A5. Accessibility (20 min)
- [ ] Add `prefers-reduced-motion` support
- [ ] Verify color contrast (WCAG AA)
- [ ] Add focus-visible styles

**Files**: `src/app/globals.css`

### A6. Form Inputs (15 min)
- [ ] inputMode, type, autoComplete on all inputs
- [ ] 16px font, good padding
- [ ] Keyboard dismissal on submit

**Files**: Filter components, login form, etc.

### A7. Loading States (20 min)
- [ ] Consistent skeleton designs
- [ ] Fixed heights for all skeletons
- [ ] Smooth fade-in on data load

**Files**: `src/components/shared/loading-skeleton.tsx`

### A8. Misc Polish (15 min)
- [ ] Smooth scrolling (`scroll-behavior: smooth`)
- [ ] Keyboard handling (scroll into view on focus)
- [ ] Verify PWA setup

**Files**: `src/app/globals.css`, form components

---

## Phase B: Device Detection (2–3 days, ~6–8 hours)

**Goal**: Implement device classification and responsive component system

### B1. Foundation (2–3 hours)
- [ ] Create `use-device-type.ts` hook + Zustand store
- [ ] Implement classification logic (touch + width)
- [ ] Add `device-type-hydrator.tsx` SSR wrapper
- [ ] Unit tests: 6 classification scenarios

**Files**: `src/lib/hooks/use-device-type.ts`, `src/components/layout/device-type-hydrator.tsx`, tests

### B2. Core Components (2–3 hours)
- [ ] Sidebar: conditional SheetNavigation vs StaticSidebar
- [ ] FilterBar: conditional grid columns
- [ ] Dashboard: conditional 3-col / 2-col / 1-col
- [ ] Integration tests

**Files**: Sidebar, FilterBar, Dashboard, layout components

### B3. Legacy Cleanup (1 hour)
- [ ] Remove `hidden sm:block`, `md:...`, `xl:...` CSS classes
- [ ] Verify no visual regressions
- [ ] Update component snapshots if using visual tests

**Files**: All components with old media queries

---

## Phase C: Mobile Navigation (1–2 days, ~3–4 hours)

**Goal**: Implement bottom tab bar and mobile menu sheet

### C1. Bottom Tab Bar (1 hour)
- [ ] Create/update `bottom-tab-bar.tsx` (phone-only, 4 tabs)
- [ ] Dashboard | Flights | Feedback | Menu
- [ ] Route navigation on tab clicks

**Files**: `src/components/layout/bottom-tab-bar.tsx`

### C2. Mobile Menu Sheet (1 hour)
- [ ] Create `mobile-menu-sheet.tsx` (bottom sheet from "Menu" tab)
- [ ] User account info display
- [ ] Account, Admin links
- [ ] View mode toggle (Flight Board)
- [ ] Logout button

**Files**: `src/components/layout/mobile-menu-sheet.tsx`

### C3. Header Simplification (1 hour)
- [ ] Hide theme toggle on phone
- [ ] Hide user menu dropdown on phone
- [ ] Verify header height

**Files**: `src/components/layout/header.tsx`

### C4. Navigation Tests (1 hour)
- [ ] Bottom tab bar renders on phone only
- [ ] Menu sheet opens/closes
- [ ] Theme toggle available in menu sheet
- [ ] User menu items visible in menu sheet

**Files**: `src/__tests__/components/mobile-navigation.test.tsx`

---

## Phase D: Mobile Features (1–2 days, ~3–4 hours)

**Goal**: Implement flight board list view, dashboard reordering, print hiding

### D1. Flight Board List View (1 hour)
- [ ] Default to list view on phone
- [ ] Keep Gantt available on tablet/desktop
- [ ] Optional Gantt toggle on phone (Menu sheet)

**Files**: `src/app/flight-board/page.tsx`, flight-board list component

### D2. Dashboard Reordering (1 hour)
- [ ] Render graphs on top for phone
- [ ] Combined chart → Donut → KPI cards → Operator table
- [ ] Verify responsive grid

**Files**: `src/app/dashboard/page.tsx` (or dashboard wrapper)

### D3. Print Button (30 min)
- [ ] Hide print button on phone
- [ ] Verify visible on tablet/desktop

**Files**: TopMenuBar, header, or wherever print lives

### D4. Feature Tests (1 hour)
- [ ] Flight board list view loads correctly
- [ ] Dashboard layout order correct on phone
- [ ] Print button visibility per device

**Files**: `src/__tests__/components/flight-board-mobile.test.tsx`, `src/__tests__/components/dashboard-mobile.test.tsx`

---

## Phase E: Testing & Polish (2–3 days, ~4–6 hours)

**Goal**: Comprehensive testing and bug fixes

### E1. Manual Testing (2 hours)
**Device scenarios**:
- [ ] iPhone SE / 13 / 14 (portrait & landscape)
- [ ] Android phone (portrait & landscape)
- [ ] iPad tablet (portrait & landscape)
- [ ] Desktop (1920×1080)
- [ ] Desktop + DevTools mobile emulation

**Scenarios**:
- [ ] Filter and view data on each device
- [ ] Toggle between Gantt/List on tablet
- [ ] Open/close mobile menu
- [ ] Dismiss keyboard on forms
- [ ] Pinch-zoom enabled (not locked)
- [ ] Safe areas respected (notch)

### E2. DevTools Audit (1 hour)
- [ ] Lighthouse Performance ≥85 (mobile)
- [ ] Lighthouse Accessibility ≥90
- [ ] Lighthouse SEO ≥90
- [ ] CLS (Cumulative Layout Shift) <0.1
- [ ] LCP (Largest Contentful Paint) <2.5s
- [ ] FID (First Input Delay) <100ms

### E3. Bug Fixes (1.5 hours)
- [ ] Fix any layout issues
- [ ] Fix any touch/keyboard issues
- [ ] Fix any contrast issues
- [ ] Optimize performance if needed

### E4. Documentation (30 min)
- [ ] Update ROADMAP.md with mobile completion
- [ ] Update OPEN_ITEMS.md
- [ ] Add mobile deployment notes to README

### E5. Release Prep (1 hour)
- [ ] Create PR from `feat/mobile-deployment` to `dev`
- [ ] Code review checklist
- [ ] Create PR notes with testing instructions
- [ ] Prepare release notes for v0.3.0

---

## Execution Strategy

### Option 1: Sequential (Recommended for Solo)
**Timeline**: 2–3 weeks (sustainable pace)
1. **Week 1**: Phase A + Phase B (10–14 hours)
2. **Week 2**: Phase C + Phase D (7–8 hours)
3. **Week 2–3**: Phase E (4–6 hours)

### Option 2: Parallel (If Team Available)
- **Developer 1**: Phase A + Phase B (14 hours) — core responsive system
- **Developer 2**: Phase C + Phase D (7 hours) — mobile navigation & features
- **Together**: Phase E (4–6 hours) — testing & polish

**Total**: 1–2 weeks in parallel

---

## Branch & Commit Strategy

**Branch**: `feat/mobile-deployment` off `dev`

**Commits**:
1. `fix(mobile): add safe areas, touch targets, layout shift, fonts (A)`
2. `feat(ux): implement device detection for responsive layout (D-061) (B)`
3. `feat(mobile): add bottom tab bar and mobile menu (D-062) (C)`
4. `feat(mobile): add flight board list view, dashboard reorder, hide print (D-062) (D)`
5. `test(mobile): comprehensive manual testing and bug fixes (E)`

**PR**: Merge to `dev`, then prepare release from `dev` → `master` v0.3.0

---

## Success Criteria

### Before Launch
- [ ] All quick wins implemented (Phase A)
- [ ] Lighthouse scores: Performance ≥85, Accessibility ≥90
- [ ] All touch targets ≥44×44px
- [ ] No layout shift (CLS <0.1)
- [ ] No console errors on mobile
- [ ] Safe areas respected on iPhone notch
- [ ] Fonts readable at arm's length
- [ ] All tests passing (unit + integration + manual)

### Launch Day
- [ ] Deploy to production
- [ ] Monitor error logs for mobile issues
- [ ] Gather user feedback
- [ ] Be ready to patch any critical issues

### Post-Launch (v0.3.1+)
- [ ] Fix reported issues
- [ ] Optimize performance based on real-world data
- [ ] Add features based on user feedback (gesture support, etc.)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| SSR hydration mismatch | Use `skipHydration: true` on Zustand, test thoroughly |
| Old browsers missing `navigator.maxTouchPoints` | Fallback to viewport width (default Desktop) |
| Performance regression on mobile | Run Lighthouse pre/post, monitor CLS |
| Layout shifts during data load | Fixed skeleton heights, aspect-ratio on images |
| Keyboard issues (iOS/Android) | Test on real devices, use `inputMode` + `autoComplete` |
| Touch detection false positives | Accept tradeoff; layouts still usable at ≥1280px |
| Print button visibility edge case | Test on emulator + real device |

---

## Estimated Effort Breakdown

| Phase | Hours | % of Total |
|-------|-------|-----------|
| A. Quick Wins | 6 | 21% |
| B. Device Detection | 8 | 28% |
| C. Mobile Navigation | 4 | 14% |
| D. Mobile Features | 4 | 14% |
| E. Testing & Polish | 6 | 23% |
| **TOTAL** | **28** | **100%** |

---

## Next Steps

1. **Decide execution strategy** (sequential vs parallel)
2. **Assign developer(s)**
3. **Create feature branch**: `feat/mobile-deployment`
4. **Start Phase A** (quick wins — highest ROI)
5. **Track progress** against this roadmap
6. **Update OPEN_ITEMS.md** daily
7. **Prepare release notes** as you go

---

## Key Documents

- **MOBILE_QUICK_WINS.md** — Detailed specs for Phase A (10 quick wins)
- **PLAN_DEVICE_DETECTION.md** — Detailed specs for Phases B–D
- **MOBILE_REQUIREMENTS_SUMMARY.md** — Quick reference for all mobile features
- **DECISIONS.md** — D-061 (device detection), D-062 (mobile UX)

