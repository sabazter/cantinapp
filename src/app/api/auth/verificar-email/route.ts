import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/email/resend";
import { emailVerificacion } from "@/lib/email/templates";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

// POST /api/auth/verificar-email — genera y envía email de verificación
export const POST = withAuth(async (_req: NextRequest, session) => {
  const supabase = createServerSupabase();

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("email_verificado, email")
    .eq("id", session.user.id)
    .single();

  if (usuario?.email_verificado) {
    return NextResponse.json({ error: "El email ya está verificado" }, { status: 400 });
  }

  const token = await new SignJWT({ sub: session.user.id, type: "email_verify" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  const tmpl = emailVerificacion(token);
  await sendEmail({ to: session.user.email, ...tmpl });

  return NextResponse.json({ ok: true });
});

// GET /api/auth/verificar-email?token=xxx — confirma el token
const tokenSchema = z.object({ token: z.string().min(1) });

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "email_verify" || !payload.sub) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("usuarios")
      .update({ email_verificado: true, updated_at: new Date().toISOString() })
      .eq("id", payload.sub as string);

    if (error) return NextResponse.json({ error: "Error al verificar" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
  }
}
