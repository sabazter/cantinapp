import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";

// GET /api/representante/config — devuelve preferencias del representante
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "representante");

  const data = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { emailVerificado: true, notifEmail: true, notifWhatsapp: true },
  });

  return NextResponse.json({
    emailVerificado: data?.emailVerificado ?? false,
    notifEmail:      data?.notifEmail      ?? true,
    notifWhatsapp:   data?.notifWhatsapp   ?? true,
  });
});

// PUT /api/representante/config — actualiza preferencias de notificación
const prefsSchema = z.object({
  notifEmail:    z.boolean(),
  notifWhatsapp: z.boolean(),
});

export const PUT = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "representante");
  const body = await validateBody(req, prefsSchema);

  await db.usuario.update({
    where: { id: session.user.id },
    data: { notifEmail: body.notifEmail, notifWhatsapp: body.notifWhatsapp },
  });

  return NextResponse.json({ ok: true });
});
