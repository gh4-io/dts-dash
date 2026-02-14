export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!api/auth|api/seed|_next/static|_next/image|favicon\\.ico|vendor).*)",
  ],
};
