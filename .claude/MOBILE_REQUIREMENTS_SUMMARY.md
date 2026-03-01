# Mobile Requirements Summary (D-061, D-062)

> **Status**: Ready for Sonnet/Opus implementation
> **Related decisions**: D-061 (device detection), D-062 (mobile-specific UX)
> **Implementation plan**: PLAN_DEVICE_DETECTION.md (Phases 1–4)

---

## Quick Reference: Phone (< 768px, touch-capable)

### Navigation & Top Bar
| Current | Mobile |
|---------|--------|
| Sidebar hamburger | ❌ Removed |
| Top menu bar | ❌ Simplified (hide theme + user menu) |
| Theme toggle (`◐`) | → Moved to Menu sheet |
| User menu dropdown | → Moved to Menu sheet |
| **NEW**: Bottom tab bar | ✅ Fixed, 4 tabs: Dashboard \| Flights \| Feedback \| Menu |

### Bottom Tab Bar (Fixed, 44px+)
```
[📊 Dashboard] [✈ Flights] [💬 Feedback] [≡ Menu]
```

**Menu Sheet** (bottom sheet):
```
👤 [Username] / [email]
─────────────
👤 Account
🛡 Admin (if admin+)
─────────────
View Mode: [List/Gantt]  (* Flight Board only)
─────────────
⇥ Logout
```

### Flight Board
| Current | Mobile |
|---------|--------|
| Default: Gantt | ✅ **List view** (default) |
| Gantt interactive | ❌ Hidden from phone users |
| View mode toggle | → In Menu sheet (optional, experimental) |
| List view | ✅ Card-based, sortable, full-width |
| Tap to detail | ✅ Same drawer as desktop |

**List Card Layout**:
```
● CargoJet  C-FOIJ
CJT507  B767
05:38 UTC → 10:00 UTC
Ground: 4h 22m
MH: 3.0  ◀ Tap for details
```

### Dashboard
| Current | Mobile |
|---------|--------|
| Layout: KPI left → Chart → Donut | ✅ **Reordered** |
| Order | **Graphs first** |
| | Combined chart (top) |
| | Donut chart |
| | KPI cards (stacked) |
| | Operator table (h-scroll) |
| Rationale | Operational context flows naturally; scroll → summary |

### Print Functions
| Current | Mobile |
|---------|--------|
| Print button visible | ❌ **Hidden** on phone |
| Desktop/tablet | ✅ Print button enabled |

---

## Tablet (768px–1279px, may have touch)

- Sidebar: **Collapsed** (64px icon-only)
- FilterBar: **2×2 grid** (stacked)
- Content: **2-column grid** (or 3-col landscape if space)
- Bottom tab bar: **Hidden** (desktop-style sidebar + top menu still visible)
- Flight Board: **Gantt** (default) or list (toggle)
- Dashboard: **KPI left + charts center/right** (normal layout)
- Print: **Enabled**
- View mode toggle: In TopMenuBar (not in Menu sheet)

---

## Desktop (≥ 1280px, no touch or desktop with touch)

- Sidebar: **Expanded** (240px)
- FilterBar: **2-row inline**
- Content: **Full layout**, multi-column
- Bottom tab bar: **Hidden**
- Flight Board: **Gantt** (default)
- Dashboard: **3-column** (KPI left, chart center, donut right)
- Print: **Enabled**
- View mode toggle: In TopMenuBar

---

## Implementation Checklist (Phases 1–4)

### Phase 1: Device Detection Foundation
- [ ] `use-device-type.ts` hook with Zustand store
- [ ] `device-type-hydrator.tsx` SSR wrapper
- [ ] Classification logic (touch + width → phone/tablet/desktop)
- [ ] Unit tests (classification, hook behavior)

### Phase 2: Responsive Components
- [ ] Sidebar: conditional SheetNavigation vs StaticSidebar
- [ ] FilterBar: conditional grid columns
- [ ] Dashboard layout: conditional 3-col/2-col/1-col
- [ ] Touch targets: 44px+ on phone/tablet
- [ ] Integration tests (component variants)

### Phase 3: Legacy Cleanup
- [ ] Remove `hidden sm:block`, `md:...`, `xl:...` classes
- [ ] Verify no regressions

