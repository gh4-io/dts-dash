import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { db } from "./db/client";
import { users, sessions } from "./db/schema";
import { eq, or, and, ne } from "drizzle-orm";
import { validateAuthSecret } from "./utils/env-check";
import {
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
} from "./utils/login-rate-limit";

validateAuthSecret();

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // Initial login — store user data + tokenVersion in JWT
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.tokenVersion = (user as { tokenVersion: number }).tokenVersion;
        token.sessionId = (user as { sessionId: string }).sessionId;
      } else if (token.id) {
        // Subsequent requests — verify tokenVersion is still current
        const dbUser = db
          .select({
            role: users.role,
            tokenVersion: users.tokenVersion,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.id, token.id as string))
          .get();

        if (!dbUser || !dbUser.isActive) {
          // User deleted or deactivated — force re-login
          return { ...token, invalid: true };
        }

        if (dbUser.tokenVersion !== token.tokenVersion) {
          // Token version mismatch — password changed or admin invalidated
          return { ...token, invalid: true };
        }

        // Refresh role from DB — instant role changes
        token.role = dbUser.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.invalid) {
        // Return empty session to force re-login
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      // Clean up DB session on logout
      if ("token" in message && message.token?.sessionId) {
        db.delete(sessions)
          .where(eq(sessions.id, message.token.sessionId as string))
          .run();
      }
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        login: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const login = credentials?.login as string | undefined;
        if (!login || !credentials?.password) {
          return null;
        }

        const password = credentials.password as string;
        const loginLower = login.toLowerCase();

        // Extract client IP for rate limiting
        const forwarded =
          request?.headers?.get?.("x-forwarded-for") ??
          request?.headers?.get?.("x-real-ip");
        const ip =
          (typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : null) ?? "unknown";

        // Check rate limit before DB lookup
        if (isRateLimited(ip, loginLower)) {
          throw new Error("Too many login attempts. Try again in 15 minutes.");
        }

        const user = db
          .select()
          .from(users)
          .where(
            or(
              eq(users.email, loginLower),
              eq(users.username, loginLower)
            )
          )
          .get();

        if (!user || !user.isActive) {
          recordFailedAttempt(ip, loginLower);
          return null;
        }

        const isValid = compareSync(password, user.passwordHash);
        if (!isValid) {
          recordFailedAttempt(ip, loginLower);
          return null;
        }

        clearAttempts(ip, loginLower);

        // Create DB session record
        const sessionId = crypto.randomUUID();
        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(); // 30 days

        db.insert(sessions)
          .values({
            id: sessionId,
            sessionToken,
            userId: user.id,
            expiresAt,
          })
          .run();

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
          tokenVersion: user.tokenVersion,
          sessionId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
});

/**
 * Bump a user's tokenVersion to invalidate all existing JWT tokens.
 * Call after password change, role change, or account deactivation.
 */
export function invalidateUserTokens(userId: string): void {
  const user = db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (user) {
    db.update(users)
      .set({ tokenVersion: user.tokenVersion + 1 })
      .where(eq(users.id, userId))
      .run();
  }

  // Also clean up DB session records
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

/**
 * Invalidate all sessions EXCEPT the one with the given sessionId.
 * Used after password change to keep current session alive.
 */
export function invalidateOtherSessions(
  userId: string,
  keepSessionId: string
): void {
  db.delete(sessions)
    .where(
      and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId))
    )
    .run();
}
