import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { aplicarLimites } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export { handler as GET };

type Ctx = { params: Promise<{ nextauth: string[] }> };

// Límite de intentos (por IP y por email) solo en el login con credenciales
export async function POST(req: NextRequest, ctx: Ctx) {
  if (new URL(req.url).pathname.endsWith("/callback/credentials")) {
    let email: string | undefined;
    try {
      const form = await req.clone().formData();
      email = String(form.get("email") ?? "") || undefined;
    } catch {
      // body no estándar: se limita solo por IP
    }

    const limitado = await aplicarLimites(req, "login", email);
    if (limitado) {
      // Formato que espera signIn() de next-auth/react (error en la query de `url`)
      return NextResponse.json(
        { url: `${new URL(req.url).origin}/login?error=rate_limited` },
        { status: 429, headers: limitado.headers }
      );
    }
  }
  return handler(req, ctx);
}
