import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { jwtVerify, importSPKI } from "jose";

const ROLE_REDIRECTS: Record<string, string> = {
  admin:         "/admin/dashboard",
  vendedor:      "/caja",
  representante: "/portal",
  directivo:     "/reportes",
  superadmin:    "/superadmin/dashboard",
};

const PROTECTED_PREFIXES: Record<string, string[]> = {
  "/admin":      ["admin", "superadmin"],
  "/caja":       ["vendedor", "admin", "superadmin"],
  "/portal":     ["representante", "profesor"],
  "/reportes":   ["directivo", "admin", "superadmin"],
  "/superadmin": ["superadmin"],
};

let _cachedPublicKey: Awaited<ReturnType<typeof importSPKI>> | null = null;

async function decodeRS256Token(token: string): Promise<any> {
  try {
    if (!_cachedPublicKey) {
      const pem = (process.env.NEXTAUTH_PUBLIC_KEY ?? "").replace(/\\n/g, "\n");
      _cachedPublicKey = await importSPKI(pem, "RS256");
    }
    const { payload } = await jwtVerify(token, _cachedPublicKey, { algorithms: ["RS256"] });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = Object.keys(PROTECTED_PREFIXES).some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Intentar leer el token con decode RS256 personalizado
  const rawToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    decode: async ({ token }) => {
      if (!token) return null;
      return decodeRS256Token(token);
    },
  });

  if (!rawToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rol = rawToken.rol as string | undefined;
  if (!rol) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  for (const [prefix, allowedRoles] of Object.entries(PROTECTED_PREFIXES)) {
    if (pathname.startsWith(prefix) && !allowedRoles.includes(rol)) {
      return NextResponse.redirect(new URL(ROLE_REDIRECTS[rol] ?? "/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/caja/:path*",
    "/portal/:path*",
    "/reportes/:path*",
    "/superadmin/:path*",
  ],
};
