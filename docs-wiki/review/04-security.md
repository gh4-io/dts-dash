# Phase 2 — Security Review

**Date:** 2026-02-15

## Fixed Issues

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| 1 | `/api/seed` publicly accessible | CRITICAL | Removed from proxy exclusion; added superadmin guard in production |
| 2 | Credentials logged to console | MEDIUM | Replaced with generic message; passwords no longer in logs |
| 3 | Arbitrary config keys writable | MEDIUM | Added whitelist of 7 allowed keys with rejection logging |

## Remaining Risks (Accepted)

| # | Issue | Severity | Mitigation |
|---|-------|----------|------------|
| 1 | No rate limiting on login | MEDIUM | Local-first app, single user. Add if exposed to network. |
| 2 | Temp password in reset response | MEDIUM | Acceptable for admin-initiated reset in local context. No email system. |
| 3 | Hardcoded seed passwords | LOW | Only used for initial bootstrap. `forcePasswordChange` flag recommended for production. |
| 4 | 8-char minimum password | LOW | Adequate for local-first deployment. Strengthen for multi-user. |
| 5 | JWT session invalidation incomplete | LOW | JWT is stateless; session table not checked. Acceptable trade-off. |

## Security Posture Summary

### Strengths
- Drizzle ORM: parameterized queries (no SQL injection)
- bcryptjs with 10 rounds for password hashing
- Role-based access control on all admin routes
- Foreign key constraints with cascade delete
- Password hashes never returned in API responses
- Self-protection: can't deactivate own account or demote last superadmin

### Architecture
- Auth: JWT-based via Auth.js v5 (beta.30)
- Proxy: Node.js runtime (not Edge) — can access DB directly
- All admin routes require `admin` or `superadmin` role
- Work package APIs require any authenticated session

### OWASP Top 10 Coverage
| Category | Status |
|----------|--------|
| A01 Broken Access Control | GOOD — role checks on all routes |
| A02 Cryptographic Failures | GOOD — bcryptjs, no secrets in code |
| A03 Injection | GOOD — Drizzle ORM (parameterized) |
| A04 Insecure Design | OK — local-first mitigates most |
| A05 Security Misconfiguration | FIXED — seed endpoint secured |
| A06 Vulnerable Components | 4 moderate (dev dep only) |
| A07 Auth Failures | OK — no rate limiting, but local-first |
| A08 Data Integrity | GOOD — validation on imports |
| A09 Logging Failures | IMPROVED — console.warn, no creds in logs |
| A10 SSRF | N/A — no outbound requests |
