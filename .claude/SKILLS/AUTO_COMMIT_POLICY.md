---
name: auto-commit-policy
description: Defines commit triggers, message format, staging requirements, and verification gates for the CVG Dashboard project. Referenced by PROJECT_STEWARD.md and scripts/phase_commit.sh.
---

<objective>
Ensure every commit is atomic, descriptive, and traceable. Commits happen at defined trigger points,
follow conventional commit format, include metadata footers for phase tracking, and never land on
a broken build.
</objective>

<commit_triggers>
Commits are required after each of the following events:

**Doc pass** (prefix: `docs:`)
- Spec files created or updated in `.claude/SPECS/`
- UI docs created or updated in `.claude/UI/`
- DEV docs created or updated in `.claude/DEV/`
- DECISIONS.md, OPEN_ITEMS.md, ROADMAP.md, or PLAN.md updated
- CLAUDE.md updated

**Scaffold / setup** (prefix: `chore:`)
- Project initialization (`create-next-app`, dependency install)
- New directory structure created
- Configuration files added or changed (`next.config.*`, `tsconfig.json`, `tailwind.config.*`)
- Seed script changes
- Build tooling changes

**Milestone acceptance gate** (prefix: `feat:` or milestone-specific)
- A milestone's acceptance criteria are all met
- Build + lint pass
- Milestone OI entry added to OPEN_ITEMS.md
- ROADMAP.md updated to reflect completion

**Schema / DB migration** (prefix: `feat:` or `chore:`)
- New table, column, or constraint added to Drizzle schema
- Seed data changed
- Migration script run

**Core UI component change** (prefix: `feat:`, `fix:`, or `refactor:`)
- FilterBar: any change to filter fields, URL sync, validation
- Flight Board: Gantt rendering, tooltip, zoom, detail drawer
- Admin settings: customer colors, user management, import workflow
- Theme system: preset additions, CSS token changes
- Layout: sidebar, header, mobile nav

**Bug fix** (prefix: `fix:`)
- Any fix that resolves a reported or discovered defect
- Include the symptom and root cause in the commit body
</commit_triggers>

<commit_format>
**Conventional Commits** — all commits follow this structure:

```
<type>(<optional-scope>): <imperative summary, max 72 chars>

<optional body — what changed and why, wrapped at 72 chars>

Milestone: M#
Docs: <list of changed doc files, comma-separated>
OpenItems: <OI-### added or closed, comma-separated>
Risk/Decision: <R## or D-### updated, comma-separated>
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Types** (required):
| Type | When |
|------|------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation-only change |
| `chore` | Build, config, tooling, deps |
| `refactor` | Code restructuring with no behavior change |
| `style` | Formatting, whitespace (no logic change) |
| `test` | Adding or updating tests |

**Scope** (optional but recommended):
- `filter-bar`, `flight-board`, `dashboard`, `capacity`, `admin`, `account`, `auth`, `db`, `api`, `theme`, `layout`

**Footer rules:**
- `Milestone:` — Required for phase completion commits; omit for minor changes
- `Docs:` — Required if any `.claude/` file was modified; list relative paths
- `OpenItems:` — Required if any OI was added, updated, or resolved
- `Risk/Decision:` — Required if any R## or D-### was added or updated
- `Co-Authored-By:` — Always include on commits made with Claude assistance
- Omit footer lines that don't apply (don't include empty `Milestone:` lines)
</commit_format>

<staging_requirements>
Before `git commit`, verify:

1. **Docs updated** — If code in `src/` changed, the corresponding spec/UI doc was reviewed per [PROJECT_STEWARD.md](PROJECT_STEWARD.md) file touchpoint matrix
2. **OPEN_ITEMS.md current** — Any new questions, risks, or resolutions are recorded
3. **No secrets** — No `.env`, credentials, or API keys staged
4. **No generated files** — `.next/`, `node_modules/`, `*.db` not staged (should be in `.gitignore`)
5. **Verification gates passed** — See below
</staging_requirements>

<verification_gates>
**Required before every commit:**

```bash
npm run lint     # Must exit 0, no warnings
npm run build    # Must exit 0, no errors
```

**Recommended (not blocking):**

```bash
npm run dev      # Smoke test: pages render, no console errors
```

**Gate failure protocol:**
- If `lint` fails: fix lint issues, re-stage, re-commit
- If `build` fails: fix build errors, re-stage, re-commit
- Never bypass gates with `--no-verify` unless explicitly flagged as WIP commit
- WIP commits must use type `chore(wip):` and include `[WIP]` in the summary
</verification_gates>

<no_commit_if_broken>
**The golden rule: never commit code that breaks build or lint.**

If you cannot fix a build/lint failure before session end:
1. Stash changes: `git stash push -m "WIP: <description>"`
2. Log a new OI in OPEN_ITEMS.md describing the broken state
3. Do NOT commit broken code to `dev` or `main`

Exception: Explicit WIP commits using `chore(wip): [WIP] <description>` are allowed **only** when the user explicitly requests it. These must be amended or squashed before merging to `main`.
</no_commit_if_broken>

<examples>
**Milestone completion:**
```
feat: Complete M7 — aircraft type editor and data import

Aircraft type editor: CRUD with pattern matching, test input, reset defaults.
Data import: file upload + paste JSON, validate/preview/commit workflow,
import history with pagination.

Milestone: M7
Docs: .claude/SPECS/REQ_AircraftTypes.md, .claude/SPECS/REQ_DataImport.md
OpenItems: OI-028 resolved
Risk/Decision: D-015, D-016
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Doc-only update:**
```
docs: Add Project Steward skill and auto-commit policy

New files: .claude/SKILLS/PROJECT_STEWARD.md, AUTO_COMMIT_POLICY.md
Updated: CLAUDE.md (steward section), .claude/README.md (SKILLS/ in structure)

Docs: .claude/SKILLS/PROJECT_STEWARD.md, .claude/SKILLS/AUTO_COMMIT_POLICY.md, CLAUDE.md, .claude/README.md
OpenItems: OI-030 added
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Bug fix:**
```
fix(flight-board): Correct utilization threshold colors and hydration mismatch

Symptom: Utilization bars showed green at 90% capacity.
Root cause: Threshold constants were inverted (green > 80, red < 60).
Also fixed hydration mismatch from timezone-dependent date rendering.

Docs: .claude/SPECS/REQ_FlightBoard.md
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
</examples>

<success_criteria>
A commit follows this policy when:
- Type prefix matches the change category
- Summary is imperative mood, under 72 characters
- Applicable footer lines are present and accurate
- Verification gates (lint + build) passed before commit
- No broken code committed without explicit WIP flag
- Changed docs match the file touchpoint matrix
</success_criteria>
