import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/email/resend";
import { emailResetPassword } from "@/lib/email/templates";

const schema = z.object({ email: z.email() });

const TTL_MINUTOS = 15;

// POST /api/auth/recuperar-password — genera token y envía email
export async function POST(req: NextRequest) {
  try {
    const { email } = await validateBody(req, schema);
    const supabase   = createServerSupabase();

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nombre, activo")
      .eq("email", email)
      .single();

    // Respuesta idéntica si el email no existe (evitar enumeración)
    if (!usuario || !usuario.activo) {
      return NextResponse.json({ ok: true });
    }

    const token     = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + TTL_MINUTOS * 60 * 1000).toISOString();

    // Invalidar tokens anteriores del mismo usuario
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("usuario_id", usuario.id)
      .is("used_at", null);

    await supabase.from("password_reset_tokens").insert({
      usuario_id: usuario.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    // Enviar email con plantilla centralizada
    const tmpl = emailResetPassword(token);
    const sent = await sendEmail({ to: email, ...tmpl });
    if (!sent) {
      console.info(`[reset-pwd] TOKEN (fallback dev): ${token}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { status?: number }).status === 400) {
      return NextResponse.json({ error: "Input inválido" }, { status: 400 });
    }
    console.error("[reset-pwd]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