### Phase 4: Mobile Features
- [ ] Bottom tab bar (phone-only, 4 tabs)
- [ ] Mobile menu sheet (Account, Admin, View Mode, Logout)
- [ ] Hide theme toggle + user menu from header (phone)
- [ ] Flight Board list default (phone)
- [ ] Dashboard reorder (graphs on top, phone)
- [ ] Hide print button (phone)
- [ ] Tests: navigation, flight board, dashboard layouts

---

## Files Modified/Created

### New Files
- `src/lib/hooks/use-device-type.ts` — Hook + store + types
- `src/components/layout/device-type-hydrator.tsx` — SSR wrapper
- `src/components/layout/mobile-menu-sheet.tsx` — Mobile menu (Menu tab content)
- `src/__tests__/lib/device-type.test.ts` — Unit tests
- `src/__tests__/components/responsive-components.test.tsx` — Integration tests
- `src/__tests__/components/mobile-navigation.test.tsx` — Mobile nav tests

### Modified
- `src/components/layout/layout.tsx` — Add hydrator, conditional rendering
- `src/components/layout/header.tsx` — Hide theme/user menu on phone
- `src/components/layout/sidebar.tsx` — Conditional sheet/static
- `src/components/layout/bottom-tab-bar.tsx` — Update for new menu structure
- `src/components/shared/filter-bar.tsx` — Conditional grid
- `src/app/(authenticated)/dashboard/page.tsx` — Reorder for phone
- `src/app/flight-board/page.tsx` — List default on phone
- Print button components — Hide on phone
- REQ_UI_Interactions.md — Device classification spec (D-061)
- REQ_FlightBoard.md — Mobile list view spec (D-062)
- REQ_Dashboard_UI.md — Mobile layout order (D-062)
- UI_MENUS.md — Mobile bottom tab bar + menu sheet
- DECISIONS.md — D-061, D-062

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **List view default (phone)** | Gantt requires >768px; touch drag/zoom is unreliable |
| **Bottom tab bar** | Standard mobile pattern; discoverable; reclaims sidebar space |
| **Hide header controls (phone)** | Every pixel matters <400px; theme+user menu rarely used during operations |
| **Graphs first (dashboard, phone)** | Operational context flows naturally; KPI summary follows |
| **Print hidden (phone)** | Mobile users don't print; saves space; prevents confusion |
| **Device detection first** | More accurate than pixel breakpoints; touch capability = UX truth |
| **Fallback: Desktop layout** | Conservative; prevents mobile layout on resized desktop browser |

---

## Testing Checklist (Manual)

- [ ] Phone portrait (375×667): list view, bottom tab bar, no theme/user menu in header
- [ ] Phone landscape (667×375): 2-column KPI grid (or still list?), bottom tab bar
- [ ] Tablet portrait (768×1024): collapsed sidebar, 2×2 filter grid, 2-col dashboard
- [ ] Tablet landscape (1024×768): collapsed sidebar, 2-col KPI grid, gantt available
- [ ] Desktop (1920×1080): expanded sidebar, inline filter bar, 3-col dashboard, gantt default
- [ ] Touch desktop (1920×1080, touchscreen): desktop layout (≥1280px), tablet components NOT activated
- [ ] Resize desktop browser <768px: still defaults to **desktop layout** (not mobile)
- [ ] Flight board list view: sortable, tap to detail drawer, full responsive
- [ ] Dashboard graphs on top (phone): Natural scroll → graphs → cards → table
- [ ] Print button: visible on desktop/tablet, hidden on phone
- [ ] Theme toggle: visible in desktop header, **in menu sheet on phone**
- [ ] User menu: in desktop header, **in menu sheet on phone**

---

## Next Steps (For Sonnet/Opus)

1. Review PLAN_DEVICE_DETECTION.md (Phases 1–4)
2. Implement Phase 1–4 in order
3. Run test checklist
4. Create commit: `feat(ux): implement device detection + mobile-first navigation (D-061, D-062)`
5. PR to `dev`

**Estimated effort**: 6–8 hours
**Priority**: Medium (UX improvement, non-breaking)
**Version bump**: MINOR (v0.x → v0.(x+1))

