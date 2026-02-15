# .claude/ Knowledge Base

> **What changed and why (2026-02-13):** UI Reconciliation Pass added REQ_Dashboard_UI.md, REQ_Themes.md, UI_REFERENCE_MAP.md, UI_MENUS.md. Updated REQ_FlightBoard.md, REQ_Filters.md, UI_FILTER_PATTERNS.md. Decisions D-001–D-024. PASS 2 earlier added PLAN.md, REQ_AircraftTypes.md, REQ_DataImport.md.

This directory is the **living specification** for the CVG Line Maintenance Operations Dashboard. Claude Code reads this at the start of every session.

## Structure

```
.claude/
  README.md              ← You are here
  PROJECT_CONTEXT.md     ← What this project is, who it's for, domain glossary
  PLAN.md                ← Implementation plan (PASS 2) — authoritative build plan
  ROADMAP.md             ← Milestones M0–M8, current focus, acceptance criteria
  DECISIONS.md           ← Chronological decision log (append-only, D-001–D-024)
  OPEN_ITEMS.md          ← Tracked questions, gaps, risks, blockers (OI-001+)
  GLOSSARY.md            ← Domain terms and abbreviations
  CLAUDE_MEMORY.md       ← DEPRECATED; superseded by this structure
  SPECS/
    REQ_Filters.md       ← Global filter bar: 7 fields, defaults, validation, URL params
    REQ_FlightBoard.md   ← Flight Board page spec (ECharts Gantt, tooltips, zoom)
    REQ_OtherPages.md    ← Dashboard, Capacity, Settings page specs
    REQ_DataModel.md     ← TypeScript types, schemas, transformations
    REQ_DataSources.md   ← SharePoint OData, HAR analysis, API routes
    REQ_UI_Interactions.md ← Cross-page behaviors, responsiveness, state management
    REQ_Auth.md          ← Authentication, roles, sessions, login page
    REQ_Account.md       ← Account page (profile, preferences, security)
    REQ_Admin.md         ← Admin section (customers, users, settings, audit)
    REQ_Analytics.md     ← Analytics plan — 24 KPIs, event tracking, two-layer model
    REQ_AircraftTypes.md ← Aircraft type normalization — mapping, seed data, admin UI
    REQ_Dashboard_UI.md  ← Dashboard page layout, KPI cards, charts, cross-filtering
    REQ_Themes.md        ← Theme system — 11 Fumadocs presets, light/dark, CSS tokens
    REQ_DataImport.md    ← Data import — file upload, paste JSON, vNext POST
    REQ_Permissions.md   ← SUPERSEDED by REQ_Auth.md (retained as historical reference)
    REQ_Logging_Audit.md ← Error handling, logging, import stats
  UI/
    UI_COMPONENTS.md     ← Component inventory and shadcn/ui usage
    UI_ICONS_FontAwesome.md ← FA setup, icon mapping, build notes
    UI_FILTER_PATTERNS.md ← Reusable filter component patterns, active pills
    UI_REFERENCE_MAP.md  ← 12 reference images mapped to layout/style decisions
    UI_MENUS.md          ← Dropdown, sidebar, admin nav menu patterns
  DEV/
    DEV_STANDARDS.md     ← Code conventions, naming, file structure
    DEV_COMMANDS.md      ← Build, dev, lint, test commands
    TEST_PLAN.md         ← Testing strategy, smoke tests, verification
    RISKS.md             ← Technical risks R1–R19 and mitigations
  SKILLS/
    PROJECT_STEWARD.md   ← Session workflow, doc authority, change discipline
    AUTO_COMMIT_POLICY.md ← Commit triggers, message format, verification gates
  assets/                ← Reference images, sample data
    input.json           ← SharePoint OData export (86 records)
    img/                 ← Design reference screenshots
  *.har                  ← Network captures from CargoJet system (reference only)
```

## Rules

1. **No duplication**: Each fact lives in one file. Others link to it.
2. **Atomic docs**: One topic per file. If a doc exceeds 200 lines, split it.
3. **Always current**: Update the right doc when new context arrives.
4. **Decisions logged**: Every confirmed choice gets an entry in `DECISIONS.md`.
5. **Open items tracked**: Every unknown gets an entry in `OPEN_ITEMS.md`.

## Relationship to Other Files

- `/CLAUDE.md` — Root operating manual. Links here for details; never duplicates spec content.
- `.claude/PLAN.md` — Authoritative implementation plan (PASS 2). Governs build order and milestones.
- `/plan/FINAL-PLAN.md` — Prior implementation plan (retained as reference; superseded by PLAN.md).
- `/plan/PLAN-AMENDMENT-001-FILTER-BAR.md` — FilterBar integration plan (integrated into PLAN.md M2).
