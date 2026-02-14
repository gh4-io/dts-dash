# UI Reference Map

> **What changed and why (2026-02-13):** Created from photo-driven UI reconciliation pass. Maps 12 reference images to layout decisions, interaction patterns, and visual style targets. This document is the bridge between "what we saw" and "what we build."

---

## Image Inventory

| # | File | Source | What It Shows |
|---|------|--------|---------------|
| 1 | `airways...92_7659181647171_____.png` | CargoJet APEX Page 92 | Flight Board — Gantt timeline with filters |
| 2 | `neutral.webp` | Fumadocs docs site | Theme reference — neutral dark preset |
| 3 | `Screenshot 2026-02-13 160608.png` | CVG Line Maintenance (small) | Dashboard — KPIs + charts + Gantt (dark theme) |
| 4 | `Screenshot 2026-02-13 160647.png` | CVG Line Maintenance (large) | Dashboard — same as #3, full resolution |
| 5 | `Screenshot 2026-02-13 160730.png` | Network monitoring dashboard | Style reference — crisp cards, dense data, interactive tooltips |
| 6 | `Screenshot 2026-02-13 164027.png` | CargoJet APEX — Open Tasks | Actions dropdown menu pattern |
| 7 | `Screenshot 2026-02-13 164039.png` | CargoJet APEX — Open Tasks | Actions dropdown + secondary nested menu |
| 8 | `airways...(1).png` | CargoJet APEX — filter chip | "Row Filter" active filter pill |
| 9 | `airways...(2).png` | CargoJet APEX — filter chip | "Scheduled" active filter pill |
| 10 | `airways...(3).png` | CargoJet APEX — filter chip | "Fleet #" active filter pill |
| 11 | `airways...(4).png` | CargoJet APEX — toolbar | Search bar + workload dropdown + Actions |
| 12 | `airways...14011313998446___45__.png` | CargoJet APEX — filter dialog | Column/Operator/Expression filter modal |

---

## What Each Image Proves

### Image 1: CargoJet Flight Board (Gantt)
**Layout elements:**
- Left sidebar navigation (collapsible, icon + text labels)
- Top filter row: Start Date, End Date, Airport dropdown, UTC/Local toggle
- Right toolbar: "Refresh Sched" button, JSON export, navigation arrows, fullscreen, logout
- Full-width Gantt: Y-axis = fleet numbers (NNN-RRRR), X-axis = days (Sat–Thu)
- Day-boundary vertical lines, hourly grid marks
- Color coding: green bars (majority), cyan/light blue bars (different status/customer)

**Interaction patterns:**
- Filter row is compact — single row, always visible
- No "Apply" button — filters appear to update immediately
- "Refresh Sched" explicit refresh action

**Visual style:**
- White/light background for the Gantt area
- Minimal chrome, lots of white space in the grid
- Fleet numbers left-aligned, small font
- Bars are solid fill with subtle dark borders

### Images 3 & 4: CVG Line Maintenance Dashboard (OUR TARGET)
**This is the existing CVG dashboard — the primary layout reference.**

**Layout elements (top to bottom, left to right):**
- Header: "CVG Line Maintenance" title + date ("Friday, February 13, 2026") + status dots (green/gray)
- KPI cards (left column, stacked):
  - "Average Ground Time" — split <24h / >24h with HH:MM values
  - "Scheduled Man Hours" — horizontal bar chart by customer (all 6 customers visible)
  - "Total Aircraft Fri–Mon" — large number (42 / 69)
  - "Total Aircraft By Type" — B777-13, B767-22, B747-0, B737-0
- Combined bar+line chart (center):
  - Blue bars = Arrivals, Pink/red bars = Departures, Yellow line = On Ground count
  - X-axis = hourly (7:00 AM through multi-day), day labels across top (FRIDAY, SATURDAY, SUNDAY)
  - Dashed vertical lines at midnight boundaries
  - Legend below chart: "Arrivals | Departures | On Ground"
- Donut chart (top right): "Aircraft By Customer" — colored segments with percentage labels
- Gantt timeline (bottom half):
  - Y-axis = aircraft registrations (C-FOIJ, N774CK, etc.)
  - X-axis = time (7:00 through 7:00, multi-day)
  - Bars colored by customer (green, dark green, purple, magenta, cyan)
  - Registration text labels ON the bars
  - Timeline at bottom with hour marks

