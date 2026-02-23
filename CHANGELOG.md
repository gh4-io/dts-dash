# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-02-23

### Fixed

- **Create User dialog** now shows "Require password reset at next login" checkbox (defaults to checked) in both create and edit modes
- **Password change** no longer breaks session — client re-authenticates via `signIn()` after successful password change, keeping JWT valid
- **Registration** now auto-logs in after successful account creation instead of redirecting to login page
- **Forced password reset** redirect to dashboard now works correctly after password change (same root cause as password change fix)
- **Admin self-password-reset** blocked — admin cannot reset their own password via the Reset Password action (returns helpful error directing to Account page)
- **Admin self-role-change** blocked — admin cannot change their own role via the Edit User form (prevents session death from token invalidation)
- **Admin self-password-change via admin form** blocked — admin must use Account page to change their own password (prevents session death)
- **CLI `db:reset-password`** now bumps `tokenVersion` to invalidate existing sessions after password reset

## [0.1.0] - 2026-02-19

### Added

- Initial release
- Flight Board with Gantt timeline
- Statistics Dashboard with KPI cards and charts
- Capacity Modeling (Phase 1)
- Authentication system (Auth.js with credentials provider)
- Admin panel (users, customers, aircraft types, data import, settings)
- SQLite local-first database with Drizzle ORM
- 11 theme presets (Fumadocs)
- Global FilterBar with URL sync
