import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_REDIRECTS: Record<string, string> = {
  admin: "/admin/dashboard",
  vendedor: "/caja",
  representante: "/portal",
  directivo: "/reportes",
  superadmin: "/superadmin",
};

const PROTECTED_PREFIXES: Record<string, string[]> = {
  "/admin": ["admin", "superadmin"],
  "/caja": ["vendedor", "admin", "superadmin"],
  "/portal": ["representante"],
  "/reportes": ["directivo", "admin", "superadmin"],
  "/superadmin": ["superadmin"],
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const rol = req.nextauth.token?.rol as string | undefined;

    if (!rol) return NextResponse.redirect(new URL("/login", req.url));

    // Check if current path is allowed for this role
    for (const [prefix, allowedRoles] of Object.entries(PROTECTED_PREFIXES)) {
      if (pathname.startsWith(prefix) && !allowedRoles.includes(rol)) {
        const redirect = ROLE_REDIRECTS[rol] ?? "/login";
        return NextResponse.redirect(new URL(redirect, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/caja/:path*",
    "/portal/:path*",
    "/reportes/:path*",
    "/superadmin/:path*",
  ],
};
