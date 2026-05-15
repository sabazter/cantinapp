import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";

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

    // Enviar email si Resend está configurado
    if (process.env.RESEND_API_KEY) {
      const resetUrl = `${process.env.NEXTAUTH_URL}/recuperar-password/nueva?token=${token}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    process.env.RESEND_FROM ?? "noreply@cantinapp.com",
          to:      email,
          subject: "Restablecer contraseña — CantinApp",
          html: `
            <p>Hola ${usuario.nombre},</p>
            <p>Recibiste este email porque solicitaste restablecer tu contraseña.</p>
            <p><a href="${resetUrl}">Haz clic aquí para continuar</a></p>
            <p>Este enlace expira en ${TTL_MINUTOS} minutos y solo puede usarse una vez.</p>
            <p>Si no solicitaste este cambio, ignora este email.</p>
          `,
        }),
      }).catch((e) => console.error("[reset-pwd] email error:", e));
    } else {
      // En desarrollo, loguear el token para pruebas
      console.info(`[reset-pwd] TOKEN (dev): ${token}`);
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
