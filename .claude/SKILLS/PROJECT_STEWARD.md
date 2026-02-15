---
name: project-steward
description: Enforces session workflow, doc authority chain, and change discipline for the CVG Dashboard project. Runs at session start and before session end to review OPEN_ITEMS.md, validate doc updates, and trigger commits per AUTO_COMMIT_POLICY.md.
---

<objective>
Ensure every Claude Code session on this project follows a repeatable discipline:
read canonical docs first, review open items, make changes traceable, keep docs authoritative,
and commit atomically after major phases. This skill encodes the operating rules so they survive
context resets and don't need re-explaining in chat.
</objective>

<quick_start>
**At session start, run this sequence:**

1. Read `./CLAUDE.md` (root operating manual)
2. Read `.claude/README.md` (knowledge base index)
3. Read `.claude/OPEN_ITEMS.md` — for each open/updated item: **Resolve**, **Defer**, or **Clarify** (create new OIs as needed)
4. Read `.claude/ROADMAP.md` for current milestone focus
5. Read the relevant spec(s) in `.claude/SPECS/` for the planned work

**Before session end, run this sequence:**

1. Re-read `.claude/OPEN_ITEMS.md`
2. Update statuses, next actions, and cross-links for any OIs touched
3. Add new OIs for anything discovered but unresolved
4. If a major change occurred, run `scripts/phase_commit.sh`
</quick_start>

<non_negotiable_rules>
**EVERY SESSION: Review OPEN_ITEMS.md first, and before finishing; update statuses, add new OIs, and link each OI to the spec/decision/risk it touches.**

1. **Canonical docs first** — Always read `./CLAUDE.md` and `.claude/README.md` before planning or coding. Never rely on chat memory for project rules.

