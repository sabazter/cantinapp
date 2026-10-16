import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";

const schema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword:     z.string().min(8, "Mínimo 8 caracteres").max(72),
});

export const POST = withAuth(async (req: NextRequest, session) => {
  const body = await validateBody(req, schema);

  const data = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { hashPwd: true },
  });

  if (!data) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const valid = await bcrypt.compare(body.currentPassword, data.hashPwd);
  if (!valid) return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });

  const newHash = await bcrypt.hash(body.newPassword, 12);
  await db.usuario.update({
    where: { id: session.user.id },
    data: { hashPwd: newHash },
  });

  return NextResponse.json({ ok: true });
});
