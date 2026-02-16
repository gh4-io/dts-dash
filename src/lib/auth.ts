import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { db } from "./db/client";
import { users } from "./db/schema";
import { eq, or } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
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
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        login: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const login = credentials?.login as string | undefined;
        if (!login || !credentials?.password) {
          return null;
        }

        const password = credentials.password as string;
        const loginLower = login.toLowerCase();

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
          return null;
        }

        const isValid = compareSync(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
});
