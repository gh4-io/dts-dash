# Versioning & Release Process

> **Decision**: D-028 — Semantic Versioning with backwards compatibility rules
> **Current version**: 0.1.0

## Semantic Versioning Rules

This project follows [Semantic Versioning 2.0.0](https://semver.org/). The version format is `MAJOR.MINOR.PATCH`.

### PATCH (0.1.x) — Bug Fixes

Increment PATCH when making backwards-compatible bug fixes.

**What qualifies:**
- Bug fix that corrects incorrect behavior
- Security patch that doesn't change API shape
- Typo or cosmetic fix in UI
- Performance improvement with no behavior change
- Dependency update (non-breaking)

**What does NOT qualify:**
- Adding a new API endpoint (that's MINOR)
- Changing the response shape of an existing endpoint (that's MINOR or MAJOR)
- Adding a new UI page or feature (that's MINOR)

**Example**: `0.1.0` → `0.1.1`

### MINOR (0.x.0) — New Features

Increment MINOR when adding backwards-compatible functionality.

**What qualifies:**
- New API endpoint
- New UI page or component
- New configuration option (with sensible default)
- New database table or column (with default/nullable — no migration breakage)
- New optional environment variable
- Deprecating existing functionality (still works, but marked for removal)

**What does NOT qualify:**
- Removing an existing API endpoint (that's MAJOR)
- Changing required environment variables (that's MAJOR)
- Changing database schema in a way that breaks existing data (that's MAJOR)

**Example**: `0.1.3` → `0.2.0` (resets PATCH to 0)

### MAJOR (x.0.0) — Breaking Changes

Increment MAJOR when making backwards-incompatible changes.

**What qualifies:**
- Removing or renaming an API endpoint
- Changing the required fields in an API request/response
- Removing or renaming an environment variable that was required
- Database migration that requires manual intervention or data loss
- Removing a UI feature or page
- Changing authentication/authorization behavior
- Dropping support for a Node.js version

**Example**: `0.2.5` → `1.0.0` (resets MINOR and PATCH to 0)

---

## Backwards Compatibility Contract

### API Endpoints

| Rule | Enforcement |
|------|-------------|
| Do not remove existing endpoints | MAJOR version required |
| Do not rename endpoint paths | MAJOR version required |
| Do not remove fields from response bodies | MAJOR version required |
| New optional fields in request bodies | MINOR (safe) |
| New fields in response bodies | MINOR (safe) |
| New endpoints | MINOR (safe) |

### Database Schema

| Rule | Enforcement |
|------|-------------|
| New tables | MINOR (safe — no impact on existing data) |
| New nullable columns | MINOR (safe — existing rows get NULL) |
| New columns with defaults | MINOR (safe — existing rows get default) |
| Removing columns | MAJOR (breaks queries referencing them) |
| Renaming columns | MAJOR (breaks queries referencing them) |
| Changing column types | MAJOR (may corrupt data) |
| Adding NOT NULL without default | MAJOR (breaks existing rows) |

### Environment Variables

| Rule | Enforcement |
|------|-------------|
| New optional env var with default | MINOR (safe) |
| New required env var | MAJOR (breaks existing deployments) |
| Removing env var | MAJOR (breaks configs referencing it) |
| Renaming env var | MAJOR (breaks configs referencing it) |

### Configuration Files

| Rule | Enforcement |
|------|-------------|
| New config key in `app_config` with default | MINOR (safe — seeded idempotently) |
| Removing config key | MAJOR (breaks UI/logic referencing it) |
| Changing config key semantics | MAJOR (existing values may be invalid) |

---

## Breaking Change Notification Protocol

When working on `dev`, Claude Code must:

1. **Before implementing**: Check if the change is backwards-incompatible per the rules above
2. **If breaking**: Stop and notify the user with:
   - What the breaking change is
   - Which compatibility rule it violates
   - What version increment is required (MINOR → MAJOR)
   - Suggested non-breaking alternative (if one exists)
3. **If approved**: Log the breaking change in OPEN_ITEMS.md with `[BREAKING]` tag and the target version
4. **At release time**: All `[BREAKING]` items require MAJOR version bump

**Example notification:**
```
BREAKING CHANGE DETECTED:
  Change: Removing `GET /api/config` endpoint
  Rule violated: "Do not remove existing endpoints"
  Required: MAJOR version increment (0.x.0 → 1.0.0)
  Alternative: Deprecate with warning header, remove in next MAJOR
```

---

## Release Procedures

All releases follow the same branch-from-master pattern established in v0.1.0.

### Patch Release (e.g., 0.1.1)

```bash
# 1. Ensure fix is committed and tested on dev
# 2. Branch from master
git checkout master && git pull
git checkout -b release/v0.1.1

# 3. Cherry-pick the fix(es) from dev
git cherry-pick <commit-hash>

# 4. Strip any dev artifacts that came along
# 5. Bump version in package.json
npm version patch --no-git-tag-version

# 6. Verify
npm run build && npm run lint

# 7. Commit, push, PR
git add -A
git commit -m "fix: <description> (v0.1.1)"
git push origin release/v0.1.1
gh pr create --base master --title "release: v0.1.1" --body "..."

# 8. After merge — tag and release
git checkout master && git pull
git tag -a v0.1.1 -m "v0.1.1: <description>"
git push origin v0.1.1
gh release create v0.1.1 --title "v0.1.1" --generate-notes
```

### Minor Release (e.g., 0.2.0)

Same as patch, but:
- Cherry-pick or diff/apply all feature commits since last release
- Use `npm version minor --no-git-tag-version`
- Commit message: `feat: <description> (v0.2.0)`
- Review all changes for backwards compatibility before creating PR

### Major Release (e.g., 1.0.0)

Same as minor, but:
- Use `npm version major --no-git-tag-version`
- Commit message: `feat!: <description> (v1.0.0)` (note the `!`)
- Release notes MUST include a **Migration Guide** section documenting:
  - What broke
  - How to update configuration/data
  - Step-by-step upgrade instructions

---

## Pre-Release / Release Candidates

For significant releases, use pre-release tags:

```bash
# RC1
npm version prerelease --preid=rc --no-git-tag-version  # 0.2.0-rc.1
git tag -a v0.2.0-rc.1 -m "v0.2.0-rc.1"
gh release create v0.2.0-rc.1 --prerelease --title "v0.2.0-rc.1" --generate-notes

# RC2 (if issues found)
npm version prerelease --preid=rc --no-git-tag-version  # 0.2.0-rc.2

# Final
npm version minor --no-git-tag-version  # 0.2.0
```

---

## Version Tracking

The canonical version lives in `package.json`. It is updated on the release branch only, never on `dev`. The `dev` branch always reflects the *next unreleased* state — its package.json version represents what was last released, not what's in progress.

### Where version appears:
- `package.json` → `version` field
- Health check response → `version` field (reads from package.json)
- GitHub Release → tag name
- Docker image tag → from CI/CD metadata action

---

## Checklist — Every Release

- [ ] All changes are backwards-compatible for the version type (patch/minor), or MAJOR is bumped
- [ ] No `[BREAKING]` items in OPEN_ITEMS.md unless releasing a MAJOR
- [ ] `npm run build` passes on release branch
- [ ] `npm run lint` passes on release branch
- [ ] `package.json` version updated
- [ ] Release notes describe what changed
- [ ] Migration guide included (MAJOR only)
- [ ] GitHub Release created with tag
