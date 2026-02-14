import type { NextAuthConfig } from "next-auth";

/**
 * Auth config without database dependencies.
 * Used by middleware (edge runtime) for route protection.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname === "/login";

      if (isOnLogin) {
        return isLoggedIn
          ? Response.redirect(new URL("/dashboard", request.nextUrl))
          : true;
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // Providers added in auth.ts (not edge-compatible)
  session: {
    strategy: "jwt",
  },
};