**Visual style:**
- Dark navy/black background (#0a0a1a range)
- KPI cards have medium-blue backgrounds (#1a1a4a range), no visible borders
- Large bold numbers in KPI cards
- Crisp typography: large display numbers, smaller labels
- Customer colors are vivid against the dark background
- Dense layout — maximizes data per viewport

**Interaction patterns (inferred):**
- Operator click → cross-filter (confirmed by user, D-021)
- Tooltip on hover for chart data points and Gantt bars
- Day labels function as visual anchors across the timeline

### Image 5: Network Dashboard (Style Reference)
**Visual style goals to replicate:**
- Crisp cards with clean borders and subtle shadows
- High data density without visual clutter
- Interactive tooltips with detailed breakdowns (date range, multiple metrics)
- Multiple metric types coexisting (line charts, bar charts, status indicators, tables)
- KPI row across the top (compact, high-contrast numbers)
- Professional, modern aesthetic

### Image 2: Fumadocs — Neutral Theme
**Theme reference:**
- Dark mode: near-black background, slightly lighter card surfaces, subtle borders
- Sidebar: dark background, active item highlighted with accent background
- Accent color: muted blue (steel blue range)
- Typography: clean, good line-height, readable at all sizes
- Cards: slightly elevated from background with 1px borders
- Bottom-left: theme toggle (sun/moon icons) + locale toggle
- Search bar with keyboard shortcut badge

### Images 6 & 7: CargoJet Tasks — Actions Menu
**Menu patterns:**
- "Actions" dropdown button (top-right of toolbar area)
- Menu items with icons (left-aligned): Select Columns, Filter, Rows Per Page (→ submenu), Format (→ submenu), Flashback, Save Report, Reset, Help, Download
- Secondary context menu (from column headers): Sort, Control Break, Highlight, Compute, Aggregate, Chart, Group By
- Clean white dropdown on light background, no dividers between groups

**For our app:** Adapt as admin/data table action patterns, NOT for the main filter bar.

### Images 8–10: CargoJet Filter Chips
**Active filter display:**
- Checkbox + colored icon + label text + X dismiss button
- Compact pill/badge format inline in the toolbar
- Each filter is independently dismissible

**For our app:** Similar to shadcn/ui Badge with dismiss — used for showing active filter state.

### Image 11: CargoJet Toolbar
**Toolbar layout:**
- Search icon dropdown + text input + Go button + workload selector dropdown + Actions dropdown
- Compact, single-row, left-to-right flow

### Image 12: CargoJet Filter Dialog
**Column/Operator/Expression pattern:**
- Modal dialog with "Filter" header + close X
- Two tabs: "Column" | "Row"
- Three-field form: Column (dropdown), Operator (dropdown, e.g., "="), Expression (text input with suggestions)
- Footer: Cancel | Delete | Apply (primary button)

**For our app:** Reference only. Our FilterBar uses direct controls (date pickers, multi-selects), not a modal dialog. However, this pattern could be useful for vNext advanced filtering.

---

## Do / Don't List

### DO
- Replicate the **CVG Line Maintenance Dashboard** layout (images 3/4) — it's the user's actual operational dashboard
- Use the same KPI card arrangement: left column stacked, combined chart center, donut top-right
- Put the Gantt timeline below the dashboard charts (confirmed by images 3/4)
- Show registration text labels on Gantt bars (confirmed by image 4)
- Use day-boundary vertical dashed lines in both the combined chart and Gantt
- Keep the filter row compact and always-visible on desktop (confirmed by image 1)
- Apply customer colors consistently across all chart types (confirmed by all dashboard images)
- Use dark theme as default — the CVG dashboard is dark navy/black (images 3/4)
- Use crisp, high-contrast KPI numbers against dark card backgrounds
- Add a "Refresh" action (confirmed by image 1 "Refresh Sched" button)
- Support interactive tooltips with detailed data (confirmed by image 5 style)
- Display active filters as dismissible pills/badges (confirmed by images 8-10)

### DON'T
- Don't implement the Column/Operator/Expression filter dialog (image 12) — it's an Oracle APEX pattern. Our FilterBar uses direct controls. (vNext consideration only)
- Don't replicate CargoJet's light-background Gantt (image 1) — our dashboard uses dark theme
- Don't add the CargoJet sidebar navigation style — we use our own sidebar per REQ_UI_Interactions.md
- Don't add "Flashback" or "Save Report" features from the Actions menu — not in scope
- Don't add fleet number (NNN-RRRR) formatting — we use aircraft registrations directly
- Don't assume the network dashboard layout (image 5) — it's a style reference only, not a layout reference
- Don't over-engineer chart interactions beyond what's shown — hover tooltips and click-to-focus are sufficient

---

## Cross-References

| Spec | What This Map Informs |
|------|----------------------|
| [REQ_FlightBoard.md](../SPECS/REQ_FlightBoard.md) | Gantt layout, bar styling, labels, day separators |
| [REQ_Dashboard_UI.md](../SPECS/REQ_Dashboard_UI.md) | Dashboard page layout, KPI card arrangement, chart types |
| [REQ_Filters.md](../SPECS/REQ_Filters.md) | Filter row layout, instant vs apply, active filter display |
| [REQ_Themes.md](../SPECS/REQ_Themes.md) | Dark theme as default, neutral palette, Fumadocs presets |
| [UI_FILTER_PATTERNS.md](UI_FILTER_PATTERNS.md) | Filter component patterns, mobile sheet |
| [UI_MENUS.md](UI_MENUS.md) | Action menus, user dropdown, nested menus |
