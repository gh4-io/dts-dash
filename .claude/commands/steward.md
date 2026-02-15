---
description: Run the Project Steward session workflow (review OPEN_ITEMS, check docs, validate touchpoints)
allowed-tools: Read, Glob, Grep, Edit, Write, Bash
---

Read and follow the Project Steward skill at `.claude/SKILLS/PROJECT_STEWARD.md`.

Execute the session workflow:

1. Read `./CLAUDE.md` and `.claude/README.md`
2. Read `.claude/OPEN_ITEMS.md` — for each open/updated item: Resolve, Defer, or Clarify
3. Read `.claude/ROADMAP.md` for current milestone focus
4. Report: list any open OIs, blockers, or items needing attention
5. If this is end-of-session (user says "wrap up" or "end session"), update OPEN_ITEMS.md with any new items, resolved items, and cross-links

Follow the non-negotiable rules, authority chain, and file touchpoint matrix defined in PROJECT_STEWARD.md.

$ARGUMENTS
