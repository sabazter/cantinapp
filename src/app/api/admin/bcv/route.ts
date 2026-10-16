import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, withAuth } from "@/lib/require-role";
import { validateBody } from "@/lib/validate";
import { db } from "@/lib/db";
import { legacy, fechaISO } from "@/lib/legacy";
import { audit, AuditEvent } from "@/lib/audit";
import { tasaActivaBcv } from "@/lib/bcv";

// GET /api/admin/bcv — tasa activa + historial reciente
export const GET = withAuth(async (_req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin", "vendedor", "directivo");

  const cantinaId = session.user.cantinaId!;

  const [activa, historial] = await Promise.all([
    tasaActivaBcv(cantinaId),
    db.tasaBcv.findMany({
      where: { cantinaId },
      select: { id: true, fecha: true, tasaUsdBs: true, fuente: true, createdAt: true },
      orderBy: { fecha: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    activa,
    historial: historial.map(h => ({ ...legacy<Record<string, unknown>>(h), fecha: fechaISO(h.fecha) })),
  });
});

const overrideSchema = z.object({
  tasa:  z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// POST /api/admin/bcv — override manual de tasa
export const POST = withAuth(async (req: NextRequest, session) => {
  requireRole(session, "admin", "superadmin");

  const cantinaId = session.user.cantinaId!;
  const { tasa, fecha } = await validateBody(req, overrideSchema);
  const diaObjetivo = fecha ?? new Date().toISOString().slice(0, 10);
  const dia = new Date(diaObjetivo);

  // Leer tasa anterior para el audit log
  const anterior = await db.tasaBcv.findUnique({
    where: { cantinaId_fecha: { cantinaId, fecha: dia } },
    select: { tasaUsdBs: true },
  });

  await db.tasaBcv.upsert({
    where: { cantinaId_fecha: { cantinaId, fecha: dia } },
    create: { cantinaId, fecha: dia, tasaUsdBs: tasa, fuente: "manual" },
    update: { tasaUsdBs: tasa, fuente: "manual" },
  });

  await audit({
    usuarioId: session.user.id,
    cantinaId,
    evento:    AuditEvent.TASA_BCV_CAMBIADA,
    entidad:   "tasas_bcv",
    datos: {
      fecha:         diaObjetivo,
      tasaAnterior:  anterior ? anterior.tasaUsdBs.toNumber() : null,
      tasaNueva:     tasa,
      fuente:        "manual",
    },
  });

  return NextResponse.json({ ok: true, fecha: diaObjetivo, tasa });
});
