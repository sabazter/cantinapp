import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy } from "@/lib/legacy";
import { audit } from "@/lib/audit";

const cantinSchema = z.object({
  nombre:           z.string().min(1).max(100),
  escuela:          z.string().min(1).max(200),
  direccion:        z.string().max(300).optional().nullable(),
  limite_fiado_usd: z.number().min(0),
  umbral_deuda_usd: z.number().min(0),
  notif_email:      z.boolean(),
  notif_whatsapp:   z.boolean(),
  tasa_manual:      z.number().positive().nullable().optional(),
});

export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;

  const data = await db.cantina.findUnique({
    where: { id: cantinaId },
    select: {
      id: true, nombre: true, escuela: true, direccion: true, limiteFiadoUsd: true,
      umbralDeudaUsd: true, notifEmail: true, notifWhatsapp: true, tasaManual: true,
    },
  });

  if (!data) return NextResponse.json({ error: "Error al cargar configuración" }, { status: 500 });
  return NextResponse.json(legacy(data));
});

export const PUT = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");
  const cantinaId = session.user.cantinaId!;

  const body = await validateBody(req, cantinSchema);

  await db.cantina.update({
    where: { id: cantinaId },
    data: {
      nombre:         body.nombre,
      escuela:        body.escuela,
      direccion:      body.direccion ?? null,
      limiteFiadoUsd: body.limite_fiado_usd,
      umbralDeudaUsd: body.umbral_deuda_usd,
      notifEmail:     body.notif_email,
      notifWhatsapp:  body.notif_whatsapp,
      tasaManual:     body.tasa_manual ? Math.round(body.tasa_manual * 100) / 100 : null,
    },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento: "configuracion_actualizada",
    entidad: "cantina",
    entidadId: cantinaId,
  });

  return NextResponse.json({ ok: true });
});
