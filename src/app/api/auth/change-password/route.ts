import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { createServerSupabase } from "@/lib/supabase-server";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8, "Mínimo 8 caracteres"),
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await validateBody(req, schema);

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("usuarios")
    .select("hash_pwd")
    .eq("id", session.user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const valid = await bcrypt.compare(body.currentPassword, data.hash_pwd as string);
  if (!valid) return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });

  const newHash = await bcrypt.hash(body.newPassword, 12);
  const { error: updateError } = await supabase
    .from("usuarios")
    .update({ hash_pwd: newHash, updated_at: new Date().toISOString() })
    .eq("id", session.user.id);

  if (updateError) return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });

  return NextResponse.json({ ok: true });
});
