---
description: Generate a conventional commit following the Auto Commit Policy (verification gates + doc-touch checks)
allowed-tools: Read, Grep, Glob, Bash
---

Read and follow the Auto Commit Policy at `.claude/SKILLS/AUTO_COMMIT_POLICY.md`.

Execute these steps:

1. Run `npm run lint` — must pass
2. Run `npm run build` — must pass
3. Check which files changed (`git status`, `git diff --name-only`)
4. Cross-reference against the file touchpoint matrix in `.claude/SKILLS/PROJECT_STEWARD.md` — warn if docs need updating
5. Determine the correct conventional commit type (feat/fix/docs/chore/refactor/style/test) and scope
6. Generate a commit message with required footers (Milestone, Docs, OpenItems, Risk/Decision as applicable)
7. Show the proposed commit message and ask for confirmation before committing
8. Stage and commit if approved

$ARGUMENTS
