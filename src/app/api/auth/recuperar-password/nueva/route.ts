import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { validateBody } from "@/lib/validate";
import { dbSystem } from "@/lib/db";
import { audit, AuditEvent } from "@/lib/audit";
import { aplicarLimites } from "@/lib/rate-limit";

const schema = z.object({
  token:    z.string().min(1).max(200),
  password: z.string().min(8).max(72),
});

// POST /api/auth/recuperar-password/nueva — valida token y actualiza contraseña
export async function POST(req: NextRequest) {
  try {
    const limitado = await aplicarLimites(req, "recuperar");
    if (limitado) return limitado;

    const { token, password } = await validateBody(req, schema);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const registro = await dbSystem.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, usuarioId: true, expiresAt: true, usedAt: true },
    });

    if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
    }

    const hashPwd = await bcrypt.hash(password, 12);
    const ahora = new Date();

    await dbSystem.$transaction([
      dbSystem.usuario.update({ where: { id: registro.usuarioId }, data: { hashPwd } }),
      dbSystem.passwordResetToken.update({ where: { id: registro.id }, data: { usedAt: ahora } }),
      // Revocar refresh tokens por seguridad
      dbSystem.refreshToken.updateMany({
        where: { usuarioId: registro.usuarioId, revokedAt: null },
        data: { revokedAt: ahora },
      }),
    ]);

    await audit({
      usuarioId: registro.usuarioId,
      evento:    AuditEvent.PASSWORD_CAMBIADO,
      entidad:   "usuario",
      entidadId: registro.usuarioId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { status?: number }).status === 400) {
      return NextResponse.json({ error: "Input inválido" }, { status: 400 });
    }
    console.error("[nueva-pwd]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
