# Reversal Guide: Allowed Hostnames (D-027, OI-037)

> **Commit**: `80ea2db` on `dev` branch — 2026-02-16
> **Parent commit**: `2c9cd2a`
> **Quick revert**: `git revert 80ea2db` (will create a new commit undoing all changes)

**WARNING**: This commit includes both the allowed hostnames feature AND parallel dashboard layout changes (from the user's concurrent session). A full `git revert` will undo both. If you only want to remove the hostname feature, follow the manual steps below.

---

## What Was Changed

### 1. Auth.js — trustHost (`src/lib/auth.ts`)

**Change**: Added `trustHost: true` to NextAuth config (line 9).

**To reverse**: Remove `trustHost: true,` from the NextAuth config object. Re-add `AUTH_URL=http://localhost:3000` to `.env.local`.

```diff
 export const { handlers, signIn, signOut, auth } = NextAuth({
-  trustHost: true,
   pages: {
     signIn: "/login",
   },
```

```
# .env.local — re-add:
AUTH_URL=http://localhost:3000
```

### 2. Type Definition (`src/types/index.ts`)

**Change**: Added `AllowedHostname` interface (lines 279-288) and `allowedHostnames: AllowedHostname[]` to `AppConfig` (line 305).

**To reverse**: Remove the `AllowedHostname` interface block and the `allowedHostnames` field from `AppConfig`.

```diff
-// ─── Allowed Hostnames ──────────────────────────────────────────────────────
-
-export interface AllowedHostname {
-  id: string;
-  hostname: string;
-  port: number | null;
-  protocol: "http" | "https";
-  enabled: boolean;
-  label: string;
-}
-
 // ─── App Config ─────────────────────────────────────────────────────────────

 export interface AppConfig {
   ...
   masterDataOverwriteConfirmed: "allow" | "warn" | "reject";
-  allowedHostnames: AllowedHostname[];
 }
```

### 3. Seed Data (`data/seed/app-config.json`)

**Change**: Added `allowedHostnames` entry at the end of the array.

**To reverse**: Remove the `allowedHostnames` object from the JSON array. Fix the trailing comma on the previous entry.

```diff
   { "key": "masterDataConformityMode", "value": "warning" },
-  { "key": "masterDataOverwriteConfirmed", "value": "warn" },
-  {
-    "key": "allowedHostnames",
-    "value": "[{\"id\":\"default-localhost\",\"hostname\":\"localhost\",\"port\":3000,\"protocol\":\"http\",\"enabled\":true,\"label\":\"Local Development\"}]"
-  }
+  { "key": "masterDataOverwriteConfirmed", "value": "warn" }
 ]
```

Also delete the row from the database:
```sql
DELETE FROM app_config WHERE key = 'allowedHostnames';
```

### 4. API Route (`src/app/api/config/route.ts`)

**Change**: Added `allowedHostnames` parsing to GET handler (lines 43-55) and added `"allowedHostnames"` to PUT whitelist (line 81).

**To reverse in GET** (remove lines 43-55):
```diff
       ingestMaxSizeMB: parseInt(configMap.ingestMaxSizeMB ?? "50", 10),
-      allowedHostnames: JSON.parse(
-        configMap.allowedHostnames ??
-          JSON.stringify([
-            {
-              id: "default-localhost",
-              hostname: "localhost",
-              port: 3000,
-              protocol: "http",
-              enabled: true,
-              label: "Local Development",
-            },
-          ])
-      ),
     };
```

**To reverse in PUT** (remove from whitelist):
```diff
       "ingestRateLimitSeconds",
       "ingestMaxSizeMB",
-      "allowedHostnames",
     ]);
```

### 5. Transformer (`src/lib/data/transformer.ts`)

**Change**: Added `allowedHostnames` to both the loadConfig parsed result and the fallback defaults.

**To reverse**: Remove both lines.

```diff
 // In loadConfig() parsed result (~line 46):
       masterDataOverwriteConfirmed: ...
-      allowedHostnames: JSON.parse(configMap.allowedHostnames ?? "[]"),
     };

 // In loadConfig() fallback defaults (~line 70):
       masterDataOverwriteConfirmed: "warn",
-      allowedHostnames: [],
     };
```

### 6. next.config.ts

**Change**: Added import of `readAllowedDevOrigins` and `allowedDevOrigins` config property.

**To reverse**:
```diff
 import type { NextConfig } from "next";
-import { readAllowedDevOrigins } from "./src/lib/db/read-hostnames";

 const nextConfig: NextConfig = {
   serverExternalPackages: ["better-sqlite3"],
   transpilePackages: ["echarts", "zrender"],
   turbopack: {},
-  allowedDevOrigins: readAllowedDevOrigins(),
 };
```

### 7. New File — DELETE (`src/lib/db/read-hostnames.ts`)

**Change**: Created new file — synchronous helper that reads allowed hostnames from SQLite for `next.config.ts`.

**To reverse**: Delete the file entirely.

```bash
rm src/lib/db/read-hostnames.ts
```

### 8. Admin Settings Page (`src/app/(authenticated)/admin/settings/page.tsx`)

**Changes**:
- Added `AllowedHostname` interface (lines 24-31)
- Added `allowedHostnames` to local `AppConfig` interface (line 44)
- Added 3 state hooks: `newHost`, `editingHostId`, `editHost` (lines 55-57)
- Added 6 helper functions: `addHostname`, `removeHostname`, `toggleHostname`, `startEditHostname`, `saveEditHostname`, `formatHostUrl` (lines 95-162)
- Added "Allowed Hostnames" section JSX (lines 485-621)
- Changed Coming Soon stubs from 3-column grid with "Authentication" to 2-column grid without it

**To reverse**:
1. Remove `AllowedHostname` interface
2. Remove `allowedHostnames` from local `AppConfig`
3. Remove the 3 state hooks
4. Remove the 6 helper functions
5. Remove the entire "Allowed Hostnames" `<section>` block
6. Restore Coming Soon stubs to 3-column with "Authentication":

```tsx
{/* Coming Soon stubs */}
<div className="grid gap-4 sm:grid-cols-3">
  {[
    { label: "Authentication", icon: "fa-solid fa-lock" },
    { label: "Email", icon: "fa-solid fa-envelope" },
    { label: "Storage", icon: "fa-solid fa-hard-drive" },
  ].map((item) => (
    ...
  ))}
</div>
```

---

## Files NOT Part of Hostname Feature (Dashboard Layout Changes)

These were parallel changes from the user's concurrent session included in the same commit. Do NOT revert these when reversing only the hostname feature:

| File | Change |
|------|--------|
| `src/app/(authenticated)/dashboard/page.tsx` | Layout refactor: 3-column grid with flex ratios, moved OperatorPerformance into center column |
| `src/components/dashboard/kpi-card.tsx` | Added `flex flex-col` + inner `flex-1 min-h-0` wrapper |
| `src/components/dashboard/mh-by-operator-card.tsx` | Added `className` prop passthrough |
| `src/components/dashboard/operator-performance.tsx` | Added `className` prop, flex layout for scroll |
| `src/components/dashboard/total-aircraft-card.tsx` | Added `className` prop passthrough |
| `src/components/dashboard/aircraft-by-type-card.tsx` | Added `className` prop passthrough |
| `src/lib/hooks/use-customers.ts` | Added `hashName` + `getCustomerColor` fallback for unknown customers |
| `next-env.d.ts` | Auto-generated path change (`.next/dev/types` → `.next/types`) |

---

## Doc Entries to Remove

If fully reversing, also remove:
- `.claude/DECISIONS.md` — D-027 entry
- `.claude/OPEN_ITEMS.md` — OI-037 entry, revert summary table counts (P1 resolved: 12→11, total resolved: 36→35)
- `.claude/ROADMAP.md` — Remove "Post-M8 Enhancements" line about allowed hostnames

---

## Database Cleanup

After code reversal, clean up the database:

```sql
DELETE FROM app_config WHERE key = 'allowedHostnames';
```

No schema migration needed — `allowedHostnames` is a key-value entry, not a table.
