import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";
import { audit, AuditEvent } from "@/lib/audit";

const schema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8).max(72),
});

// POST /api/auth/recuperar-password/nueva — valida token y actualiza contraseña
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await validateBody(req, schema);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const supabase  = createServerSupabase();

    const { data: registro } = await supabase
      .from("password_reset_tokens")
      .select("id, usuario_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .single();

    if (!registro || registro.used_at || new Date(registro.expires_at) < new Date()) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
    }

    const hashPwd = await bcrypt.hash(password, 12);

    await Promise.all([
      supabase.from("usuarios")
        .update({ hash_pwd: hashPwd })
        .eq("id", registro.usuario_id),
      supabase.from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", registro.id),
      // Revocar refresh tokens por seguridad
      supabase.from("refresh_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("usuario_id", registro.usuario_id)
        .is("revoked_at", null),
    ]);

    await audit({
      usuarioId: registro.usuario_id,
      evento:    AuditEvent.PASSWORD_CAMBIADO,
      entidad:   "usuario",
      entidadId: registro.usuario_id,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { status?: number }).status === 400) {
      return NextResponse.json({ error: "Input inválido" }, { status: 400 });
    }
    console.error("[nueva-pwd]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
