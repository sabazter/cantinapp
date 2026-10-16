import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { validateBody } from "@/lib/validate";
import { dbSystem } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { emailResetPassword } from "@/lib/email/templates";
import { aplicarLimites } from "@/lib/rate-limit";

const schema = z.object({ email: z.email() });

const TTL_MINUTOS = 15;

// POST /api/auth/recuperar-password — genera token y envía email
export async function POST(req: NextRequest) {
  try {
    const { email } = await validateBody(req, schema);

    const limitado = await aplicarLimites(req, "recuperar", email);
    if (limitado) return limitado;

    const usuario = await dbSystem.usuario.findUnique({
      where: { email },
      select: { id: true, activo: true },
    });

    // Respuesta idéntica si el email no existe (evitar enumeración)
    if (!usuario || !usuario.activo) {
      return NextResponse.json({ ok: true });
    }

    const token     = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + TTL_MINUTOS * 60 * 1000);

    await dbSystem.$transaction([
      // Invalidar tokens anteriores del mismo usuario
      dbSystem.passwordResetToken.updateMany({
        where: { usuarioId: usuario.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      dbSystem.passwordResetToken.create({
        data: { usuarioId: usuario.id, tokenHash, expiresAt },
      }),
    ]);

    // Enviar email con plantilla centralizada. Nunca se registra el token en logs.
    const tmpl = emailResetPassword(token);
    const sent = await sendEmail({ to: email, ...tmpl });
    if (!sent) {
      console.error("[reset-pwd] No se pudo enviar el email de recuperación");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { status?: number }).status === 400) {
      return NextResponse.json({ error: "Input inválido" }, { status: 400 });
    }
    console.error("[reset-pwd]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
