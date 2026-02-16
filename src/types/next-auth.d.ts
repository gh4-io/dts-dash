import "next-auth";

declare module "next-auth" {
  interface User {
    role: "user" | "admin" | "superadmin";
    tokenVersion: number;
    sessionId: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "user" | "admin" | "superadmin";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    tokenVersion?: number;
    sessionId?: string;
    invalid?: boolean;
  }
}
