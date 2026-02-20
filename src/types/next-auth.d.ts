import "next-auth";

declare module "next-auth" {
  interface User {
    role: "user" | "admin" | "superadmin";
    tokenVersion: number;
    sessionId: number;
    forcePasswordChange: boolean;
    userId: number;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "user" | "admin" | "superadmin";
      forcePasswordChange: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    userId?: number;
    role?: string;
    tokenVersion?: number;
    sessionId?: number;
    invalid?: boolean;
    forcePasswordChange?: boolean;
  }
}