2. **OPEN_ITEMS review loop** — Runs twice per session (start + end). Every OI must have: Type, Status, Priority, Owner, Context, Links. New OIs get the next sequential ID (OI-###).

3. **Atomic docs** — Major ideas, feature requests, and design decisions live as atomic markdown files in `.claude/` (SPECS/, DEV/, UI/). Each file covers one topic. Cross-link from `.claude/README.md`.

4. **No implied functionality** — If something is a stub, label it "Coming Soon" with a disabled UI state. Do not create server endpoints, API routes, or data models for stub features.

5. **Local-first** — No cloud dependency required to run the app. All data, auth, and config use local SQLite + filesystem.

6. **UI constraints** (immutable):
   - Global FilterBar: Start, End, Station (CVG locked), Timezone (UTC + America/New_York only), Operator, Aircraft, Type
   - Filter state persists in URL querystring; Reset button; validate start <= end
   - Customer colors are admin-configurable (DB-backed), never hardcoded
   - Font Awesome is self-hosted at `public/vendor/fontawesome/`
</non_negotiable_rules>

<authority_chain>
**Read order matters.** Later files may refine earlier ones, but never contradict them without a logged decision.

```
1. ./CLAUDE.md                    (root — links to everything, never duplicates spec content)
2. .claude/README.md              (index — structure, rules, relationships)
3. .claude/DECISIONS.md           (append-only — D-### entries, rationale + links)
4. .claude/OPEN_ITEMS.md          (living — OI-### entries, statuses cycle)
5. .claude/ROADMAP.md             (milestone status — acceptance criteria)
6. .claude/PLAN.md                (authoritative build plan — task breakdown)
7. .claude/SPECS/REQ_*.md         (feature specs — one topic per file)
8. .claude/UI/UI_*.md             (UI patterns — components, icons, filters, menus)
9. .claude/DEV/DEV_*.md           (dev standards, commands, test plan, risks)
10. .claude/SKILLS/*.md           (operational skills — this file + AUTO_COMMIT_POLICY)
```

If a spec and a decision conflict, the **decision** (DECISIONS.md) wins — it represents a confirmed choice. If an open item contradicts a decision, escalate to user.
</authority_chain>

<change_definitions>
These definitions determine what triggers doc updates, commits, and OI entries.

**Major change** — Any of the following:
- New page/route added or removed
- New API endpoint added or removed
- Database schema change (new table, new column, altered constraint)
- Authentication or authorization logic change
- Shift in architectural pattern (e.g., switching a library, adding a provider)
- Breaking change to an existing component's public interface

**Phase completion** — A milestone (M#) reaches all its acceptance criteria in ROADMAP.md. Confirmed by: build passes, lint clean, dev server runs, acceptance checklist checked off.

**Spec change** — Any modification to a file in `.claude/SPECS/`, `.claude/UI/`, or `.claude/DEV/`. Includes new files, content edits, or deprecation notices.

**Implementation change** — Code change in `src/` that alters observable behavior (not whitespace, not comment-only). Includes: new components, modified business logic, API route changes, schema migrations, style changes that affect layout.
</change_definitions>

<decision_rubric>
When to update each doc:

**`.claude/DECISIONS.md`** — Update when:
- A confirmed choice is made between alternatives (library, pattern, data model)
- A prior decision is superseded (link to the new one)
- A user explicitly confirms a direction that was ambiguous
- Format: `D-###` with date, decision, rationale, supersedes, links

**`.claude/DEV/RISKS.md`** — Update when:
- A new technical risk is identified (likelihood + impact + mitigation)
- An existing risk materializes or is resolved
- A mitigation strategy changes
- Format: `R##` in Active Risks table or Resolved Risks table

**`.claude/OPEN_ITEMS.md`** — Update when:
- A question, gap, or blocker is discovered
- An existing OI changes status (Open → Updated → Resolved / Acknowledged)
- A milestone completes (add milestone OI)
- Format: `OI-###` with Type, Status, Priority, Owner, Context, Resolution, Links
- **Update summary table** at the bottom after any status change

**`.claude/ROADMAP.md`** — Update when:
- A milestone's acceptance criteria status changes
- A new milestone is added or scope changes
- Current focus shifts

**`.claude/PLAN.md`** — Update when:
- Task breakdown changes for a milestone
- New tasks are discovered mid-milestone
- Task ordering or dependencies change
- A milestone scope is adjusted (with a D-### decision)
</decision_rubric>

<file_touchpoint_matrix>
When code in these directories changes, the corresponding docs **must** be reviewed and updated if stale:

| Source directory | Required doc review |
|-----------------|-------------------|
| `src/components/shared/FilterBar*` | `.claude/SPECS/REQ_Filters.md`, `UI_FILTER_PATTERNS.md` |
| `src/components/flight-board/*` | `.claude/SPECS/REQ_FlightBoard.md` |
| `src/components/dashboard/*` | `.claude/SPECS/REQ_Dashboard_UI.md`, `REQ_Analytics.md` |
| `src/components/capacity/*` | `.claude/SPECS/REQ_OtherPages.md` |
| `src/components/admin/*` | `.claude/SPECS/REQ_Admin.md` |
| `src/components/account/*` | `.claude/SPECS/REQ_Account.md` |
| `src/app/admin/import/*` | `.claude/SPECS/REQ_DataImport.md` |
| `src/app/admin/aircraft-types/*` | `.claude/SPECS/REQ_AircraftTypes.md` |
| `src/lib/auth*` | `.claude/SPECS/REQ_Auth.md` |
| `src/lib/db/schema*` | `.claude/SPECS/REQ_DataModel.md` |
| `src/app/api/*` | `.claude/SPECS/REQ_DataSources.md` |
| `src/lib/data/*` | `.claude/SPECS/REQ_DataModel.md`, `REQ_DataSources.md` |
| `src/components/ui/*` (new) | `.claude/UI/UI_COMPONENTS.md` |
| `globals.css` / theme files | `.claude/SPECS/REQ_Themes.md` |

"Review" means: read the doc, confirm it still accurately describes the code. If not, update the doc. If the change is intentional and represents a new direction, log a decision in DECISIONS.md.
</file_touchpoint_matrix>

<commit_workflow>
After completing work that qualifies as a major change or phase completion:

1. Verify gates: `npm run lint` + `npm run build` must pass
2. Verify docs updated per the file touchpoint matrix
3. Run `scripts/phase_commit.sh` OR commit manually following [AUTO_COMMIT_POLICY.md](AUTO_COMMIT_POLICY.md)
4. If gates fail, fix issues before committing. Never commit broken code unless explicitly flagged as WIP.

See [AUTO_COMMIT_POLICY.md](AUTO_COMMIT_POLICY.md) for full commit policy.
</commit_workflow>

<success_criteria>
A session is well-stewarded when:
- OPEN_ITEMS.md was reviewed at start and updated at end
- All code changes have corresponding doc reviews per the touchpoint matrix
- New decisions are logged with rationale and links
- New risks are captured with likelihood, impact, and mitigation
- Commits follow the conventional commit format with required footers
- No implied functionality — stubs are clearly labeled
- Build and lint pass at session end
</success_criteria>
