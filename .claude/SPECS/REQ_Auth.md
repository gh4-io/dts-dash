# REQ: Authentication & Authorization

> Supersedes [REQ_Permissions.md](REQ_Permissions.md) which stated "no auth for v0."
> Per D-009, authentication is now in scope.

## Auth Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Auth Framework | Auth.js (NextAuth.js v5) | Next.js App Router native |
| Database | SQLite via better-sqlite3 | Local-first, zero-config |
| ORM | Drizzle ORM | Type-safe, lightweight, SQLite support |
| Session Strategy | Database sessions | More secure than JWT for admin roles |
| Password Hashing | bcrypt | Industry standard |

## User Model

```typescript
interface User {
  id: string;                   // UUID
  email: string;                // Unique, login identifier
  displayName: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type UserRole = "user" | "admin" | "superadmin";
```

## Session Model

```typescript
interface Session {
  id: string;
  userId: string;
  token: string;               // Session token (httpOnly cookie)
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

## Routes & Protection

| Route | Access | Enforcement |
|-------|--------|-------------|
| `/login` | Public | Redirect if authenticated |
| `/flight-board` | Authenticated | Middleware redirect to `/login` |
| `/dashboard` | Authenticated | Middleware redirect |
| `/capacity` | Authenticated | Middleware redirect |
| `/settings` | Authenticated | Middleware redirect |
| `/account` | Authenticated | Middleware redirect |
| `/admin` | Admin/Superadmin only | Middleware + server-side role check |
| `/admin/*` | Admin/Superadmin only | Middleware + server-side role check |
| `/api/*` | Authenticated | Return 401 if no valid session |
| `/api/admin/*` | Admin/Superadmin only | Return 403 if role insufficient |

## Middleware (`src/middleware.ts`)

```typescript
// Pseudocode
export function middleware(request: NextRequest) {
  const session = await getSession(request);
  const isPublicRoute = ['/login', '/api/auth'].some(r => request.nextUrl.pathname.startsWith(r));

  if (!session && !isPublicRoute) return redirect('/login');
  if (request.nextUrl.pathname.startsWith('/admin') && session?.user.role === 'user') return redirect('/');
}
```

## Login Page (`/login`)

- Email + password form
- "Remember me" checkbox (extends session to 30 days)
- Error messages: "Invalid credentials" (generic, no enumeration)
- Redirect to `/flight-board` on success (or `callbackUrl` if set)
- Minimal design — centered card, app logo, dark theme

## Logout

- `POST /api/auth/signout`
- Invalidate session in database
- Clear session cookie
- Redirect to `/login`

## Default Users (Seed Data)

For initial setup, seed the database with:

```typescript
const SEED_USERS = [
  { email: "admin@local", username: "admin", displayName: "Admin", role: "superadmin", password: "admin123" },
  { email: "user@local", username: "user", displayName: "Test User", role: "user", password: "user123" },
];
```

These are development defaults. A first-run setup flow or environment variable should override in production.

## v1 Scope vs vNext

### v1 (Implement Now)
- Email/password login
- Database sessions
- Role-based route protection (middleware + server)
- Logout with session invalidation
- User dropdown in header (Account / Admin / Logout)

### vNext (UI stubs only, marked inactive)
- Passkeys (WebAuthn) — stub in Account page
- TOTP 2FA — stub in Account page
- OAuth providers (Google, Microsoft) — stub on login page
- Password reset via email — stub
- Session management UI (view/revoke active sessions) — stub in Account page

## Files

| File | Purpose |
|------|---------|
| `src/middleware.ts` | Route protection |
| `src/lib/auth.ts` | Auth.js configuration |
| `src/lib/db/schema.ts` | Drizzle schema (users, sessions) |
| `src/lib/db/index.ts` | SQLite connection |
| `src/lib/db/seed.ts` | Seed default users |
| `src/app/login/page.tsx` | Login page |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js API routes |
