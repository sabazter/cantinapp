import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { withAuth } from "@/lib/require-role";
import { db, dbSystem } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { emailVerificacion } from "@/lib/email/templates";
import { aplicarLimites } from "@/lib/rate-limit";

const secret = () => new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

// POST /api/auth/verificar-email — genera y envía email de verificación
export const POST = withAuth(async (_req: NextRequest, session) => {
  const usuario = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { emailVerificado: true },
  });

  if (usuario?.emailVerificado) {
    return NextResponse.json({ error: "El email ya está verificado" }, { status: 400 });
  }

  const token = await new SignJWT({ sub: session.user.id, type: "email_verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());

  const tmpl = emailVerificacion(token);
  await sendEmail({ to: session.user.email, ...tmpl });

  return NextResponse.json({ ok: true });
});

// GET /api/auth/verificar-email?token=xxx — confirma el token
export async function GET(req: NextRequest) {
  const limitado = await aplicarLimites(req, "global");
  if (limitado) return limitado;

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.type !== "email_verify" || !payload.sub) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    await dbSystem.usuario.update({
      where: { id: payload.sub },
      data: { emailVerificado: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
  }
}
