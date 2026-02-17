import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that require no authentication at all
const PUBLIC_PREFIXES = [
  "/login",
  "/setup",
  "/api/auth/",
  "/api/ingest",
  "/api/health",
  "/_next/",
  "/vendor/",
  "/favicon.ico",
];

// Routes restricted to admin or superadmin
const ADMIN_PREFIXES = ["/admin", "/api/admin/"];

// Config route PUT requires admin
const CONFIG_ROUTE = "/api/config";

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAdmin(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth?.user;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from login page
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // Admin route enforcement
  if (isAdmin(pathname)) {
    if (role !== "admin" && role !== "superadmin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
  }

  // Config PUT requires admin
  if (pathname === CONFIG_ROUTE && req.method === "PUT") {
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and API routes with their own auth
    "/((?!_next/static|_next/image|favicon.ico|vendor/|api/ingest|api/health).*)",
  ],
};
